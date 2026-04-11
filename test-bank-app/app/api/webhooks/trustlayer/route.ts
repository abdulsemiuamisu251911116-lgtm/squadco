import crypto from 'crypto'

import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

type TrustLayerWebhookBody = {
  event?: string
  timestamp?: string
  data?: Record<string, unknown>
}

function verifySignature(rawBody: string, signature: string, secret: string) {
  const computedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  return computedSignature === signature
}

function deriveRiskBand(score: number | null | undefined) {
  if (typeof score !== 'number') return null
  if (score <= 30) return 'low'
  if (score <= 65) return 'medium'
  return 'high'
}

async function logWebhookEvent(supabase: Awaited<ReturnType<typeof createClient>>, input: {
  eventType: string
  requestId?: string | null
  payload?: Record<string, unknown>
  status: 'success' | 'error'
  errorMessage?: string
  createdAt?: string
}) {
  await supabase.from('webhook_logs').insert({
    event_type: input.eventType,
    request_id: input.requestId ?? null,
    payload: input.payload ?? {},
    status: input.status,
    error_message: input.errorMessage,
    created_at: input.createdAt ?? new Date().toISOString(),
  })
}

async function handleTransactionEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  event: string,
  data: Record<string, unknown>,
  requestId?: string | null
) {
  const transactionId = typeof data.transaction_id === 'string' ? data.transaction_id : null
  const decision = typeof data.decision === 'string' ? data.decision : null
  const riskScore = typeof data.risk_score === 'number' ? data.risk_score : null
  const aiExplanation = typeof data.ai_explanation === 'string' ? data.ai_explanation : null
  const riskBand = deriveRiskBand(riskScore)

  await logWebhookEvent(supabase, {
    eventType: event,
    requestId,
    payload: {
      transaction_id: transactionId,
      decision,
      risk_score: riskScore,
      risk_band: riskBand,
      ai_explanation: aiExplanation,
    },
    status: 'success',
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const rawBody = await request.text()
  const signature = request.headers.get('x-trustlayer-signature')
  const webhookSecret = process.env.TRUSTLAYER_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    await logWebhookEvent(supabase, {
      eventType: 'webhook_rejected',
      status: 'error',
      errorMessage: 'Missing webhook signature or local webhook secret',
    })
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  if (!verifySignature(rawBody, signature, webhookSecret)) {
    await logWebhookEvent(supabase, {
      eventType: 'webhook_rejected',
      status: 'error',
      errorMessage: 'Invalid TrustLayer webhook signature',
    })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  try {
    const body = JSON.parse(rawBody) as TrustLayerWebhookBody
    const event = body.event
    const timestamp = body.timestamp ?? new Date().toISOString()
    const data = body.data ?? {}
    const requestId =
      typeof data.transaction_id === 'string'
        ? data.transaction_id
        : typeof data.request_id === 'string'
          ? data.request_id
          : null

    if (!event) {
      await logWebhookEvent(supabase, {
        eventType: 'webhook_invalid',
        requestId,
        status: 'error',
        errorMessage: 'Missing event in webhook payload',
        createdAt: timestamp,
      })
      return NextResponse.json({ error: 'Missing event' }, { status: 400 })
    }

    switch (event) {
      case 'webhook.test':
        await logWebhookEvent(supabase, {
          eventType: event,
          requestId,
          payload: data,
          status: 'success',
          createdAt: timestamp,
        })
        break
      case 'transaction.analyzed':
      case 'transaction.allow':
      case 'transaction.verify':
      case 'transaction.block':
        await handleTransactionEvent(supabase, event, data, requestId)
        break
      default:
        await logWebhookEvent(supabase, {
          eventType: event,
          requestId,
          payload: data,
          status: 'success',
          createdAt: timestamp,
        })
    }

    return NextResponse.json({ success: true, request_id: requestId })
  } catch (error) {
    await logWebhookEvent(supabase, {
      eventType: 'webhook_error',
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown webhook processing error',
    })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
