import { beforeEach, describe, expect, it, vi } from 'vitest'

const axiosMocks = vi.hoisted(() => {
  const buildInstance = () => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} as Record<string, string> } },
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  })

  const apiInstance = buildInstance()
  const authApiInstance = buildInstance()

  return {
    apiInstance,
    authApiInstance,
    create: vi.fn()
      .mockReturnValueOnce(apiInstance)
      .mockReturnValueOnce(authApiInstance),
  }
})

vi.mock('axios', () => ({
  default: {
    create: axiosMocks.create,
    isAxiosError: vi.fn(),
  },
}))

const createStorage = () => {
  let store: Record<string, string> = {}

  return {
    get length() {
      return Object.keys(store).length
    },
    clear: vi.fn(() => {
      store = {}
    }),
    getItem: vi.fn((key: string) => store[key] ?? null),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
  }
}

Object.defineProperty(globalThis, 'sessionStorage', {
  value: createStorage(),
  configurable: true,
})

Object.defineProperty(globalThis, 'localStorage', {
  value: createStorage(),
  configurable: true,
})

import {
  adminService,
  authService,
  clearClientAuth,
  kycService,
  rewardsService,
  userService,
  walletService,
} from '@/core/api'

const { apiInstance, authApiInstance } = axiosMocks

