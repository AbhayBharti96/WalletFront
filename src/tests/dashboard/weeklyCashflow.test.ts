import { describe, expect, it } from 'vitest'
import { buildWeeklyCashflow } from '@/features/dashboard/weeklyCashflow'
import type { Transaction } from '@/types'

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: Math.floor(Math.random() * 100000),
  amount: 0,
  status: 'SUCCESS',
  type: 'TOPUP',
  createdAt: '2026-04-13T10:00:00.000Z',
  ...overrides,
})

describe('buildWeeklyCashflow', () => {
  it('groups successful credit and debit transactions by current week day', () => {
    const data = buildWeeklyCashflow([
      tx({ type: 'TOPUP', amount: 500, createdAt: '2026-04-13T08:00:00.000Z' }),
      tx({ type: 'CASHBACK', amount: 50, createdAt: '2026-04-13T09:00:00.000Z' }),
      tx({ type: 'WITHDRAW', amount: 200, createdAt: '2026-04-14T08:00:00.000Z' }),
      tx({ type: 'REDEEM', amount: 100, createdAt: '2026-04-14T09:00:00.000Z' }),
      tx({ type: 'TRANSFER', receiverId: 7, senderId: 2, amount: 300, createdAt: '2026-04-15T08:00:00.000Z' }),
      tx({ type: 'TRANSFER', receiverId: 2, senderId: 7, amount: 125, createdAt: '2026-04-15T09:00:00.000Z' }),
    ], 7, new Date('2026-04-16T12:00:00.000Z'))

    expect(data).toEqual([
      { d: 'Mon', credit: 550, debit: 0 },
      { d: 'Tue', credit: 0, debit: 300 },
      { d: 'Wed', credit: 300, debit: 125 },
      { d: 'Thu', credit: 0, debit: 0 },
      { d: 'Fri', credit: 0, debit: 0 },
      { d: 'Sat', credit: 0, debit: 0 },
      { d: 'Sun', credit: 0, debit: 0 },
    ])
  })

  it('ignores failed transactions and transactions outside the selected week', () => {
    const data = buildWeeklyCashflow([
      tx({ type: 'TOPUP', amount: 500, status: 'FAILED', createdAt: '2026-04-13T08:00:00.000Z' }),
      tx({ type: 'TOPUP', amount: 800, createdAt: '2026-04-20T08:00:00.000Z' }),
    ], 7, new Date('2026-04-16T12:00:00.000Z'))

    expect(data.every(point => point.credit === 0 && point.debit === 0)).toBe(true)
  })
})
