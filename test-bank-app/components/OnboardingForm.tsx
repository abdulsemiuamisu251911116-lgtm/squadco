'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function OnboardingForm() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: '',
    bvn: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setIsLoading(true)

    // Validate inputs
    if (!formData.full_name || !formData.phone_number || !formData.bvn) {
      setError('All fields are required')
      setIsLoading(false)
      return
    }

    if (formData.bvn.length !== 11) {
      setError('BVN must be 11 digits')
      setIsLoading(false)
      return
    }

    if (formData.phone_number.length < 10) {
      setError('Please enter a valid phone number')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/trustlayer/onboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: formData.full_name,
          phone_number: formData.phone_number,
          bvn: formData.bvn,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Onboarding failed')
        setIsLoading(false)
        return
      }

      setSuccess(true)
      setFormData({ full_name: '', phone_number: '', bvn: '' })

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (err) {
      setError('An error occurred. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <Card className="border-slate-700 bg-slate-800">
        <CardHeader>
          <CardTitle className="text-2xl text-white">Verify Your Identity</CardTitle>
          <CardDescription className="text-slate-400">
            Complete onboarding with TrustLayer to unlock all features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded dark:bg-red-900 dark:border-red-700 dark:text-red-200 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded dark:bg-green-900 dark:border-green-700 dark:text-green-200 text-sm">
                Onboarding successful! Redirecting...
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="full_name" className="text-slate-300">
                Full Name
              </Label>
              <Input
                id="full_name"
                name="full_name"
                type="text"
                placeholder="John Doe"
                required
                value={formData.full_name}
                onChange={handleChange}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone_number" className="text-slate-300">
                Phone Number
              </Label>
              <Input
                id="phone_number"
                name="phone_number"
                type="tel"
                placeholder="08012345678"
                required
                value={formData.phone_number}
                onChange={handleChange}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bvn" className="text-slate-300">
                BVN (Bank Verification Number)
              </Label>
              <Input
                id="bvn"
                name="bvn"
                type="text"
                placeholder="12345678901"
                required
                value={formData.bvn}
                onChange={handleChange}
                maxLength={11}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
              />
              <p className="text-xs text-slate-400">11 digits required</p>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              {isLoading ? 'Processing...' : 'Complete Onboarding'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
