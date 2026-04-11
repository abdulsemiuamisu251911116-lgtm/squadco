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

    // Get webhook logs (last 100)
    const { data: logs } = await supabase
      .from('webhook_logs')
      .select('id, event_type, request_id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    return NextResponse.json({ logs: logs || [] })
  } catch (error) {
    console.error('[v0] Webhook logs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
