import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTrustLayerClient } from '@/lib/trustlayer';
import crypto from 'crypto';

type OnboardingResponse = {
  customer_id: string
  trust_score: number
  credit_score: number
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

    // Get request body
    const body = await request.json();
    const { phone_number, bvn, full_name } = body;

    if (!phone_number || !bvn || !full_name) {
      return NextResponse.json(
        { error: 'Missing required fields: phone_number, bvn, full_name' },
        { status: 400 }
      );
    }

    // Parse full name into first and last name
    const nameParts = full_name.trim().split(' ');
    const first_name = nameParts[0];
    const last_name = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0];

    // Hash sensitive data
    const bvnHash = crypto.createHash('sha256').update(bvn).digest('hex');
    const phoneHash = crypto.createHash('sha256').update(phone_number).digest('hex');

    // Call TrustLayer customer registration (backend to backend)
    const trustlayer = getTrustLayerClient();
    const onboardingResponse = (await trustlayer.customer.register({
      external_id: user.id,
      bvn_hash: bvnHash,
      phone_hash: phoneHash,
    })) as OnboardingResponse;

    // Update user profile with TrustLayer registration data
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: full_name,
        bvn_hash: bvnHash,
        phone_hash: phoneHash,
        trustlayer_customer_id: onboardingResponse.customer_id,
        external_id: user.id, // external_id is the user's UUID in our system
        onboarded_at: new Date().toISOString(),
        phone_verified: true,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[v0] Profile update error:', updateError);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    // Log the onboarding event
    await supabase.from('webhook_logs').insert({
      user_id: user.id,
      event_type: 'onboarding_initiated',
      request_id: onboardingResponse.request_id,
      payload: {
        customer_id: onboardingResponse.customer_id,
        trust_score: onboardingResponse.trust_score,
        credit_score: onboardingResponse.credit_score,
      },
      status: 'success',
    });

    return NextResponse.json({
      success: true,
      customer_id: onboardingResponse.customer_id,
      request_id: onboardingResponse.request_id,
      trust_score: onboardingResponse.trust_score,
      credit_score: onboardingResponse.credit_score,
    });
  } catch (error) {
    console.error('[v0] Onboarding error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Onboarding failed',
      },
      { status: 500 }
    );
  }
}
