'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function AdminUsersTable() {
  const [users, setUsers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/admin/users')
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Failed to fetch users')
          return
        }

        setUsers(data.users)
      } catch (err) {
        setError('An error occurred')
        console.error('[v0] Failed to fetch users:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUsers()
  }, [])

  const toggleUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin'
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role: newRole }),
      })

      if (!response.ok) {
        setError('Failed to update user role')
        return
      }

      // Update local state
      setUsers(
        users.map((user) =>
          user.id === userId ? { ...user, role: newRole } : user
        )
      )
    } catch (err) {
      setError('An error occurred')
      console.error('[v0] Failed to update user:', err)
    }
  }

  return (
    <Card className="dark:bg-slate-800 dark:border-slate-700">
      <CardHeader>
        <CardTitle className="dark:text-white">Users</CardTitle>
        <CardDescription className="dark:text-slate-400">
          Manage user accounts and roles
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded dark:bg-red-900 dark:border-red-700 dark:text-red-200 mb-4">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8 text-slate-400">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-slate-400">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Email</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Name</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Role</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Onboarded</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Trust Score</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-slate-700 hover:bg-slate-700/50 transition"
                  >
                    <td className="py-3 px-4 text-slate-300">{user.email}</td>
                    <td className="py-3 px-4 text-slate-300">{user.full_name || 'N/A'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-3 py-1 rounded text-sm font-medium ${
                          user.role === 'admin'
                            ? 'bg-purple-900/30 text-purple-200'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {user.onboarded_at ? 'Yes' : 'No'}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {user.trust_score ? user.trust_score.toFixed(2) : 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        size="sm"
                        onClick={() => toggleUserRole(user.id, user.role)}
                        className="bg-slate-700 hover:bg-slate-600 text-white"
                      >
                        {user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                      </Button>
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
