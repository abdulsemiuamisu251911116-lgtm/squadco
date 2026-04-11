'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AirtimeFormProps {
  onSuccess: () => void
}

const PROVIDERS = [
  { name: 'MTN', code: 'mtn' },
  { name: 'Airtel', code: 'airtel' },
  { name: 'Glo', code: 'glo' },
  { name: '9Mobile', code: '9mobile' },
]

const AMOUNTS = [100, 200, 500, 1000, 2000, 5000]

export default function AirtimeForm({ onSuccess }: AirtimeFormProps) {
  const [formData, setFormData] = useState({
    phone_number: '',
    provider: 'mtn',
    amount: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [trustCheck, setTrustCheck] = useState<any>(null)
  const [showTrustWarning, setShowTrustWarning] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleQuickAmount = (amount: number) => {
    setFormData((prev) => ({
      ...prev,
      amount: amount.toString(),
    }))
  }

  const handleTrustCheck = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setTrustCheck(null)
    setShowTrustWarning(false)
    setIsLoading(true)

    try {
      // First check with TrustLayer
      const checkResponse = await fetch('/api/trustlayer/check-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parseFloat(formData.amount),
          recipient: formData.phone_number,
          transaction_type: 'airtime',
        }),
      })

      const checkData = await checkResponse.json()

      if (!checkResponse.ok) {
        // If not onboarded, skip the check and proceed
        if (checkData.error?.includes('not onboarded')) {
          await proceedWithAirtime()
          return
        }
        setError(checkData.error || 'Transaction check failed')
        setIsLoading(false)
        return
      }

      setTrustCheck(checkData)

      if (checkData.decision === 'verify' || checkData.decision === 'block') {
        setShowTrustWarning(true)
        setIsLoading(false)
        return
      }

      // Otherwise proceed with airtime
      await proceedWithAirtime()
    } catch (err) {
      // Continue without trust check if there's an error
      await proceedWithAirtime()
    }
  }

  const proceedWithAirtime = async () => {
    try {
      const response = await fetch('/api/airtime', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number: formData.phone_number,
          provider: formData.provider,
          amount: parseFloat(formData.amount),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Airtime purchase failed')
        return
      }

      setSuccess(true)
      setFormData({ phone_number: '', provider: 'mtn', amount: '' })
      setTrustCheck(null)
      setShowTrustWarning(false)
      onSuccess()

      // Reset success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    if (showTrustWarning && trustCheck) {
      await proceedWithAirtime()
    } else {
      await handleTrustCheck(e)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="phone_number" className="block text-sm font-medium dark:text-slate-300">
          Phone Number
        </Label>
        <Input
          id="phone_number"
          name="phone_number"
          type="tel"
          placeholder="e.g., 08012345678"
          required
          value={formData.phone_number}
          onChange={handleChange}
          className="mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
        />
      </div>

      <div>
        <Label htmlFor="provider" className="block text-sm font-medium dark:text-slate-300">
          Network Provider
        </Label>
        <select
          id="provider"
          name="provider"
          required
          value={formData.provider}
          onChange={handleChange}
          className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-500"
        >
          {PROVIDERS.map((provider) => (
            <option key={provider.code} value={provider.code}>
              {provider.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="amount" className="block text-sm font-medium dark:text-slate-300 mb-2">
          Amount (₦)
        </Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          step="10"
          placeholder="0.00"
          required
          min="0"
          value={formData.amount}
          onChange={handleChange}
          className="mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
        />
      </div>

      {/* Quick amount buttons */}
      <div className="grid grid-cols-3 gap-2">
        {AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => handleQuickAmount(amount)}
            className={`py-2 px-3 rounded text-sm font-medium transition-colors ${
              formData.amount === amount.toString()
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            ₦{amount}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded dark:bg-red-900 dark:border-red-700 dark:text-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded dark:bg-green-900 dark:border-green-700 dark:text-green-200">
          Airtime purchase successful!
        </div>
      )}

      {showTrustWarning && trustCheck && (
        <div className="p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-200 space-y-2">
          <p className="font-semibold">TrustLayer review</p>
          <p className="text-sm">{trustCheck.ai_explanation || 'This airtime request needs more attention.'}</p>
          <p className="text-sm">Decision: <span className="font-semibold capitalize">{trustCheck.decision}</span></p>
          <p className="text-sm">Risk Score: <span className="font-semibold">{trustCheck.risk_score}</span></p>
        </div>
      )}

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
      >
        {isLoading ? 'Processing...' : showTrustWarning ? 'Proceed Anyway' : 'Buy Airtime'}
      </Button>
    </form>
  )
}
