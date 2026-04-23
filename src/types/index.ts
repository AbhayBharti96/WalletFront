// ─── Auth ─────────────────────────────────────────────────────────────────────
export type UserRole = 'USER' | 'ADMIN' | 'MERCHANT'
export type KycStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'NOT_SUBMITTED'
export type AccountStatus = 'ACTIVE' | 'BLOCKED' | 'INACTIVE'

export interface UserProfile {
  id: number
  fullName: string
  email: string
  phone?: string
  role: UserRole
  kycStatus?: KycStatus
  status?: AccountStatus
  createdAt?: string
}

export interface ReceiverSuggestion {
  id: number
  name: string
  email: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  user: UserProfile
}

export interface LoginRequest { email: string; password: string }
export interface SignupRequest { fullName: string; email: string; phone: string; password: string }
export interface VerifyOtpRequest { email: string; otp: string }

// ─── Wallet ───────────────────────────────────────────────────────────────────
export type TxStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REVERSED' | 'CANCELLED'
export type TxType = 'TOPUP' | 'TRANSFER' | 'WITHDRAW' | 'CASHBACK' | 'REDEEM'
export type LedgerType = 'CREDIT' | 'DEBIT'

export interface WalletBalance {
  userId: number
  balance: number
  status: AccountStatus
  lastUpdated: string
}

export interface Transaction {
  id: number
  senderId?: number
  receiverId?: number
  amount: number
  status: TxStatus
  type: TxType
  referenceId?: string
  idempotencyKey?: string
  description?: string
  createdAt: string
}

export interface LedgerEntry {
  id: number
  userId: number
  type: LedgerType
  amount: number
  referenceId?: string
  description?: string
  createdAt: string
}

export interface PageResponse<T> {
  content: T[]
  totalPages: number
  totalElements: number
  number: number
  size: number
  first: boolean
  last: boolean
}

export interface TransferRequest {
  receiverId: number
  amount: number
  idempotencyKey?: string
  description?: string
}

export interface RazorpayOrder {
  id: string
  /** Some backends mirror Razorpay’s id under this key */
  orderId?: string
  amount: number
  currency: string
  receipt?: string
}

// ─── Rewards ──────────────────────────────────────────────────────────────────
export type RewardTier = 'SILVER' | 'GOLD' | 'PLATINUM'
export type RewardItemType = 'CASHBACK' | 'COUPON' | 'VOUCHER'
export type RewardTxType = 'EARN' | 'BONUS' | 'REDEEM' | 'EXPIRE'
export type RedemptionStatus = 'COMPLETED' | 'REVERSED'

export interface RewardSummary {
  userId: number
  points: number
  tier: RewardTier
  nextTier?: RewardTier
  pointsToNextTier?: number
}

export interface RewardItem {
  id: number
  name: string
  description?: string
  pointsRequired: number
  type: RewardItemType
  cashbackAmount?: number
  tierRequired?: RewardTier
  stock: number
  active: boolean
  activeFrom?: string | null
  activeUntil?: string | null
}

export interface RewardItemPayload {
  name: string
  description?: string
  pointsRequired: number
  type: RewardItemType
  cashbackAmount?: number | null
  tierRequired?: RewardTier | null
  stock: number
  active?: boolean
  activeFrom?: string | null
  activeUntil?: string | null
}

export interface RewardTransaction {
  id: number
  userId: number
  points: number
  type: RewardTxType
  description?: string
  expiryDate?: string
  createdAt: string
}

export interface Redemption {
  id: number
  userId: number
  rewardId: number
  pointsUsed: number
  status: RedemptionStatus
  couponCode?: string
  redeemedAt: string
}

// ─── KYC ──────────────────────────────────────────────────────────────────────
export type DocType = 'AADHAAR' | 'PAN' | 'PASSPORT' | 'DRIVING_LICENSE'

export interface KycStatusResponse {
  kycId: number
  userId: number
  userName?: string
  userEmail?: string
  docType: DocType
  docNumber: string
  docFilePath?: string
  status: KycStatus
  rejectionReason?: string
  submittedAt: string
  updatedAt?: string
}

// ─── Admin ────────────────────────────────────────────────────────────────────
export interface AdminUserResponse {
  id: number
  name: string
  email: string
  phone?: string
  status: AccountStatus
  role: UserRole
  kycStatus: KycStatus
  createdAt: string
  updatedAt?: string
}

export interface AdminDashboard {
  totalUsers: number
  activeUsers: number
  blockedUsers: number
  newUsersToday: number
  newUsersThisWeek: number
  newUsersThisMonth: number
  regularUsers: number
  adminUsers: number
  merchantUsers: number
  kycPending: number
  kycApproved: number
  kycRejected: number
  kycNotSubmitted: number
  kycApprovedToday: number
  kycRejectedToday: number
}

// ─── Notifications ────────────────────────────────────────────────────────────
export type NotifType = 'success' | 'error' | 'warning' | 'info'

export interface Notification {
  id: number
  type: NotifType
  title: string
  message: string
  read: boolean
  time: string
}

// ─── Scratch Card ─────────────────────────────────────────────────────────────
export interface ScratchCardProps {
  points: number
  transactionAmount: number
  onRevealed: (points: number) => void
  onClose: () => void
}

// ─── API Wrappers ─────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
  timestamp: string
}

// ─── Razorpay global types ─────────────────────────────────────────────────────
declare global {
  interface Window {
    Razorpay: new (opts: RazorpayOptions) => RazorpayInstance
  }
}

export interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  order_id: string
  name: string
  description?: string
  image?: string
  handler: (response: RazorpayPaymentResponse) => void
  prefill?: { name?: string; email?: string; contact?: string }
  notes?: Record<string, string>
  theme?: { color?: string; hide_topbar?: boolean }
  modal?: { ondismiss?: () => void }
}

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

export interface RazorpayInstance {
  open(): void
  close(): void
  on(event: string, handler: (response?: any) => void): void
}
