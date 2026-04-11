import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Get the current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { phone_number, amount, provider } = await request.json()

  // Validate input
  if (!phone_number || !amount || amount <= 0 || !provider) {
    return NextResponse.json(
      { error: 'Invalid input' },
      { status: 400 }
    )
  }

  // Get user's profile
  const { data: userData, error: userError } = await supabase
    .from('profiles')
    .select('balance')
    .eq('id', user.id)
    .single()

  if (userError || !userData) {
    return NextResponse.json(
      { error: 'Profile not found' },
      { status: 404 }
    )
  }

  if (userData.balance < amount) {
    return NextResponse.json(
      { error: 'Insufficient balance' },
      { status: 400 }
    )
  }

  // Deduct balance
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ balance: userData.balance - amount })
    .eq('id', user.id)

  if (updateError) {
    return NextResponse.json(
      { error: 'Airtime purchase failed' },
      { status: 500 }
    )
  }

  // Record transaction
  await supabase.from('transactions').insert({
    user_id: user.id,
    type: 'airtime',
    amount,
    description: `${provider.toUpperCase()} airtime to ${phone_number}`,
    recipient_account: phone_number,
    recipient_name: provider,
  })

  return NextResponse.json(
    { success: true, message: 'Airtime purchase successful' },
    { status: 200 }
  )
}
