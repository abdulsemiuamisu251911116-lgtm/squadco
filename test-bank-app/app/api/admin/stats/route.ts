import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get total users
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact' })

    // Get onboarded users
    const { count: onboardedUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .not('onboarded_at', 'is', null)

    // Get total transactions
    const { count: totalTransactions } = await supabase
      .from('transactions')
      .select('*', { count: 'exact' })

    // Get webhook events (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const { count: webhookEvents } = await supabase
      .from('webhook_logs')
      .select('*', { count: 'exact' })
      .gte('created_at', thirtyDaysAgo.toISOString())

    // Get average trust score
    const { data: trustScores } = await supabase
      .from('profiles')
      .select('trust_score')
      .not('trust_score', 'is', null)

    const avgTrustScore =
      trustScores && trustScores.length > 0
        ? trustScores.reduce((sum: number, u: any) => sum + (u.trust_score || 0), 0) /
          trustScores.length
        : 0

    return NextResponse.json({
      total_users: totalUsers || 0,
      onboarded_users: onboardedUsers || 0,
      total_transactions: totalTransactions || 0,
      webhook_events: webhookEvents || 0,
      avg_trust_score: avgTrustScore,
    })
  } catch (error) {
    console.error('[v0] Admin stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
