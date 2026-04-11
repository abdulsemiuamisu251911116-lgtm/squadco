'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminAnalytics() {
  const [analytics, setAnalytics] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch('/api/admin/analytics')
        const data = await response.json()
        setAnalytics(data)
      } catch (error) {
        console.error('[v0] Failed to fetch analytics:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAnalytics()
  }, [])

  if (isLoading) {
    return (
      <Card className="dark:bg-slate-800 dark:border-slate-700">
        <CardContent className="py-8">
          <div className="text-center text-slate-400">Loading analytics...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Transaction Analytics */}
      <Card className="dark:bg-slate-800 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="dark:text-white">Transaction Analytics</CardTitle>
          <CardDescription className="dark:text-slate-400">
            Overview of all transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-slate-400 text-sm">Transfers</p>
              <p className="text-2xl font-bold text-white mt-1">
                {analytics?.transfer_count || 0}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Airtime Purchases</p>
              <p className="text-2xl font-bold text-white mt-1">
                {analytics?.airtime_count || 0}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Total Volume</p>
              <p className="text-2xl font-bold text-white mt-1">
                ₦{analytics?.total_volume?.toLocaleString() || '0'}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Avg Transaction</p>
              <p className="text-2xl font-bold text-white mt-1">
                ₦{analytics?.avg_transaction?.toLocaleString() || '0'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trust Score Distribution */}
      <Card className="dark:bg-slate-800 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="dark:text-white">Trust Score Distribution</CardTitle>
          <CardDescription className="dark:text-slate-400">
            User trust scores breakdown
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {['Excellent (800+)', 'Good (600-799)', 'Fair (400-599)', 'Poor (<400)'].map(
              (category, idx) => {
                const counts = [
                  analytics?.excellent_trust_count || 0,
                  analytics?.good_trust_count || 0,
                  analytics?.fair_trust_count || 0,
                  analytics?.poor_trust_count || 0,
                ]
                const total = counts.reduce((a, b) => a + b, 0)
                const percentage =
                  total > 0 ? Math.round((counts[idx] / total) * 100) : 0

                return (
                  <div key={category}>
                    <div className="flex justify-between mb-1">
                      <p className="text-slate-300 text-sm">{category}</p>
                      <p className="text-slate-400 text-sm">{percentage}%</p>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-slate-400 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                )
              }
            )}
          </div>
        </CardContent>
      </Card>

      {/* Risk Distribution */}
      <Card className="dark:bg-slate-800 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="dark:text-white">Transaction Risk Analysis</CardTitle>
          <CardDescription className="dark:text-slate-400">
            Transaction risk distribution
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-slate-400 text-sm">Low Risk</p>
              <p className="text-3xl font-bold text-green-400 mt-2">
                {analytics?.low_risk_count || 0}
              </p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">Medium Risk</p>
              <p className="text-3xl font-bold text-yellow-400 mt-2">
                {analytics?.medium_risk_count || 0}
              </p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">High Risk</p>
              <p className="text-3xl font-bold text-red-400 mt-2">
                {analytics?.high_risk_count || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
