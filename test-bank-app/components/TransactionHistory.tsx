'use client'

interface Transaction {
  id: string
  type: string
  amount: number
  description: string
  created_at: string
}

interface TransactionHistoryProps {
  transactions: Transaction[]
}

export default function TransactionHistory({ transactions }: TransactionHistoryProps) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-500 dark:text-slate-400">No transactions yet</p>
      </div>
    )
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'transfer_sent':
        return '↑'
      case 'transfer_received':
        return '↓'
      case 'airtime':
        return '📱'
      default:
        return '•'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'transfer_sent':
        return 'text-red-600 dark:text-red-400'
      case 'transfer_received':
        return 'text-green-600 dark:text-green-400'
      case 'airtime':
        return 'text-orange-600 dark:text-orange-400'
      default:
        return 'text-slate-600 dark:text-slate-400'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return `Today at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className="space-y-3">
      {transactions.map((transaction) => (
        <div
          key={transaction.id}
          className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600"
        >
          <div className="flex items-center gap-3 flex-1">
            <div className={`text-lg font-bold ${getTypeColor(transaction.type)}`}>
              {getTypeIcon(transaction.type)}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium dark:text-white">{transaction.description}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatDate(transaction.created_at)}
              </p>
            </div>
          </div>
          <div className={`text-right font-semibold ${getTypeColor(transaction.type)}`}>
            {transaction.type === 'transfer_received' ? '+' : '-'}₦
            {transaction.amount.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
