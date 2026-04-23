import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { RewardSummary, RewardItem, RewardTransaction } from '../types'
import { rewardsService } from '../core/api'
import { getApiErrorMessage } from '../shared/apiErrors'
import type { RootState } from './store'
import { loginUser, logout } from './authSlice'

interface RewardsState {
  summary: RewardSummary | null; catalog: RewardItem[]
  transactions: RewardTransaction[]; ownerUserId: number | null
  loading: boolean; error: string | null
}

type ApiLike<T> = { data?: T } | T

const unwrap = <T>(payload: ApiLike<T> | undefined): T | undefined => {
  if (!payload) return undefined
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    return (payload as { data?: T }).data
  }
  return payload as T
}

const normalizeRewardTransactions = (payload: unknown): RewardTransaction[] => {
  if (!payload || typeof payload !== 'object') return []
  const p = payload as {
    data?: unknown
    content?: unknown
  }

  if (Array.isArray(payload)) return payload as RewardTransaction[]
  if (Array.isArray(p.data)) return p.data as RewardTransaction[]
  if (p.data && typeof p.data === 'object' && Array.isArray((p.data as { content?: unknown }).content)) {
    return (p.data as { content: RewardTransaction[] }).content
  }
  if (Array.isArray(p.content)) return p.content as RewardTransaction[]
  return []
}

const uid = (s: RootState) => s.auth.user?.id ?? 0

export const fetchRewardSummary = createAsyncThunk('rewards/summary', async (_, { getState, rejectWithValue }) => {
  const userId = uid(getState() as RootState)
  try {
    const { data } = await rewardsService.summary(userId)
    const summary = unwrap<RewardSummary>(data) ?? null
    return { userId, data: summary }
  }
  catch (e: unknown) { return rejectWithValue(getApiErrorMessage(e, 'Could not load rewards')) }
})
export const fetchCatalog = createAsyncThunk('rewards/catalog', async (_, { rejectWithValue }) => {
  try {
    const { data } = await rewardsService.catalog()
    return unwrap<RewardItem[]>(data) || []
  }
  catch (e: unknown) { return rejectWithValue(getApiErrorMessage(e, 'Could not load catalog')) }
})
export const fetchRewardTransactions = createAsyncThunk('rewards/transactions', async (_, { getState, rejectWithValue }) => {
  const userId = uid(getState() as RootState)
  try {
    const { data } = await rewardsService.transactions(userId)
    return { userId, data: normalizeRewardTransactions(data) }
  }
  catch (e: unknown) { return rejectWithValue(getApiErrorMessage(e, 'Could not load reward history')) }
})
export const redeemReward = createAsyncThunk('rewards/redeem', async (rewardId: number, { getState, rejectWithValue }) => {
  try { const { data } = await rewardsService.redeem(uid(getState() as RootState), rewardId); return data }
  catch (e: unknown) { return rejectWithValue(getApiErrorMessage(e, 'Redemption failed')) }
})
export const redeemPointsThunk = createAsyncThunk('rewards/redeemPoints', async (points: number, { getState, rejectWithValue }) => {
  try { const { data } = await rewardsService.redeemPoints(uid(getState() as RootState), points); return data }
  catch (e: unknown) { return rejectWithValue(getApiErrorMessage(e, 'Redemption failed')) }
})

const rewardsSlice = createSlice({
  name: 'rewards',
  initialState: {
    summary: null,
    catalog: [],
    transactions: [],
    ownerUserId: null,
    loading: false,
    error: null,
  } as RewardsState,
  reducers: { clearError(s) { s.error = null } },
  extraReducers: (b) => {
    b.addCase(loginUser.fulfilled, (s, { payload }) => {
      s.summary = null
      s.transactions = []
      s.ownerUserId = payload.user.id
      s.loading = false
      s.error = null
    })
    b.addCase(logout, (s) => {
      s.summary = null
      s.transactions = []
      s.ownerUserId = null
      s.loading = false
      s.error = null
    })
    b.addCase(fetchRewardSummary.pending, (s) => { s.loading = true })
    b.addCase(fetchRewardSummary.fulfilled, (s, { payload }) => {
      if (s.ownerUserId !== null && payload.userId !== s.ownerUserId) return
      s.loading = false
      s.ownerUserId = payload.userId
      s.summary = payload.data ?? s.summary
    })
    b.addCase(fetchRewardSummary.rejected, (s, { payload }) => { s.loading = false; s.error = payload as string })
    b.addCase(fetchCatalog.fulfilled, (s, { payload }) => { s.catalog = payload })
    b.addCase(fetchRewardTransactions.fulfilled, (s, { payload }) => {
      if (s.ownerUserId !== null && payload.userId !== s.ownerUserId) return
      s.ownerUserId = payload.userId
      s.transactions = payload.data
    })
  },
})
export const { clearError: clearRewardsError } = rewardsSlice.actions
export default rewardsSlice.reducer
