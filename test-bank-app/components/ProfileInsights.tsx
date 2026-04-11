'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';

interface ProfileData {
  profile: {
    email: string;
    full_name: string;
    account_number: string;
    balance: number;
    trust_score: number;
    credit_score: number;
    risk_tier?: string | null;
    total_transactions?: number | null;
    flagged_count?: number | null;
    is_verified: boolean;
    onboarding_status: string;
  };
  trustlayer: any;
  recent_transactions: any[];
  trust_logs: any[];
}

export default function ProfileInsights() {
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/trustlayer/profile');
        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }
        const data = await response.json();
        setProfileData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!profileData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-slate-500">No profile data available</p>
        </CardContent>
      </Card>
    );
  }

  const { profile, recent_transactions } = profileData;

  const getTrustScoreColor = (score: number) => {
    if (score >= 601) return 'text-green-600';
    if (score >= 301) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCreditScoreColor = (score: number) => {
    if (score >= 750) return 'text-green-600';
    if (score >= 650) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Account Overview */}
      <Card className="border-slate-700 bg-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Account Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-slate-400 text-sm">Full Name</p>
              <p className="text-white font-semibold">{profile.full_name || 'Not set'}</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Email</p>
              <p className="text-white font-semibold text-sm break-all">{profile.email}</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Account Number</p>
              <p className="text-white font-mono font-semibold">{profile.account_number}</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Balance</p>
              <p className="text-white font-semibold">₦{profile.balance.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trust & Credit Scores */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-slate-700 bg-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">Trust Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className={`text-4xl font-bold ${getTrustScoreColor(profile.trust_score)}`}>
                  {profile.trust_score}
                </p>
                <p className="text-slate-400 text-sm mt-2">out of 1000</p>
              </div>
              {profile.trust_score >= 601 ? (
                <CheckCircle className="h-12 w-12 text-green-500" />
              ) : profile.trust_score >= 301 ? (
                <AlertTriangle className="h-12 w-12 text-yellow-500" />
              ) : (
                <AlertCircle className="h-12 w-12 text-red-500" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-700 bg-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">Credit Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className={`text-4xl font-bold ${getCreditScoreColor(profile.credit_score)}`}>
                  {profile.credit_score || 'N/A'}
                </p>
                <p className="text-slate-400 text-sm mt-2">
                  {profile.credit_score ? 'out of 1000' : 'Not analyzed'}
                </p>
              </div>
              {profile.credit_score ? (
                profile.credit_score >= 750 ? (
                  <CheckCircle className="h-12 w-12 text-green-500" />
                ) : (
                  <AlertTriangle className="h-12 w-12 text-yellow-500" />
                )
              ) : (
                <AlertCircle className="h-12 w-12 text-slate-500" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Verification Status */}
      <Card className="border-slate-700 bg-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Verification Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Identity Verified</span>
            {profile.is_verified ? (
              <span className="flex items-center gap-2 text-green-500">
                <CheckCircle className="h-4 w-4" />
                Verified
              </span>
            ) : (
              <span className="flex items-center gap-2 text-yellow-500">
                <AlertCircle className="h-4 w-4" />
                Pending
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Onboarding Status</span>
            <span className="capitalize text-slate-400 text-sm">{profile.onboarding_status}</span>
          </div>
          {profile.risk_tier ? (
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Risk Tier</span>
              <span className="capitalize text-slate-400 text-sm">{profile.risk_tier}</span>
            </div>
          ) : null}
          {typeof profile.total_transactions === 'number' ? (
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Total Transactions</span>
              <span className="text-slate-400 text-sm">{profile.total_transactions}</span>
            </div>
          ) : null}
          {typeof profile.flagged_count === 'number' ? (
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Flagged Count</span>
              <span className="text-slate-400 text-sm">{profile.flagged_count}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      {recent_transactions && recent_transactions.length > 0 && (
        <Card className="border-slate-700 bg-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Recent Transactions</CardTitle>
            <CardDescription className="text-slate-400">Last 5 transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recent_transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 bg-slate-700 rounded-lg"
                >
                  <div>
                    <p className="text-white font-semibold capitalize">{tx.type}</p>
                    <p className="text-slate-400 text-sm">{tx.description}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${
                      tx.type === 'received' ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {tx.type === 'received' ? '+' : '-'}₦{Math.abs(tx.amount).toLocaleString()}
                    </p>
                    <p className="text-slate-400 text-xs">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
