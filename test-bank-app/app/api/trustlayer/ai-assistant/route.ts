import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type AssistantChatResponse = {
  reply: string
  suggested_actions?: string[]
  request_id?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile with onboarding status
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('onboarded_at, trustlayer_customer_id, balance, full_name, trust_score, credit_score')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.onboarded_at || !profile?.trustlayer_customer_id) {
      return NextResponse.json(
        { error: 'Customer not onboarded. Please complete onboarding first.' },
        { status: 400 }
      );
    }

    // Get request body
    const body = await request.json();
    const { message, conversation_history } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Missing required field: message' },
        { status: 400 }
      );
    }

    const { data: recentTransactions } = await supabase
      .from('transactions')
      .select('type, amount, description, recipient_name, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: latestCreditInquiry } = await supabase
      .from('credit_inquiries')
      .select('response_data')
      .eq('user_id', user.id)
      .order('inquiry_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: latestFlaggedLog } = await supabase
      .from('trust_logs')
      .select('details')
      .eq('user_id', user.id)
      .eq('event_type', 'transaction_checked')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const baseUrl = process.env.TRUSTLAYER_API_URL?.replace(/\/+$/, '').replace(/\/v1$/, '');
    const apiKey = process.env.TRUSTLAYER_API_KEY;
    if (!baseUrl || !apiKey) {
      return NextResponse.json({ error: 'TrustLayer environment is not configured' }, { status: 500 });
    }

    const response = await fetch(`${baseUrl}/v1/assistant/chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-trustlayer-key': apiKey,
      },
      body: JSON.stringify({
        customer_id: profile.trustlayer_customer_id,
        message,
        history: conversation_history || [],
        context: {
          current_balance: Number(profile.balance || 0),
          available_balance: Number(profile.balance || 0),
          customer_name: profile.full_name || user.email || 'Customer',
          recent_transactions: (recentTransactions || []).map((tx) => ({
            amount: Number(tx.amount || 0),
            type: tx.type,
            description: tx.description,
            merchant: tx.recipient_name || tx.description,
            created_at: tx.created_at,
          })),
          credit_breakdown: ((latestCreditInquiry?.response_data as { breakdown?: Record<string, number> } | null)?.breakdown) || {},
          last_flag_reason: ((latestFlaggedLog?.details as { ai_explanation?: string } | null)?.ai_explanation) || undefined,
        },
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `TrustLayer request failed with status ${response.status}`);
    }

    const raw = (await response.json()) as { request_id?: string; data?: AssistantChatResponse };
    const aiResponse = (raw.data
      ? { ...raw.data, request_id: raw.request_id ?? raw.data.request_id }
      : raw) as AssistantChatResponse;

    // Log the interaction
    await supabase.from('trust_logs').insert({
      user_id: user.id,
      event_type: 'ai_interaction',
      details: {
        message_length: message.length,
        response_length: aiResponse.reply?.length || 0,
        request_id: aiResponse.request_id,
      },
    });

    return NextResponse.json({
      success: true,
      reply: aiResponse.reply,
      suggested_actions: aiResponse.suggested_actions,
      request_id: aiResponse.request_id,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[v0] AI assistant error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'AI assistant request failed',
      },
      { status: 500 }
    );
  }
}
