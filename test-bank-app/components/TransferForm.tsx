'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'

interface TransferFormProps {
  onSuccess: () => void
}

export default function TransferForm({ onSuccess }: TransferFormProps) {
  const [formData, setFormData] = useState({
    recipient_account: '',
    recipient_name: '',
    amount: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [trustCheck, setTrustCheck] = useState<any>(null)
  const [showTrustWarning, setShowTrustWarning] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
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
          recipient: formData.recipient_account,
          transaction_type: 'transfer',
        }),
      })

      const checkData = await checkResponse.json()

      if (!checkResponse.ok) {
        setError(checkData.error || 'Transaction check failed')
        setIsLoading(false)
        return
      }

      setTrustCheck(checkData)

      // If verify or block, show the TrustLayer decision before moving money
      if (checkData.decision === 'verify' || checkData.decision === 'block') {
        setShowTrustWarning(true)
        setIsLoading(false)
        return
      }

      // Otherwise proceed with transfer
      await proceedWithTransfer()
    } catch (err) {
      setError('An error occurred. Please try again.')
      setIsLoading(false)
    }
  }

  const proceedWithTransfer = async () => {
    try {
      const response = await fetch('/api/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient_account: formData.recipient_account,
          recipient_name: formData.recipient_name || formData.recipient_account,
          amount: parseFloat(formData.amount),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Transfer failed')
        return
      }

      setSuccess(true)
      setFormData({ recipient_account: '', recipient_name: '', amount: '' })
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
      await proceedWithTransfer()
    } else {
      await handleTrustCheck(e)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="recipient_account" className="block text-sm font-medium dark:text-slate-300">
          Recipient Account Number
        </Label>
        <Input
          id="recipient_account"
          name="recipient_account"
          type="text"
          placeholder="e.g., 1234567890"
          required
          value={formData.recipient_account}
          onChange={handleChange}
          className="mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
        />
      </div>

      <div>
        <Label htmlFor="recipient_name" className="block text-sm font-medium dark:text-slate-300">
          Recipient Name (Optional)
        </Label>
        <Input
          id="recipient_name"
          name="recipient_name"
          type="text"
          placeholder="e.g., John Doe"
          value={formData.recipient_name}
          onChange={handleChange}
          className="mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
        />
      </div>

      <div>
        <Label htmlFor="amount" className="block text-sm font-medium dark:text-slate-300">
          Amount (₦)
        </Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          placeholder="0.00"
          required
          min="0"
          value={formData.amount}
          onChange={handleChange}
          className="mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded dark:bg-red-900 dark:border-red-700 dark:text-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded dark:bg-green-900 dark:border-green-700 dark:text-green-200">
          Transfer successful!
        </div>
      )}

      {trustCheck && !showTrustWarning && (
        <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded dark:bg-green-900 dark:border-green-700 dark:text-green-200">
          ✓ Transaction {trustCheck.decision}ed (risk score: {trustCheck.risk_score})
        </div>
      )}

      {showTrustWarning && trustCheck && (
        <div className="p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-200 space-y-2">
          <p className="font-semibold">⚠️ Risk Warning</p>
          <p className="text-sm">{trustCheck.ai_explanation || 'This transaction requires additional attention.'}</p>
          <p className="text-sm">Decision: <span className="font-semibold capitalize">{trustCheck.decision}</span></p>
          <p className="text-sm">Risk Score: <span className="font-semibold">{trustCheck.risk_score}</span></p>
        </div>
      )}

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
      >
        {isLoading ? 'Processing...' : showTrustWarning ? (trustCheck?.decision === 'block' ? 'Override and Send' : 'Verify and Send') : 'Send Transfer'}
      </Button>
    </form>
  )
}
