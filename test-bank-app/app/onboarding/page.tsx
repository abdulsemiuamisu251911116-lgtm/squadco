import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OnboardingForm from '@/components/OnboardingForm'

export const metadata = {
  title: 'Onboarding - Hamduk Bank',
  description: 'Complete your identity verification with TrustLayer',
}

export default async function OnboardingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Check if user is already onboarded
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarded_at')
    .eq('id', user.id)
    .single()

  if (profile?.onboarded_at) {
    redirect('/dashboard')
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Hamduk Bank</h1>
          <p className="text-slate-400">Secure Onboarding</p>
        </div>
        <OnboardingForm />
      </div>
    </div>
  )
}
