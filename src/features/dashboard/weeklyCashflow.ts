import type { Transaction } from '../../types'

export type WeeklyCashflowPoint = {
  d: string
  credit: number
  debit: number
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

const dateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const startOfWeek = (date: Date) => {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  const day = result.getDay()
  const diff = day === 0 ? -6 : 1 - day
  result.setDate(result.getDate() + diff)
  return result
}

const getTransactionFlow = (tx: Transaction, currentUserId?: number): 'credit' | 'debit' | null => {
  if (tx.status !== 'SUCCESS') return null
  if (tx.type === 'TOPUP' || tx.type === 'CASHBACK') return 'credit'
  if (tx.type === 'WITHDRAW' || tx.type === 'REDEEM') return 'debit'

  if (tx.type === 'TRANSFER') {
    if (currentUserId != null && tx.receiverId === currentUserId) return 'credit'
    return 'debit'
  }

  return null
}

export function buildWeeklyCashflow(
  transactions: Transaction[] = [],
  currentUserId?: number,
  today = new Date()
): WeeklyCashflowPoint[] {
  const weekStart = startOfWeek(today)
  const points = WEEKDAYS.map((day, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    return { d: day, credit: 0, debit: 0, key: dateKey(date) }
  })

  const indexByDate = new Map(points.map((point, index) => [point.key, index]))

  transactions.forEach((tx) => {
    const txDate = new Date(tx.createdAt)
    if (Number.isNaN(txDate.getTime())) return

    const index = indexByDate.get(dateKey(txDate))
    if (index == null) return

    const flow = getTransactionFlow(tx, currentUserId)
    if (!flow) return

    points[index][flow] += tx.amount
  })

  return points.map(({ d, credit, debit }) => ({ d, credit, debit }))
}
