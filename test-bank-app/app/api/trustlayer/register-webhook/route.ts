import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { getTrustLayerClient } from '@/lib/trustlayer'

const DEFAULT_EVENTS = [
  'webhook.test',
  'transaction.analyzed',
  'transaction.allow',
  'transaction.verify',
  'transaction.block',
]

type WebhookRegistrationResponse = {
  webhook_id: string
  request_id?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const webhookSecret = process.env.TRUSTLAYER_WEBHOOK_SECRET
    if (!webhookSecret) {
      return NextResponse.json({ error: 'TRUSTLAYER_WEBHOOK_SECRET is not configured' }, { status: 500 })
    }

    const origin = request.nextUrl.origin
    const webhookUrl = `${origin}/api/webhooks/trustlayer`
    const trustlayer = getTrustLayerClient()
    const registration = (await trustlayer.webhooks.register({
      url: webhookUrl,
      events: DEFAULT_EVENTS,
      secret: webhookSecret,
    })) as WebhookRegistrationResponse

    await supabase.from('webhook_logs').insert({
      event_type: 'webhook_registration',
      request_id: registration.request_id ?? registration.webhook_id ?? null,
      payload: {
        webhook_id: registration.webhook_id,
        url: webhookUrl,
        events: DEFAULT_EVENTS,
      },
      status: 'success',
    })

    return NextResponse.json({
      success: true,
      webhook_id: registration.webhook_id,
      url: webhookUrl,
      events: DEFAULT_EVENTS,
      request_id: registration.request_id,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to register TrustLayer webhook' },
      { status: 500 }
    )
  }
}
