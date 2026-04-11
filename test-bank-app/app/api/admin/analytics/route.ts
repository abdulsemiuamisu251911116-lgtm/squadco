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

    // Get transaction counts
    const { count: transferCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('type', 'transfer')

    const { count: airtimeCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('type', 'airtime')

    // Get transaction volumes
    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount')

    const totalVolume =
      transactions?.reduce((sum: number, t: any) => sum + (t.amount || 0), 0) || 0
    const avgTransaction =
      transactions && transactions.length > 0 ? totalVolume / transactions.length : 0

    // Get trust score distribution
    const { data: profiles } = await supabase
      .from('profiles')
      .select('trust_score')

    const trustScores = profiles || []
    const excellentCount = trustScores.filter((p: any) => p.trust_score >= 800).length
    const goodCount = trustScores.filter(
      (p: any) => p.trust_score >= 600 && p.trust_score < 800
    ).length
    const fairCount = trustScores.filter(
      (p: any) => p.trust_score >= 400 && p.trust_score < 600
    ).length
    const poorCount = trustScores.filter((p: any) => p.trust_score < 400).length

    // Get risk distribution from TrustLayer webhook logs
    const { data: logs } = await supabase
      .from('webhook_logs')
      .select('payload')
      .in('event_type', ['transaction.analyzed', 'transaction.allow', 'transaction.verify', 'transaction.block'])

    let lowRiskCount = 0,
      mediumRiskCount = 0,
      highRiskCount = 0

    logs?.forEach((log: any) => {
      const riskScore = Number(log.payload?.risk_score)
      if (Number.isNaN(riskScore)) return
      if (riskScore <= 30) lowRiskCount++
      else if (riskScore <= 65) mediumRiskCount++
      else highRiskCount++
    })

    return NextResponse.json({
      transfer_count: transferCount || 0,
      airtime_count: airtimeCount || 0,
      total_volume: totalVolume,
      avg_transaction: avgTransaction,
      excellent_trust_count: excellentCount,
      good_trust_count: goodCount,
      fair_trust_count: fairCount,
      poor_trust_count: poorCount,
      low_risk_count: lowRiskCount,
      medium_risk_count: mediumRiskCount,
      high_risk_count: highRiskCount,
    })
  } catch (error) {
    console.error('[v0] Analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
