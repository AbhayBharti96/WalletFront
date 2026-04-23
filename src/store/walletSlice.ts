import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { WalletBalance, Transaction, LedgerEntry, PageResponse, TransferRequest } from '../types'
import { walletService } from '../core/api'
import { getApiErrorMessage } from '../shared/apiErrors'
import type { RootState } from './store'
import { loginUser, logout } from './authSlice'

interface WalletState {
  balance: WalletBalance | null
  transactions: PageResponse<Transaction> | null
  ledger: PageResponse<LedgerEntry> | null
  ownerUserId: number | null
  loading: boolean; txLoading: boolean; error: string | null
}

const uid = (s: RootState) => s.auth.user?.id ?? 0

export const fetchBalance = createAsyncThunk('wallet/balance', async (_, { getState, rejectWithValue }) => {
  const userId = uid(getState() as RootState)
  try { const { data } = await walletService.balance(userId); return { userId, data: data.data } }
  catch (e: unknown) { return rejectWithValue(getApiErrorMessage(e, 'Could not load balance')) }
})

export const fetchTransactions = createAsyncThunk('wallet/transactions',
  async ({ page = 0, size = 10 }: { page?: number; size?: number } = {}, { getState, rejectWithValue }) => {
    const userId = uid(getState() as RootState)
    try { const { data } = await walletService.transactions(userId, page, size); return { userId, data } }
    catch (e: unknown) { return rejectWithValue(getApiErrorMessage(e, 'Could not load transactions')) }
  })

export const fetchLedger = createAsyncThunk('wallet/ledger',
  async ({ page = 0, size = 20 }: { page?: number; size?: number } = {}, { getState, rejectWithValue }) => {
    const userId = uid(getState() as RootState)
    try { const { data } = await walletService.ledger(userId, page, size); return { userId, data } }
    catch (e: unknown) { return rejectWithValue(getApiErrorMessage(e, 'Could not load ledger')) }
  })

export const transferFunds = createAsyncThunk('wallet/transfer', async (payload: TransferRequest, { getState, rejectWithValue }) => {
  try { const { data } = await walletService.transfer(uid(getState() as RootState), payload); return data }
  catch (e: unknown) { return rejectWithValue(getApiErrorMessage(e, 'Transfer failed')) }
})

export const withdrawFunds = createAsyncThunk('wallet/withdraw', async (amount: number, { getState, rejectWithValue }) => {
  try { const { data } = await walletService.withdraw(uid(getState() as RootState), amount); return data }
  catch (e: unknown) { return rejectWithValue(getApiErrorMessage(e, 'Withdrawal failed')) }
})

export const createPaymentOrder = createAsyncThunk('payment/create-order', async (amount: number, { getState, rejectWithValue }) => {
  try { const { data } = await walletService.createOrder(uid(getState() as RootState), amount); return data }
  catch (e: unknown) { return rejectWithValue(getApiErrorMessage(e, 'Order creation failed')) }
})

const walletSlice = createSlice({
  name: 'wallet',
  initialState: {
    balance: null,
    transactions: null,
    ledger: null,
    ownerUserId: null,
    loading: false,
    txLoading: false,
    error: null,
  } as WalletState,
  reducers: { clearError(s) { s.error = null } },
  extraReducers: (b) => {
    b.addCase(loginUser.fulfilled, (s, { payload }) => {
      s.balance = null
      s.transactions = null
      s.ledger = null
      s.ownerUserId = payload.user.id
      s.loading = false
      s.txLoading = false
      s.error = null
    })
    b.addCase(logout, (s) => {
      s.balance = null
      s.transactions = null
      s.ledger = null
      s.ownerUserId = null
      s.loading = false
      s.txLoading = false
      s.error = null
    })
    b.addCase(fetchBalance.pending, (s) => {
      s.loading = true
      s.balance = null
    })
    b.addCase(fetchBalance.fulfilled, (s, { payload }) => {
      if (s.ownerUserId !== null && payload.userId !== s.ownerUserId) return
      s.loading = false
      s.ownerUserId = payload.userId
      s.balance = payload.data
    })
    b.addCase(fetchBalance.rejected, (s, { payload }) => { s.loading = false; s.error = payload as string })
    b.addCase(fetchTransactions.pending, (s) => {
      s.txLoading = true
      s.transactions = null
    })
    b.addCase(fetchTransactions.fulfilled, (s, { payload }) => {
      if (s.ownerUserId !== null && payload.userId !== s.ownerUserId) return
      s.txLoading = false
      s.ownerUserId = payload.userId
      s.transactions = payload.data
    })
    b.addCase(fetchTransactions.rejected, (s, { payload }) => { s.txLoading = false; s.error = payload as string })
    b.addCase(fetchLedger.pending, (s) => {
      s.ledger = null
    })
    b.addCase(fetchLedger.fulfilled, (s, { payload }) => {
      if (s.ownerUserId !== null && payload.userId !== s.ownerUserId) return
      s.ownerUserId = payload.userId
      s.ledger = payload.data
    })
  },
})
export const { clearError: clearWalletError } = walletSlice.actions
export default walletSlice.reducer
