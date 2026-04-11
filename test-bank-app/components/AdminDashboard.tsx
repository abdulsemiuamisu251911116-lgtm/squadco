'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import Navbar from './Navbar'
import AdminUsersTable from './AdminUsersTable'
import AdminWebhookLogs from './AdminWebhookLogs'
import AdminAnalytics from './AdminAnalytics'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('users')
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/admin/stats')
        const data = await response.json()
        setStats(data)
      } catch (error) {
        console.error('[v0] Failed to fetch stats:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-800">
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-slate-400">Manage users, transactions, and system operations</p>
        </div>

        {/* Stats Cards */}
        {!isLoading && stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="dark:bg-slate-800 dark:border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Total Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{stats.total_users}</div>
                <p className="text-xs text-slate-400 mt-1">{stats.onboarded_users} onboarded</p>
              </CardContent>
            </Card>

            <Card className="dark:bg-slate-800 dark:border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Total Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{stats.total_transactions}</div>
                <p className="text-xs text-slate-400 mt-1">All time</p>
              </CardContent>
            </Card>

            <Card className="dark:bg-slate-800 dark:border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Webhook Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{stats.webhook_events}</div>
                <p className="text-xs text-slate-400 mt-1">Last 30 days</p>
              </CardContent>
            </Card>

            <Card className="dark:bg-slate-800 dark:border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Avg Trust Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{stats.avg_trust_score?.toFixed(2) || 'N/A'}</div>
                <p className="text-xs text-slate-400 mt-1">Across all users</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 dark:bg-slate-800">
            <TabsTrigger value="users">Users Management</TabsTrigger>
            <TabsTrigger value="webhooks">Webhook Logs</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <AdminUsersTable />
          </TabsContent>

          {/* Webhooks Tab */}
          <TabsContent value="webhooks">
            <AdminWebhookLogs />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <AdminAnalytics />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
