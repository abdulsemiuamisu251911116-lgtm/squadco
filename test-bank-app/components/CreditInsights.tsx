'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle, TrendingUp } from 'lucide-react';

export default function CreditInsights() {
  const [loading, setLoading] = useState(false);
  const [creditData, setCreditData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyzeCredit = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/trustlayer/credit-analysis');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze credit');
      }
      const data = await response.json();
      setCreditData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="text-red-700 font-semibold">Credit Analysis Failed</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!creditData) {
    return (
      <Card className="border-slate-700 bg-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Credit Analysis</CardTitle>
          <CardDescription className="text-slate-400">
            Analyze your creditworthiness and get personalized recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleAnalyzeCredit}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Analyzing...
              </>
            ) : (
              'Analyze Credit'
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const getRatingColor = (rating: string) => {
    if (rating === 'Excellent' || rating === 'Good') return 'text-green-500';
    if (rating === 'Fair') return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Credit Score & Grade */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-slate-700 bg-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">Credit Score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-bold text-blue-500">{creditData.credit_score}</p>
            <p className="text-slate-400 text-sm mt-2">out of 850</p>
          </CardContent>
        </Card>

        <Card className="border-slate-700 bg-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${getRatingColor(creditData.rating)}`}>
              {creditData.rating}
            </p>
            <p className="text-slate-400 text-sm mt-2">Overall rating</p>
          </CardContent>
        </Card>
      </div>

      {/* Loan Eligibility */}
      <Card className="border-slate-700 bg-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Loan Eligibility</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-green-500">{creditData.loan_eligibility}</p>
          <p className="mt-2 text-sm text-slate-400">Generated from TrustLayer credit analysis.</p>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {creditData.improvement_tips && creditData.improvement_tips.length > 0 && (
        <Card className="border-slate-700 bg-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Improvement Tips</CardTitle>
            <CardDescription className="text-slate-400">
              Personalized tips to improve your credit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {creditData.improvement_tips.map((rec: string, idx: number) => (
                <div key={idx} className="flex gap-3 p-3 bg-slate-700 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-300 text-sm">{rec}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Breakdown */}
      <Card className="border-slate-700 bg-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Credit Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(creditData.breakdown || {}).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 capitalize">{key.replace(/_/g, ' ')}</span>
                <span className="text-slate-400 text-sm">{Number(value)}/100</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.max(0, Math.min(Number(value), 100))}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
