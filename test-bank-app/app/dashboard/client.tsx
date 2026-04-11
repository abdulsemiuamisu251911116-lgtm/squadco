'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import TransferForm from '@/components/TransferForm'
import ReceiveCard from '@/components/ReceiveCard'
import AirtimeForm from '@/components/AirtimeForm'
import TransactionHistory from '@/components/TransactionHistory'
import Navbar from '@/components/Navbar'
import ProfileInsights from '@/components/ProfileInsights'
import CreditInsights from '@/components/CreditInsights'
import AIAssistant from '@/components/AIAssistant'

interface Profile {
  id: string
  email: string
  account_number: string
  full_name: string | null
  balance: number
  phone: string | null
  role?: string
}

interface Transaction {
  id: string
  type: string
  amount: number
  description: string
  created_at: string
}

export default function DashboardClient({
  profile,
  transactions: initialTransactions,
  userEmail,
}: {
  profile: Profile
  transactions: Transaction[]
  userEmail: string
}) {
  const [balance, setBalance] = useState(profile.balance)
  const [transactions, setTransactions] = useState(initialTransactions)
  const [activeTab, setActiveTab] = useState('overview')
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const refreshData = async () => {
    // Fetch updated profile
    const { data: updatedProfile } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', profile.id)
      .single()

    if (updatedProfile) {
      setBalance(updatedProfile.balance)
    }

    // Fetch updated transactions
    const { data: updatedTransactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (updatedTransactions) {
      setTransactions(updatedTransactions)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar 
        email={userEmail} 
        role={profile.role} 
        onLogout={handleLogout}
        showAdminLink={true}
      />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Balance Card */}
        <div className="mb-8">
          <Card className="border-slate-200 dark:border-slate-700 dark:bg-slate-800">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Available Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold dark:text-white">₦{balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Account: {profile.account_number}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-7 dark:bg-slate-800 overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transfer">Transfer</TabsTrigger>
            <TabsTrigger value="receive">Receive</TabsTrigger>
            <TabsTrigger value="airtime">Airtime</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="credit">Credit</TabsTrigger>
            <TabsTrigger value="ai">AI Assistant</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card className="dark:bg-slate-800 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="dark:text-white">Recent Transactions</CardTitle>
                <CardDescription className="dark:text-slate-400">Your last 10 transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <TransactionHistory transactions={transactions} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transfer Tab */}
          <TabsContent value="transfer">
            <Card className="dark:bg-slate-800 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="dark:text-white">Send Money</CardTitle>
                <CardDescription className="dark:text-slate-400">Transfer funds to another account</CardDescription>
              </CardHeader>
              <CardContent>
                <TransferForm onSuccess={refreshData} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Receive Tab */}
          <TabsContent value="receive">
            <ReceiveCard accountNumber={profile.account_number} email={profile.email} />
          </TabsContent>

          {/* Airtime Tab */}
          <TabsContent value="airtime">
            <Card className="dark:bg-slate-800 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="dark:text-white">Buy Airtime</CardTitle>
                <CardDescription className="dark:text-slate-400">Purchase airtime for any network</CardDescription>
              </CardHeader>
              <CardContent>
                <AirtimeForm onSuccess={refreshData} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <ProfileInsights />
          </TabsContent>

          {/* Credit Tab */}
          <TabsContent value="credit">
            <CreditInsights />
          </TabsContent>

          {/* AI Assistant Tab */}
          <TabsContent value="ai" className="h-96">
            <AIAssistant />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
