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

  const { recipient_account, amount, recipient_name } = await request.json()

  // Validate input
  if (!recipient_account || !amount || amount <= 0) {
    return NextResponse.json(
      { error: 'Invalid input' },
      { status: 400 }
    )
  }

  // Get sender's profile
  const { data: senderData, error: senderError } = await supabase
    .from('profiles')
    .select('balance, account_number, email')
    .eq('id', user.id)
    .single()

  if (senderError || !senderData) {
    return NextResponse.json(
      { error: 'Profile not found' },
      { status: 404 }
    )
  }

  if (senderData.balance < amount) {
    return NextResponse.json(
      { error: 'Insufficient balance' },
      { status: 400 }
    )
  }

  // Get recipient's profile
  const { data: recipientData, error: recipientError } = await supabase
    .from('profiles')
    .select('id, balance, email')
    .eq('account_number', recipient_account)
    .single()

  if (recipientError || !recipientData) {
    return NextResponse.json(
      { error: 'Recipient account not found' },
      { status: 404 }
    )
  }

  // Update sender balance
  const { error: updateSenderError } = await supabase
    .from('profiles')
    .update({ balance: senderData.balance - amount })
    .eq('id', user.id)

  if (updateSenderError) {
    return NextResponse.json(
      { error: 'Transfer failed' },
      { status: 500 }
    )
  }

  // Update recipient balance
  const { error: updateRecipientError } = await supabase
    .from('profiles')
    .update({ balance: recipientData.balance + amount })
    .eq('id', recipientData.id)

  if (updateRecipientError) {
    return NextResponse.json(
      { error: 'Transfer failed' },
      { status: 500 }
    )
  }

  // Record transaction for sender
  await supabase.from('transactions').insert({
    user_id: user.id,
    type: 'transfer_sent',
    amount,
    description: `Transfer to ${recipient_name || recipient_account}`,
    recipient_account,
    recipient_name: recipient_name || 'Unknown',
  })

  // Record transaction for recipient
  await supabase.from('transactions').insert({
    user_id: recipientData.id,
    type: 'transfer_received',
    amount,
    description: `Transfer from ${senderData.email}`,
    recipient_account: senderData.account_number,
    recipient_name: senderData.email,
  })

  return NextResponse.json(
    { success: true, message: 'Transfer successful' },
    { status: 200 }
  )
}
