import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTrustLayerClient } from '@/lib/trustlayer';

type TrustLayerProfileResponse = {
  trust_score: number
  credit_score: number
  risk_tier: string
  total_transactions: number
  flagged_count: number
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

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // If customer is onboarded, fetch their profile from TrustLayer
    let trustlayerData = null;
    if (profile.onboarded_at) {
      try {
        const trustlayer = getTrustLayerClient();
        trustlayerData = (await trustlayer.customer.getProfile(user.id)) as TrustLayerProfileResponse;
      } catch (e) {
        console.error('[v0] TrustLayer profile fetch error:', e);
        // Continue without TrustLayer data
      }
    }

    // Get recent transactions
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    // Get recent trust logs
    const { data: trustLogs } = await supabase
      .from('trust_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        account_number: profile.account_number,
        balance: profile.balance,
        is_verified: profile.is_verified,
        trust_score: trustlayerData?.trust_score ?? profile.trust_score,
        credit_score: trustlayerData?.credit_score ?? profile.credit_score,
        risk_tier: trustlayerData?.risk_tier ?? null,
        total_transactions: trustlayerData?.total_transactions ?? null,
        flagged_count: trustlayerData?.flagged_count ?? null,
        onboarding_status: profile.onboarding_status,
        trustlayer_customer_id: profile.trustlayer_customer_id,
        last_trust_update: profile.last_trust_update,
      },
      trustlayer: trustlayerData,
      recent_transactions: transactions,
      trust_logs: trustLogs,
    });
  } catch (error) {
    console.error('[v0] Profile fetch error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch profile',
      },
      { status: 500 }
    );
  }
}
