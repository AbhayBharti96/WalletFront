import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import type {
  ApiResponse, AuthResponse, LoginRequest, SignupRequest, VerifyOtpRequest,
  WalletBalance, Transaction, LedgerEntry, PageResponse, TransferRequest,
  RazorpayOrder, RewardSummary, RewardItem, RewardTransaction, Redemption,
  KycStatusResponse, DocType, AdminDashboard, AdminUserResponse, UserProfile,
  ReceiverSuggestion, RewardItemPayload,
} from '../types'
import { notifyTokensRefreshed } from './authSync'

const BASE = import.meta.env.VITE_API_BASE_URL

if (!BASE && import.meta.env.PROD) {
  console.error('VITE_API_BASE_URL is not set. API calls will fail.')
}

const apiBaseUrl = BASE || 'http://localhost:8080'
const ngrokHeaders = apiBaseUrl.includes('ngrok')
  ? { 'ngrok-skip-browser-warning': 'true' }
  : undefined

/** Clears persisted auth in both storages (session + remember-me). */
export function clearClientAuth(): void {
  sessionStorage.clear()
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
  localStorage.removeItem('loginAt')
}

// ── Axios instances ──────────────────────────────────────────────────────────
export const api: AxiosInstance = axios.create({ baseURL: apiBaseUrl, timeout: 15000, headers: ngrokHeaders })
export const authApi: AxiosInstance = axios.create({ baseURL: apiBaseUrl, timeout: 15000, headers: ngrokHeaders })

// ── Auth token helpers ────────────────────────────────────────────────────────
const getToken = () => sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken')
const getRefreshToken = () => sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken')

const saveTokens = (access: string, refresh: string) => {
  sessionStorage.setItem('accessToken', access)
  sessionStorage.setItem('refreshToken', refresh)
}

// ── Request interceptor ───────────────────────────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response interceptor with silent token refresh ────────────────────────────
let isRefreshing = false
let queue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = []

const processQueue = (err: unknown, token?: string) => {
  queue.forEach(p => (err ? p.reject(err) : p.resolve(token!)))
  queue = []
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const orig = error.config
    if (error.response?.status !== 401 || orig._retry) return Promise.reject(error)

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => queue.push({ resolve, reject }))
        .then(token => { orig.headers.Authorization = `Bearer ${token}`; return api(orig) })
    }

    orig._retry = true
    isRefreshing = true
    const rt = getRefreshToken()

    if (!rt) {
      clearClientAuth()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    try {
      const { data } = await authApi.post<AuthResponse>('/api/auth/refresh', { refreshToken: rt })
      saveTokens(data.accessToken, data.refreshToken)
      notifyTokensRefreshed({ accessToken: data.accessToken, refreshToken: data.refreshToken })
      api.defaults.headers.common.Authorization = `Bearer ${data.accessToken}`
      processQueue(null, data.accessToken)
      orig.headers.Authorization = `Bearer ${data.accessToken}`
      return api(orig)
    } catch (e) {
      processQueue(e)
      clearClientAuth()
      window.location.href = '/login'
      return Promise.reject(e)
    } finally {
      isRefreshing = false
    }
  }
)

// ── Auth API ──────────────────────────────────────────────────────────────────
export const authService = {
  login: (d: LoginRequest) => authApi.post<AuthResponse>('/api/auth/login', d),
  signup: (d: SignupRequest) => authApi.post<{ message: string }>('/api/auth/signup', d),
  sendOtp: (email: string) => authApi.post('/api/auth/send-otp', { email }),
  verifyOtp: (d: VerifyOtpRequest) => authApi.post<AuthResponse>('/api/auth/verify-otp', d),
  logout: (refreshToken: string) => authApi.post('/api/auth/logout', { refreshToken }),
  refresh: (refreshToken: string) => authApi.post<AuthResponse>('/api/auth/refresh', { refreshToken }),
  forgotPasswordOtp: (email: string) => authApi.post('/api/auth/forgot-password/send-otp', { email }),
  forgotPasswordVerify: (email: string, otp: string) =>
    authApi.post<{ resetToken: string }>('/api/auth/forgot-password/verify-otp', { email, otp }),
  resetPassword: (resetToken: string, newPassword: string) =>
    authApi.post('/api/auth/reset-password', { resetToken, newPassword }),
}

