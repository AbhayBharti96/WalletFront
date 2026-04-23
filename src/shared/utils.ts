import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import type { KycStatus, RewardSummary, RewardTier, Transaction, TxType } from '../types'
import { createElement } from 'react'
import type { ComponentType, CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Award,
  CircleCheck,
  CircleHelp,
  CircleX,
  CreditCard,
  FileText,
  Gem,
  Gift,
  Hourglass,
  Star,
  TrendingDown,
  TrendingUp,
  Wallet,
  ArrowRightLeft,
} from 'lucide-react'
dayjs.extend(relativeTime)

export type PayVaultIconProps = {
  fontSize?: 'inherit' | 'small' | 'medium' | 'large'
  className?: string
  style?: CSSProperties
}
export type PayVaultIcon = ComponentType<PayVaultIconProps>

const iconSizeForFont = (fontSize: PayVaultIconProps['fontSize']) => {
  if (fontSize === 'inherit') return '1em'
  if (fontSize === 'small') return 20
  if (fontSize === 'large') return 35
  return 24
}

const toPayVaultIcon = (Icon: LucideIcon): PayVaultIcon => ({ fontSize = 'medium', className, style }) =>
  createElement(Icon, {
    size: iconSizeForFont(fontSize),
    className,
    style,
    strokeWidth: 2.1,
  })

export const formatCurrency = (amount: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount || 0)

export const formatDate = (date?: string | null, fmt = 'DD MMM YYYY, hh:mm A') =>
  date ? dayjs(date).format(fmt) : '—'

export const timeAgo = (date?: string) => date ? dayjs(date).fromNow() : '—'

export const getTierStyle = (tier?: RewardTier | string) => ({
  SILVER: { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1', glow: 'none' },
  GOLD: { bg: '#fef9c3', text: '#a16207', border: '#fbbf24', glow: '0 0 12px rgba(251,191,36,0.4)' },
  PLATINUM: { bg: '#ede9fe', text: '#7c3aed', border: '#a78bfa', glow: '0 0 12px rgba(167,139,250,0.4)' },
}[tier as RewardTier] || { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1', glow: 'none' })

const TIER_ICONS: Partial<Record<RewardTier, PayVaultIcon>> = {
  SILVER: toPayVaultIcon(Star),
  GOLD: toPayVaultIcon(Star),
  PLATINUM: toPayVaultIcon(Gem),
}
const DEFAULT_TIER_ICON: PayVaultIcon = toPayVaultIcon(Award)

export const getTierIcon = (tier?: string): PayVaultIcon =>
  (tier ? TIER_ICONS[tier as RewardTier] ?? DEFAULT_TIER_ICON : DEFAULT_TIER_ICON)

const TIER_ORDER: RewardTier[] = ['SILVER', 'GOLD', 'PLATINUM']
const TIER_THRESHOLDS: Record<RewardTier, number> = {
  SILVER: 0,
  GOLD: 1000,
  PLATINUM: 5000,
}

export const getTierProgress = (summary?: RewardSummary | null) => {
  const currentTier = summary?.tier ?? 'SILVER'
  const points = summary?.points ?? 0
  const currentIndex = TIER_ORDER.indexOf(currentTier)
  const nextTier = TIER_ORDER[currentIndex + 1]
  const nextThreshold = nextTier ? TIER_THRESHOLDS[nextTier] : TIER_THRESHOLDS[currentTier]
  const remaining = nextTier ? Math.max(0, nextThreshold - points) : 0
  const percent = nextTier && nextThreshold > 0
    ? Math.max(0, Math.min(100, Math.round((points / nextThreshold) * 100)))
    : 100

  return {
    currentTier,
    nextTier,
    points,
    currentThreshold: TIER_THRESHOLDS[currentTier],
    nextThreshold,
    remaining,
    percent,
    scale: percent / 100,
  }
}

export const getKycInfo = (status?: KycStatus) => ({
  APPROVED: { label: 'KYC Verified', color: '#22c55e', bg: '#dcfce7', icon: toPayVaultIcon(CircleCheck) },
  PENDING: { label: 'KYC Under Review', color: '#f59e0b', bg: '#fef3c7', icon: toPayVaultIcon(Hourglass) },
  REJECTED: { label: 'KYC Rejected', color: '#ef4444', bg: '#fee2e2', icon: toPayVaultIcon(CircleX) },
  NOT_SUBMITTED: { label: 'KYC Not Submitted', color: '#6366f1', bg: '#ede9fe', icon: toPayVaultIcon(FileText) },
}[status ?? 'NOT_SUBMITTED'] || { label: 'Unknown', color: '#94a3b8', bg: '#f1f5f9', icon: toPayVaultIcon(CircleHelp) })

const TX_ICONS: Partial<Record<TxType, PayVaultIcon>> = {
  TOPUP: toPayVaultIcon(TrendingUp),
  TRANSFER: toPayVaultIcon(ArrowRightLeft),
  WITHDRAW: toPayVaultIcon(TrendingDown),
  CASHBACK: toPayVaultIcon(Wallet),
  REDEEM: toPayVaultIcon(Gift),
}
const DEFAULT_TX_ICON: PayVaultIcon = toPayVaultIcon(CreditCard)

export const getTxIcon = (type?: TxType): PayVaultIcon => (type ? TX_ICONS[type] ?? DEFAULT_TX_ICON : DEFAULT_TX_ICON)

export const isCredit = (type: TxType) => type === 'TOPUP' || type === 'CASHBACK'

export const isCreditForUser = (tx: Transaction, currentUserId?: number) => {
  if (tx.type === 'TRANSFER') return currentUserId != null && tx.receiverId === currentUserId
  if (tx.type === 'WITHDRAW' || tx.type === 'REDEEM') return false
  return isCredit(tx.type)
}

export const isTransactionForUser = (tx: Transaction, currentUserId?: number) => {
  if (currentUserId == null) return false
  return tx.senderId === currentUserId || tx.receiverId === currentUserId
}

export const getTransactionDisplayTitle = (tx: Transaction, currentUserId?: number) => {
  if (tx.type === 'TOPUP') {
    if (tx.status === 'PENDING') return 'Top-up pending'
    if (tx.status === 'CANCELLED') return 'Top-up cancelled'
    if (tx.status === 'FAILED') return 'Top-up failed'
    if (tx.status === 'SUCCESS') return 'Wallet top-up'
  }

  if (tx.type === 'TRANSFER' && currentUserId != null && tx.receiverId === currentUserId) {
    return 'RECEIVED'
  }
  return tx.type
}

export const getTransferCounterparty = (tx: Transaction, currentUserId?: number): string | null => {
  if (tx.type !== 'TRANSFER') return null

  if (currentUserId != null && tx.senderId === currentUserId && tx.receiverId != null) {
    return `To User #${tx.receiverId}`
  }

  if (currentUserId != null && tx.receiverId === currentUserId && tx.senderId != null) {
    return `From User #${tx.senderId}`
  }

  if (tx.receiverId != null) return `To User #${tx.receiverId}`
  if (tx.senderId != null) return `From User #${tx.senderId}`
  return null
}

export const generateKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

/** Points earned: 1 point per ₹100 topped up */
export const calcPoints = (amount: number) => Math.floor(amount / 100)

export const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max)
