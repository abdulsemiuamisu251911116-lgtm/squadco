'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import Link from 'next/link'

export default function SignUpSuccess() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="text-center mb-4">
            <h1 className="text-3xl font-bold text-white mb-2">Hamduk Bank</h1>
            <p className="text-slate-400 text-sm">Verify your email to continue</p>
          </div>
          <Card className="border-slate-700 bg-slate-800">
            <CardHeader>
              <CardTitle className="text-2xl text-white">Check Your Email</CardTitle>
              <CardDescription className="text-slate-400">
                We&apos;ve sent you a confirmation link
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="p-4 bg-slate-700 rounded-lg border border-slate-600">
                  <p className="text-sm text-slate-300">
                    We&apos;ve sent a confirmation email to your inbox. Click the link in the email to verify your account and proceed to onboarding.
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-200">What happens next:</h3>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-slate-400">
                    <li>Click the confirmation link in your email</li>
                    <li>You&apos;ll be redirected to complete your profile</li>
                    <li>Fill in your identity information for onboarding</li>
                    <li>Access your Hamduk Bank account</li>
                  </ol>
                </div>
              </div>

              <div className="text-center text-sm text-slate-400">
                Didn&apos;t receive the email? Check your spam folder or{' '}
                <Link href="/auth/sign-up" className="text-blue-400 hover:text-blue-300 underline">
                  try again
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
