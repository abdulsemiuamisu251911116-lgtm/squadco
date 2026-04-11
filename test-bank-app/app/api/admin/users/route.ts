import { NextRequest, NextResponse } from 'next/server'
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

    // Get all users with their profiles
    const { data: users } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, onboarded_at, trust_score')
      .order('created_at', { ascending: false })

    return NextResponse.json({ users: users || [] })
  } catch (error) {
    console.error('[v0] Admin users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
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

    const body = await request.json()
    const { user_id, role } = body

    if (!user_id || !role || !['user', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    // Update user role
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', user_id)

    if (updateError) {
      console.error('[v0] Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Admin users patch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
