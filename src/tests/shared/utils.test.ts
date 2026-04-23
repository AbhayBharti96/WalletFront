import { describe, expect, it } from 'vitest'
import {
  calcPoints,
  clamp,
  formatCurrency,
  getKycInfo,
  getTierProgress,
  getTierStyle,
  getTransactionDisplayTitle,
  getTransferCounterparty,
  isCredit,
  isCreditForUser,
  isTransactionForUser,
} from '@/shared/utils'
import type { Transaction } from '@/types'

describe('shared/utils', () => {
  it('formats INR currency in en-IN style', () => {
    const formatted = formatCurrency(33501)
    expect(formatted).toContain('₹')
    expect(formatted).toContain('33,501')
  })

  it('returns silver fallback style for unknown tier', () => {
    const style = getTierStyle('BRONZE')
    expect(style.text).toBe('#64748b')
    expect(style.border).toBe('#cbd5e1')
  })

  it('calculates tier progress from fixed thresholds', () => {
    const progress = getTierProgress({ userId: 1, points: 997, tier: 'GOLD' })

    expect(progress.currentTier).toBe('GOLD')
    expect(progress.nextTier).toBe('PLATINUM')
    expect(progress.nextThreshold).toBe(5000)
    expect(progress.remaining).toBe(4003)
    expect(progress.percent).toBe(20)
  })

  it('returns KYC fallback when status is missing', () => {
    const info = getKycInfo(undefined)
    expect(info.label).toBe('KYC Not Submitted')
    expect(info.color).toBe('#6366f1')
  })

  it('identifies credit transaction types', () => {
    expect(isCredit('TOPUP')).toBe(true)
    expect(isCredit('CASHBACK')).toBe(true)
    expect(isCredit('WITHDRAW')).toBe(false)
  })

  it('treats incoming transfers as credit for the receiver only', () => {
    const incomingTransfer: Transaction = {
      id: 1,
      senderId: 3,
      receiverId: 9,
      amount: 200,
      status: 'SUCCESS',
      type: 'TRANSFER',
      createdAt: new Date().toISOString(),
    }
    const outgoingTransfer: Transaction = {
      ...incomingTransfer,
      id: 2,
      senderId: 9,
      receiverId: 3,
    }

    expect(isCreditForUser(incomingTransfer, 9)).toBe(true)
    expect(isCreditForUser(outgoingTransfer, 9)).toBe(false)
  })

  it('treats transfers without current-user ownership as debit by default', () => {
    const tx: Transaction = {
      id: 11,
      senderId: 1,
      receiverId: 3,
      amount: 200,
      status: 'SUCCESS',
      type: 'TRANSFER',
      createdAt: new Date().toISOString(),
    }

    expect(isCreditForUser(tx)).toBe(false)
  })

  it('builds transfer counterparty labels', () => {
    const tx: Transaction = {
      id: 5,
      senderId: 10,
      receiverId: 20,
      amount: 100,
      status: 'SUCCESS',
      type: 'TRANSFER',
      createdAt: new Date().toISOString(),
    }
    expect(getTransferCounterparty(tx, 10)).toBe('To User #20')
    expect(getTransferCounterparty(tx, 20)).toBe('From User #10')
    expect(getTransferCounterparty(tx)).toBe('To User #20')
  })

  it('checks whether a transaction belongs to the logged-in user', () => {
    const tx: Transaction = {
      id: 20,
      senderId: 1,
      receiverId: 2,
      amount: 100,
      status: 'SUCCESS',
      type: 'TRANSFER',
      createdAt: new Date().toISOString(),
    }

    expect(isTransactionForUser(tx, 1)).toBe(true)
    expect(isTransactionForUser(tx, 2)).toBe(true)
    expect(isTransactionForUser(tx, 3)).toBe(false)
    expect(isTransactionForUser(tx)).toBe(false)
  })

  it('labels incoming transfers as received for the receiver', () => {
    const tx: Transaction = {
      id: 21,
      senderId: 1,
      receiverId: 2,
      amount: 100,
      status: 'SUCCESS',
      type: 'TRANSFER',
      createdAt: new Date().toISOString(),
    }

    expect(getTransactionDisplayTitle(tx, 2)).toBe('RECEIVED')
    expect(getTransactionDisplayTitle(tx, 1)).toBe('TRANSFER')
    expect(getTransactionDisplayTitle({ ...tx, type: 'TOPUP' }, 2)).toBe('Wallet top-up')
    expect(getTransactionDisplayTitle({ ...tx, type: 'TOPUP', status: 'PENDING' }, 2)).toBe('Top-up pending')
    expect(getTransactionDisplayTitle({ ...tx, type: 'TOPUP', status: 'CANCELLED' }, 2)).toBe('Top-up cancelled')
    expect(getTransactionDisplayTitle({ ...tx, type: 'TOPUP', status: 'FAILED' }, 2)).toBe('Top-up failed')
  })

  it('calculates points at 1 point per 100 amount', () => {
    expect(calcPoints(99)).toBe(0)
    expect(calcPoints(100)).toBe(1)
    expect(calcPoints(2550)).toBe(25)
  })

  it('clamps number within range', () => {
    expect(clamp(5, 1, 10)).toBe(5)
    expect(clamp(-1, 1, 10)).toBe(1)
    expect(clamp(22, 1, 10)).toBe(10)
  })
})
