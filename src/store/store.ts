// ─── store.ts ─────────────────────────────────────────────────────────────────
import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice'
import themeReducer from './themeSlice'
import notificationReducer from './notificationSlice'
import walletReducer from './walletSlice'
import rewardsReducer from './rewardsSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    theme: themeReducer,
    notifications: notificationReducer,
    wallet: walletReducer,
    rewards: rewardsReducer,
  },
  middleware: (getDefault) => getDefault({ serializableCheck: false }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
