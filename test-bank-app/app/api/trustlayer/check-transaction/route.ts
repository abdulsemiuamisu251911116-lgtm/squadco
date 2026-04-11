import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTrustLayerClient } from '@/lib/trustlayer';

type TransactionCheckResponse = {
  decision: 'allow' | 'verify' | 'block'
  risk_score: number
  risk_factors: Array<Record<string, unknown>>
  ai_explanation: string
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
      .select('onboarded_at, trustlayer_customer_id, external_id, trust_score')
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
    const { amount, recipient, transaction_type } = body;

    if (!amount || !recipient || !transaction_type) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, recipient, transaction_type' },
        { status: 400 }
      );
    }

    // Call TrustLayer transaction analysis
    const trustlayer = getTrustLayerClient();
    const checkResponse = (await trustlayer.transaction.analyze({
      customer_id: profile.trustlayer_customer_id,
      amount: Math.round(Number(amount) * 100),
      currency: 'NGN', // Nigerian Naira
      merchant: recipient,
      location: 'Lagos',
      channel: transaction_type === 'transfer' ? 'web' : 'ussd',
    })) as TransactionCheckResponse;

    // Log the check
    await supabase.from('trust_logs').insert({
      user_id: user.id,
      event_type: 'transaction_checked',
      details: {
        transaction_type,
        amount,
        decision: checkResponse.decision,
        risk_score: checkResponse.risk_score,
        ai_explanation: checkResponse.ai_explanation,
        request_id: checkResponse.request_id,
      },
    });

    return NextResponse.json({
      success: true,
      decision: checkResponse.decision,
      risk_score: checkResponse.risk_score,
      risk_factors: checkResponse.risk_factors,
      ai_explanation: checkResponse.ai_explanation,
      request_id: checkResponse.request_id,
      trust_score: profile.trust_score,
    });
  } catch (error) {
    console.error('[v0] Transaction check error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Transaction check failed',
      },
      { status: 500 }
    );
  }
}
