import type { UserProfile, WalletBalance } from '../types'

export const isBlockedStatus = (status?: UserProfile['status'] | WalletBalance['status'] | null) =>
  status === 'BLOCKED'

export const isWalletBlocked = (user?: UserProfile | null, balance?: WalletBalance | null) =>
  isBlockedStatus(user?.status) || isBlockedStatus(balance?.status)

export const getWalletBlockedMessage = () =>
  'Wallet is blocked. Transactions are disabled. Please contact support or the admin team.'
