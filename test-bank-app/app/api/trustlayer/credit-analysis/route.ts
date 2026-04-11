import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTrustLayerClient } from '@/lib/trustlayer';

type CreditAnalysisResponse = {
  credit_score: number
  rating: string
  breakdown: Record<string, number>
  loan_eligibility: string
  improvement_tips: string[]
  request_id?: string
}

export async function GET(request: NextRequest) {
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
      .select('onboarded_at, trustlayer_customer_id, balance, phone_verified, bvn_hash')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.onboarded_at || !profile?.trustlayer_customer_id) {
      return NextResponse.json(
        { error: 'Customer not onboarded. Please complete onboarding first.' },
        { status: 400 }
      );
    }

    const { data: transactions } = await supabase
      .from('transactions')
      .select('type, amount, description, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    // Call TrustLayer credit analysis
    const trustlayer = getTrustLayerClient();
    const creditResponse = (await trustlayer.credit.analyze({
      customer_id: profile.trustlayer_customer_id,
      data_type: 'transaction_history',
      data: {
        current_balance: profile.balance,
        phone_verified: profile.phone_verified,
        bvn_verified: Boolean(profile.bvn_hash),
        transactions: transactions || [],
      },
    })) as CreditAnalysisResponse;

    // Store credit inquiry
    const { error: creditError } = await supabase.from('credit_inquiries').insert({
      user_id: user.id,
      credit_score: creditResponse.credit_score,
      response_data: creditResponse,
    });

    if (creditError) {
      console.error('[v0] Credit inquiry error:', creditError);
    }

    // Update profile with credit score
    await supabase
      .from('profiles')
      .update({
        credit_score: creditResponse.credit_score,
        last_trust_update: new Date().toISOString(),
      })
      .eq('id', user.id);

    // Log the inquiry
    await supabase.from('trust_logs').insert({
      user_id: user.id,
      event_type: 'credit_analyzed',
      details: {
        credit_score: creditResponse.credit_score,
        request_id: creditResponse.request_id,
      },
    });

    return NextResponse.json({
      success: true,
      credit_score: creditResponse.credit_score,
      rating: creditResponse.rating,
      breakdown: creditResponse.breakdown,
      loan_eligibility: creditResponse.loan_eligibility,
      improvement_tips: creditResponse.improvement_tips,
      request_id: creditResponse.request_id,
    });
  } catch (error) {
    console.error('[v0] Credit analysis error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Credit analysis failed',
      },
      { status: 500 }
    );
  }
}
