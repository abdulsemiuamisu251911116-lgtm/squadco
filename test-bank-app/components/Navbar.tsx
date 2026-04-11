'use client'

import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface NavbarProps {
  email?: string
  role?: string
  onLogout?: () => void
  showAdminLink?: boolean
}

export default function Navbar({
  email,
  role,
  onLogout,
  showAdminLink = false,
}: NavbarProps) {
  return (
    <nav className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Hamduk Bank</h1>
        <div className="flex items-center gap-4">
          {role && (
            <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded">
              {role.toUpperCase()}
            </span>
          )}
          {showAdminLink && role === 'admin' && (
            <Link href="/admin">
              <Button
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                Admin Panel
              </Button>
            </Link>
          )}
          {email && <p className="text-sm text-slate-600 dark:text-slate-400">{email}</p>}
          {onLogout && (
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Logout
            </Button>
          )}
        </div>
      </div>
    </nav>
  )
}
