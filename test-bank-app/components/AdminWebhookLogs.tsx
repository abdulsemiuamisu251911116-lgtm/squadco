'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminWebhookLogs() {
  const [logs, setLogs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [registrationMessage, setRegistrationMessage] = useState<string | null>(null)
  const [registrationError, setRegistrationError] = useState<string | null>(null)

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/admin/webhook-logs')
      const data = await response.json()
      setLogs(data.logs || [])
    } catch (error) {
      console.error('[v0] Failed to fetch webhook logs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const handleRegisterWebhook = async () => {
    setRegistering(true)
    setRegistrationError(null)
    setRegistrationMessage(null)
    try {
      const response = await fetch('/api/trustlayer/register-webhook', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to register webhook')
      }
      setRegistrationMessage(`Webhook registered: ${data.webhook_id}`)
      await fetchLogs()
    } catch (error) {
      setRegistrationError(error instanceof Error ? error.message : 'Failed to register webhook')
    } finally {
      setRegistering(false)
    }
  }

  return (
    <Card className="dark:bg-slate-800 dark:border-slate-700">
      <CardHeader>
        <CardTitle className="dark:text-white">Webhook Logs</CardTitle>
        <CardDescription className="dark:text-slate-400">
          Monitor webhook events from TrustLayer
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRegisterWebhook}
            disabled={registering}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {registering ? 'Registering...' : 'Register TrustLayer Webhook'}
          </button>
          {registrationMessage ? <p className="text-sm text-green-400">{registrationMessage}</p> : null}
          {registrationError ? <p className="text-sm text-red-400">{registrationError}</p> : null}
        </div>
        {isLoading ? (
          <div className="text-center py-8 text-slate-400">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-slate-400">No webhook logs found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Event Type</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Request ID</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Status</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-slate-700 hover:bg-slate-700/50 transition"
                  >
                    <td className="py-3 px-4 text-slate-300">
                      <span className="px-2 py-1 bg-slate-700 rounded text-xs">
                        {log.event_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono text-xs">
                      {log.request_id?.substring(0, 8)}...
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          log.status === 'success'
                            ? 'bg-green-900/30 text-green-200'
                            : 'bg-red-900/30 text-red-200'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