// ── User API ──────────────────────────────────────────────────────────────────
export const userService = {
  getProfile: (userId: number) =>
    api.get<ApiResponse<UserProfile>>('/api/users/profile', { headers: { 'X-UserId': userId } }),
  updateProfile: (userId: number, d: { name?: string; phone?: string }) =>
    api.put<ApiResponse<UserProfile>>('/api/users/profile', d, { headers: { 'X-UserId': userId } }),
  searchReceivers: (q: string) =>
    api.get<ApiResponse<ReceiverSuggestion[]>>(`/api/users/receivers/search?q=${encodeURIComponent(q)}`),
}

// ── KYC API ───────────────────────────────────────────────────────────────────
export const kycService = {
  submit: (userId: number, docType: DocType, docNumber: string, file: File) => {
    const fd = new FormData()
    fd.append('docFile', file)
    return api.post<ApiResponse<KycStatusResponse>>(
      `/api/kyc/submit?docType=${docType}&docNumber=${encodeURIComponent(docNumber)}`,
      fd,
      { headers: { 'X-UserId': userId, 'Content-Type': 'multipart/form-data' } }
    )
  },
  status: (userId: number) =>
    api.get<ApiResponse<KycStatusResponse>>('/api/kyc/status', { headers: { 'X-UserId': userId } }),
}

// ── Wallet API ────────────────────────────────────────────────────────────────
export const walletService = {
  balance: (userId: number) =>
    api.get<ApiResponse<WalletBalance>>('/api/wallet/balance', { headers: { 'X-User-Id': userId } }),
  transactions: (userId: number, page = 0, size = 10) =>
    api.get<PageResponse<Transaction>>(`/api/wallet/transactions?page=${page}&size=${size}`, {
      headers: { 'X-User-Id': userId },
    }),
  ledger: (userId: number, page = 0, size = 20) =>
    api.get<PageResponse<LedgerEntry>>(`/api/wallet/ledger?page=${page}&size=${size}`, {
      headers: { 'X-User-Id': userId },
    }),
  transfer: (userId: number, d: TransferRequest) =>
    api.post<ApiResponse<void>>('/api/wallet/transfer', d, { headers: { 'X-User-Id': userId } }),
  withdraw: (userId: number, amount: number) =>
    api.post<ApiResponse<void>>('/api/wallet/withdraw', { amount }, { headers: { 'X-User-Id': userId } }),
  createOrder: (userId: number, amount: number) =>
    api.post<RazorpayOrder>(`/api/payment/create-order?amount=${amount}`, {}, {
      headers: { 'X-User-Id': userId },
    }),
  verifyPayment: (userId: number, d: Record<string, string>) =>
    api.post<ApiResponse<void>>('/api/payment/verify', d, { headers: { 'X-User-Id': userId } }),
  cancelPayment: (userId: number, razorpayOrderId: string) =>
    api.post<string>('/api/payment/cancel', { razorpayOrderId }, {
      headers: { 'X-User-Id': userId },
    }),
  failPayment: (userId: number, razorpayOrderId: string, reason?: string) =>
    api.post<string>('/api/payment/fail', { razorpayOrderId, reason }, {
      headers: { 'X-User-Id': userId },
    }),
  statement: (userId: number, from: string, to: string) =>
    api.get<Transaction[]>(`/api/wallet/statement?from=${from}&to=${to}`, { headers: { 'X-User-Id': userId } }),
  downloadStatement: (userId: number, from: string, to: string) =>
    api.get(`/api/wallet/statement/download?from=${from}&to=${to}`, {
      headers: { 'X-User-Id': userId },
      responseType: 'blob',
    }),
}