describe('core/api service methods', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    localStorage.clear()
  })

  describe('authService', () => {
    it('calls every auth endpoint through the unauthenticated client', () => {
      const login = { email: 'user@test.com', password: 'pass' }
      const signup = { fullName: 'User', email: 'user@test.com', password: 'pass', phone: '9999999999' }
      const verifyOtp = { email: 'user@test.com', otp: '123456' }

      authService.login(login)
      authService.signup(signup)
      authService.sendOtp('user@test.com')
      authService.verifyOtp(verifyOtp)
      authService.logout('refresh-token')
      authService.refresh('refresh-token')
      authService.forgotPasswordOtp('user@test.com')
      authService.forgotPasswordVerify('user@test.com', '123456')
      authService.resetPassword('reset-token', 'new-pass')

      expect(authApiInstance.post).toHaveBeenCalledWith('/api/auth/login', login)
      expect(authApiInstance.post).toHaveBeenCalledWith('/api/auth/signup', signup)
      expect(authApiInstance.post).toHaveBeenCalledWith('/api/auth/send-otp', { email: 'user@test.com' })
      expect(authApiInstance.post).toHaveBeenCalledWith('/api/auth/verify-otp', verifyOtp)
      expect(authApiInstance.post).toHaveBeenCalledWith('/api/auth/logout', { refreshToken: 'refresh-token' })
      expect(authApiInstance.post).toHaveBeenCalledWith('/api/auth/refresh', { refreshToken: 'refresh-token' })
      expect(authApiInstance.post).toHaveBeenCalledWith('/api/auth/forgot-password/send-otp', { email: 'user@test.com' })
      expect(authApiInstance.post).toHaveBeenCalledWith('/api/auth/forgot-password/verify-otp', {
        email: 'user@test.com',
        otp: '123456',
      })
      expect(authApiInstance.post).toHaveBeenCalledWith('/api/auth/reset-password', {
        resetToken: 'reset-token',
        newPassword: 'new-pass',
      })
    })
  })

  describe('userService', () => {
    it('adds user headers and encodes receiver search queries', () => {
      userService.getProfile(7)
      userService.updateProfile(7, { name: 'New Name', phone: '8888888888' })
      userService.searchReceivers('a+b user')

      expect(apiInstance.get).toHaveBeenCalledWith('/api/users/profile', { headers: { 'X-UserId': 7 } })
      expect(apiInstance.put).toHaveBeenCalledWith('/api/users/profile', { name: 'New Name', phone: '8888888888' }, {
        headers: { 'X-UserId': 7 },
      })
      expect(apiInstance.get).toHaveBeenCalledWith('/api/users/receivers/search?q=a%2Bb%20user')
    })
  })

  describe('kycService', () => {
    it('submits KYC form data and reads status with user headers', () => {
      const file = new Blob(['doc']) as File

      kycService.submit(3, 'AADHAAR', 'AA 11/22', file)
      kycService.status(3)

      expect(apiInstance.post).toHaveBeenCalledWith(
        '/api/kyc/submit?docType=AADHAAR&docNumber=AA%2011%2F22',
        expect.any(FormData),
        { headers: { 'X-UserId': 3, 'Content-Type': 'multipart/form-data' } }
      )
      expect(apiInstance.get).toHaveBeenCalledWith('/api/kyc/status', { headers: { 'X-UserId': 3 } })
    })
  })

  describe('walletService', () => {
    it('calls every wallet and payment endpoint with expected headers and params', () => {
      const transfer = { receiverId: 2, amount: 100, description: 'Dinner' }
      const payment = { razorpay_payment_id: 'pay_1', razorpay_order_id: 'order_1' }

      walletService.balance(1)
      walletService.transactions(1, 2, 25)
      walletService.ledger(1, 3, 30)
      walletService.transfer(1, transfer)
      walletService.withdraw(1, 500)
      walletService.createOrder(1, 999)
      walletService.verifyPayment(1, payment)
      walletService.cancelPayment(1, 'order_1')
      walletService.failPayment(1, 'order_1', 'Payment failed')
      walletService.statement(1, '2026-01-01', '2026-01-31')
      walletService.downloadStatement(1, '2026-01-01', '2026-01-31')

      expect(apiInstance.get).toHaveBeenCalledWith('/api/wallet/balance', { headers: { 'X-User-Id': 1 } })
      expect(apiInstance.get).toHaveBeenCalledWith('/api/wallet/transactions?page=2&size=25', {
        headers: { 'X-User-Id': 1 },
      })
      expect(apiInstance.get).toHaveBeenCalledWith('/api/wallet/ledger?page=3&size=30', {
        headers: { 'X-User-Id': 1 },
      })
      expect(apiInstance.post).toHaveBeenCalledWith('/api/wallet/transfer', transfer, { headers: { 'X-User-Id': 1 } })
      expect(apiInstance.post).toHaveBeenCalledWith('/api/wallet/withdraw', { amount: 500 }, {
        headers: { 'X-User-Id': 1 },
      })
      expect(apiInstance.post).toHaveBeenCalledWith('/api/payment/create-order?amount=999', {}, {
        headers: { 'X-User-Id': 1 },
      })
      expect(apiInstance.post).toHaveBeenCalledWith('/api/payment/verify', payment, { headers: { 'X-User-Id': 1 } })
      expect(apiInstance.post).toHaveBeenCalledWith('/api/payment/cancel', { razorpayOrderId: 'order_1' }, {
        headers: { 'X-User-Id': 1 },
      })
      expect(apiInstance.post).toHaveBeenCalledWith('/api/payment/fail', {
        razorpayOrderId: 'order_1',
        reason: 'Payment failed',
      }, {
        headers: { 'X-User-Id': 1 },
      })
      expect(apiInstance.get).toHaveBeenCalledWith('/api/wallet/statement?from=2026-01-01&to=2026-01-31', {
        headers: { 'X-User-Id': 1 },
      })
      expect(apiInstance.get).toHaveBeenCalledWith('/api/wallet/statement/download?from=2026-01-01&to=2026-01-31', {
        headers: { 'X-User-Id': 1 },
        responseType: 'blob',
      })
    })
  })

  describe('rewardsService', () => {
    it('calls every rewards endpoint with expected headers and params', () => {
      rewardsService.summary(5)
      rewardsService.catalog()
      rewardsService.transactions(5)
      rewardsService.redeem(5, 12)
      rewardsService.redeemPoints(5, 300)
      rewardsService.earnInternal(5, 1200)

      expect(apiInstance.get).toHaveBeenCalledWith('/api/rewards/summary', { headers: { 'X-UserId': 5 } })
      expect(apiInstance.get).toHaveBeenCalledWith('/api/rewards/catalog')
      expect(apiInstance.get).toHaveBeenCalledWith('/api/rewards/transactions', { headers: { 'X-UserId': 5 } })
      expect(apiInstance.post).toHaveBeenCalledWith('/api/rewards/redeem', { rewardId: 12 }, {
        headers: { 'X-UserId': 5 },
      })
      expect(apiInstance.post).toHaveBeenCalledWith('/api/rewards/redeem-points?points=300', {}, {
        headers: { 'X-UserId': 5 },
      })
      expect(apiInstance.post).toHaveBeenCalledWith('/api/rewards/internal/earn?userId=5&amount=1200')
    })
  })

  describe('adminService', () => {
    it('calls every admin endpoint with role/email headers and encoded params', () => {
      const item = { name: 'Gift', type: 'VOUCHER' as const, pointsRequired: 100, stock: 10 }

      adminService.dashboard('ADMIN')
      adminService.listUsers('ADMIN', { page: 1 })
      adminService.getUser(4, 'ADMIN')
      adminService.blockUser(4, 'ADMIN')
      adminService.unblockUser(4, 'ADMIN')
      adminService.changeRole(4, 'USER', 'ADMIN')
      adminService.searchUsers('a+b user', 'ADMIN', 2)
      adminService.pendingKyc('ADMIN', 3)
      adminService.approveKyc(9, 'ADMIN', 'admin@test.com')
      adminService.rejectKyc(9, 'bad photo/id', 'ADMIN', 'admin@test.com')
      adminService.catalog('ADMIN')
      adminService.addCatalogItem(item, 'ADMIN')
      adminService.updateCatalogItem(12, item, 'ADMIN')
      adminService.deleteCatalogItem(12, 'ADMIN')

      expect(apiInstance.get).toHaveBeenCalledWith('/api/admin/dashboard', { headers: { 'X-UserRole': 'ADMIN' } })
      expect(apiInstance.get).toHaveBeenCalledWith('/api/admin/users', {
        headers: { 'X-UserRole': 'ADMIN' },
        params: { page: 1 },
      })
      expect(apiInstance.get).toHaveBeenCalledWith('/api/admin/users/4', { headers: { 'X-UserRole': 'ADMIN' } })
      expect(apiInstance.patch).toHaveBeenCalledWith('/api/admin/users/4/block', {}, {
        headers: { 'X-UserRole': 'ADMIN' },
      })
      expect(apiInstance.patch).toHaveBeenCalledWith('/api/admin/users/4/unblock', {}, {
        headers: { 'X-UserRole': 'ADMIN' },
      })
      expect(apiInstance.patch).toHaveBeenCalledWith('/api/admin/users/4/role?newRole=USER', {}, {
        headers: { 'X-UserRole': 'ADMIN' },
      })
      expect(apiInstance.get).toHaveBeenCalledWith('/api/admin/users/search?q=a%2Bb%20user&page=2', {
        headers: { 'X-UserRole': 'ADMIN' },
      })
      expect(apiInstance.get).toHaveBeenCalledWith('/api/admin/kyc/pending?page=3', {
        headers: { 'X-UserRole': 'ADMIN' },
      })
      expect(apiInstance.post).toHaveBeenCalledWith('/api/admin/kyc/9/approve', {}, {
        headers: { 'X-UserRole': 'ADMIN', 'X-UserEmail': 'admin@test.com' },
      })
      expect(apiInstance.post).toHaveBeenCalledWith('/api/admin/kyc/9/reject?reason=bad%20photo%2Fid', {}, {
        headers: { 'X-UserRole': 'ADMIN', 'X-UserEmail': 'admin@test.com' },
      })
      expect(apiInstance.get).toHaveBeenCalledWith('/api/rewards/admin/catalog', {
        headers: { 'X-UserRole': 'ADMIN' },
      })
      expect(apiInstance.post).toHaveBeenCalledWith('/api/rewards/catalog/add', item, {
        headers: { 'X-UserRole': 'ADMIN' },
      })
      expect(apiInstance.put).toHaveBeenCalledWith('/api/rewards/admin/catalog/12', item, {
        headers: { 'X-UserRole': 'ADMIN' },
      })
      expect(apiInstance.delete).toHaveBeenCalledWith('/api/rewards/admin/catalog/12', {
        headers: { 'X-UserRole': 'ADMIN' },
      })
    })
  })

  it('clears session auth and remember-me auth storage', () => {
    sessionStorage.setItem('accessToken', 'session-access')
    sessionStorage.setItem('refreshToken', 'session-refresh')
    sessionStorage.setItem('other', 'value')
    localStorage.setItem('accessToken', 'local-access')
    localStorage.setItem('refreshToken', 'local-refresh')
    localStorage.setItem('user', '{"id":1}')
    localStorage.setItem('loginAt', 'now')
    localStorage.setItem('theme', 'dark')

    clearClientAuth()

    expect(sessionStorage.length).toBe(0)
    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(localStorage.getItem('refreshToken')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
    expect(localStorage.getItem('loginAt')).toBeNull()
    expect(localStorage.getItem('theme')).toBe('dark')
  })
})
