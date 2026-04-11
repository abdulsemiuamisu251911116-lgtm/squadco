import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
      // Check if user has completed onboarding
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarded_at')
        .eq('id', data.user.id)
        .single()

      // If onboarded, go to dashboard. Otherwise, go to onboarding.
      const redirectUrl = profile?.onboarded_at ? '/dashboard' : '/onboarding'
      return NextResponse.redirect(`${origin}${redirectUrl}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