// ── Rewards API ───────────────────────────────────────────────────────────────
export const rewardsService = {
  summary: (userId: number) =>
    api.get<ApiResponse<RewardSummary>>('/api/rewards/summary', { headers: { 'X-UserId': userId } }),
  catalog: () => api.get<ApiResponse<RewardItem[]>>('/api/rewards/catalog'),
  transactions: (userId: number) =>
    api.get<ApiResponse<RewardTransaction[]>>('/api/rewards/transactions', { headers: { 'X-UserId': userId } }),
  redeem: (userId: number, rewardId: number) =>
    api.post<ApiResponse<Redemption>>('/api/rewards/redeem', { rewardId }, { headers: { 'X-UserId': userId } }),
  redeemPoints: (userId: number, points: number) =>
    api.post<ApiResponse<void>>(`/api/rewards/redeem-points?points=${points}`, {}, {
      headers: { 'X-UserId': userId },
    }),
  earnInternal: (userId: number, amount: number) =>
    api.post(`/api/rewards/internal/earn?userId=${userId}&amount=${amount}`),
}

// ── Admin API ─────────────────────────────────────────────────────────────────
export const adminService = {
  dashboard: (role: string) =>
    api.get<ApiResponse<AdminDashboard>>('/api/admin/dashboard', { headers: { 'X-UserRole': role } }),
  listUsers: (role: string, params?: Record<string, unknown>) =>
    api.get<ApiResponse<PageResponse<AdminUserResponse>>>('/api/admin/users', {
      headers: { 'X-UserRole': role }, params,
    }),
  getUser: (userId: number, role: string) =>
    api.get<ApiResponse<AdminUserResponse>>(`/api/admin/users/${userId}`, { headers: { 'X-UserRole': role } }),
  blockUser: (userId: number, role: string) =>
    api.patch<ApiResponse<AdminUserResponse>>(`/api/admin/users/${userId}/block`, {}, { headers: { 'X-UserRole': role } }),
  unblockUser: (userId: number, role: string) =>
    api.patch<ApiResponse<AdminUserResponse>>(`/api/admin/users/${userId}/unblock`, {}, { headers: { 'X-UserRole': role } }),
  changeRole: (userId: number, newRole: string, role: string) =>
    api.patch(`/api/admin/users/${userId}/role?newRole=${newRole}`, {}, { headers: { 'X-UserRole': role } }),
  searchUsers: (q: string, role: string, page = 0) =>
    api.get<ApiResponse<PageResponse<AdminUserResponse>>>(`/api/admin/users/search?q=${encodeURIComponent(q)}&page=${page}`, {
      headers: { 'X-UserRole': role },
    }),
  pendingKyc: (role: string, page = 0) =>
    api.get<ApiResponse<PageResponse<KycStatusResponse>>>(`/api/admin/kyc/pending?page=${page}`, {
      headers: { 'X-UserRole': role },
    }),
  approveKyc: (kycId: number, role: string, email: string) =>
    api.post(`/api/admin/kyc/${kycId}/approve`, {}, { headers: { 'X-UserRole': role, 'X-UserEmail': email } }),
  rejectKyc: (kycId: number, reason: string, role: string, email: string) =>
    api.post(`/api/admin/kyc/${kycId}/reject?reason=${encodeURIComponent(reason)}`, {}, {
      headers: { 'X-UserRole': role, 'X-UserEmail': email },
    }),
  catalog: (role: string) =>
    api.get<ApiResponse<RewardItem[]>>('/api/rewards/admin/catalog', { headers: { 'X-UserRole': role } }),
  addCatalogItem: (payload: RewardItemPayload, role: string) =>
    api.post<ApiResponse<RewardItem>>('/api/rewards/catalog/add', payload, { headers: { 'X-UserRole': role } }),
  updateCatalogItem: (rewardId: number, payload: RewardItemPayload, role: string) =>
    api.put<ApiResponse<RewardItem>>(`/api/rewards/admin/catalog/${rewardId}`, payload, {
      headers: { 'X-UserRole': role },
    }),
  deleteCatalogItem: (rewardId: number, role: string) =>
    api.delete<ApiResponse<void>>(`/api/rewards/admin/catalog/${rewardId}`, { headers: { 'X-UserRole': role } }),
}

export default api
