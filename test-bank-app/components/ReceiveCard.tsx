'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ReceiveCardProps {
  accountNumber: string
  email: string
}

export default function ReceiveCard({ accountNumber, email }: ReceiveCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <Card className="dark:bg-slate-800 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="dark:text-white">Your Account Details</CardTitle>
          <CardDescription className="dark:text-slate-400">Share these details to receive money</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Account Number */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Account Number</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-slate-100 dark:bg-slate-700 rounded font-mono text-sm dark:text-white">
                {accountNumber}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(accountNumber)}
                className="dark:border-slate-600 dark:text-slate-300"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Email</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-slate-100 dark:bg-slate-700 rounded font-mono text-sm dark:text-white">
                {email}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(email)}
                className="dark:border-slate-600 dark:text-slate-300"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* QR Code Placeholder */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Share Info</p>
            <div className="p-6 bg-slate-100 dark:bg-slate-700 rounded flex items-center justify-center min-h-40">
              <div className="text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">QR Code Placeholder</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">In production, a QR code would be displayed here</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900 rounded border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-200">
              Share your account number or email address with others to receive transfers directly to your Hamduk Bank account.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
