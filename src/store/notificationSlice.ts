import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { KycStatus, Notification, NotifType } from '../types'

interface NotifState { items: Notification[]; unreadCount: number; sessionKey: string | null }

type SeedPayload = {
  userId: number
  loginAt: string | null
  kycStatus?: KycStatus
  role?: string
}

const sessionKeyFor = ({ userId, loginAt }: Pick<SeedPayload, 'userId' | 'loginAt'>) =>
  `payvault-notifications:${userId}:${loginAt || 'active'}`

const readSessionItems = (sessionKey: string): Notification[] | null => {
  try {
    const raw = sessionStorage.getItem(sessionKey)
    return raw == null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

const saveSessionItems = (sessionKey: string | null, items: Notification[]) => {
  if (!sessionKey) return
  sessionStorage.setItem(sessionKey, JSON.stringify(items))
}

const countUnread = (items: Notification[]) => items.filter(n => !n.read).length

const isKycRequiredNotification = (item: Notification) =>
  item.title === 'KYC Required' || item.message.toLowerCase().includes('complete kyc') || item.message.toLowerCase().includes('submit your kyc')

const reconcileSessionItems = (items: Notification[], payload: SeedPayload) => {
  if (items.length === 0) return items
  if (payload.role === 'ADMIN' || payload.kycStatus === 'APPROVED') {
    const cleaned = items.filter(item => !isKycRequiredNotification(item))
    if (payload.role !== 'ADMIN' && !cleaned.some(item => item.title === 'Wallet Services Activated')) {
      cleaned.unshift({
        id: Date.now() + 2,
        type: 'success',
        title: 'Wallet Services Activated',
        message: 'Congrats you have activated all the wallet services.',
        read: false,
        time: new Date().toISOString(),
      })
    }
    return cleaned
  }
  return items
}

const buildSeedNotifications = ({ kycStatus, role }: SeedPayload): Notification[] => {
  const now = new Date().toISOString()
  const items: Notification[] = [
    {
      id: Date.now(),
      type: 'success',
      title: 'Welcome to PayVault!',
      message: 'Your account is ready.',
      read: false,
      time: now,
    },
  ]

  if (role === 'ADMIN') return items

  if (kycStatus === 'APPROVED') {
    items.push({
      id: Date.now() + 1,
      type: 'success',
      title: 'Wallet Services Activated',
      message: 'Congrats you have activated all the wallet services.',
      read: false,
      time: now,
    })
  } else if (kycStatus === 'PENDING') {
    items.push({
      id: Date.now() + 1,
      type: 'info',
      title: 'KYC Under Review',
      message: 'Your documents are being reviewed.',
      read: false,
      time: now,
    })
  } else if (kycStatus === 'REJECTED') {
    items.push({
      id: Date.now() + 1,
      type: 'warning',
      title: 'KYC Rejected',
      message: 'Review the reason and submit corrected documents.',
      read: false,
      time: now,
    })
  } else {
    items.push({
      id: Date.now() + 1,
      type: 'info',
      title: 'KYC Required',
      message: 'Submit your KYC documents to unlock wallet features.',
      read: false,
      time: now,
    })
  }

  return items
}

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: { items: [], unreadCount: 0, sessionKey: null } as NotifState,
  reducers: {
    addNotification(state, { payload }: PayloadAction<{ type: NotifType; title: string; message: string }>) {
      state.items.unshift({ id: Date.now(), read: false, time: new Date().toISOString(), ...payload })
      state.unreadCount = countUnread(state.items)
      saveSessionItems(state.sessionKey, state.items)
    },
    markAllRead(state) {
      state.items.forEach(n => { n.read = true })
      state.unreadCount = 0
      saveSessionItems(state.sessionKey, state.items)
    },
    markRead(state, { payload }: PayloadAction<number>) {
      const n = state.items.find(n => n.id === payload)
      if (n) n.read = true
      state.unreadCount = countUnread(state.items)
      saveSessionItems(state.sessionKey, state.items)
    },
    clearAll(state) {
      state.items = []
      state.unreadCount = 0
      saveSessionItems(state.sessionKey, state.items)
    },
    resetNotifications(state) {
      state.items = []
      state.unreadCount = 0
      state.sessionKey = null
    },
    seedNotifications(state, { payload }: PayloadAction<SeedPayload>) {
      const sessionKey = sessionKeyFor(payload)
      if (state.sessionKey === sessionKey && state.items.length > 0) return

      state.sessionKey = sessionKey
      const saved = readSessionItems(sessionKey)
      if (saved) {
        state.items = reconcileSessionItems(saved, payload)
        state.unreadCount = countUnread(state.items)
        saveSessionItems(sessionKey, state.items)
        return
      }

      state.items = buildSeedNotifications(payload)
      state.unreadCount = countUnread(state.items)
      saveSessionItems(sessionKey, state.items)
    },
  },
})
export const { addNotification, markAllRead, markRead, clearAll, resetNotifications, seedNotifications } = notificationSlice.actions
export default notificationSlice.reducer
