import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef, useCallback } from 'react'
import type { RootState, AppDispatch } from '../store/store'
import { toggleTheme } from '../store/themeSlice'
import { logout } from '../store/authSlice'
import { addNotification, resetNotifications } from '../store/notificationSlice'
import { authService } from '../core/api'
import type { NotifType } from '../types'

export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector = <T>(fn: (s: RootState) => T) => useSelector<RootState, T>(fn)

export const useTheme = () => {
  const dispatch = useAppDispatch()
  const isDark = useAppSelector(s => s.theme.isDark)
  return { isDark, toggle: () => dispatch(toggleTheme()) }
}

export const useAuth = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { user, accessToken, loading, error } = useAppSelector(s => s.auth)

  const handleLogout = async () => {
    try {
      const rt = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken')
      if (rt) await authService.logout(rt)
    } catch (_) {}
    dispatch(logout())
    dispatch(resetNotifications())
    navigate('/login')
  }

  return { user, accessToken, loading, error, isAuthenticated: !!accessToken, logout: handleLogout }
}

export const useNotify = () => {
  const dispatch = useAppDispatch()
  return (type: NotifType, title: string, message: string) =>
    dispatch(addNotification({ type, title, message }))
}

export const useDebounce = <T>(value: T, delay = 400): T => {
  const [debounced, setDebounced] = useState<T>(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/** Limits how often a callback runs (e.g. scroll or resize handlers). */
export const useThrottleCallback = <Args extends unknown[]>(fn: (...a: Args) => void, ms: number) => {
  const last = useRef(0)
  return useCallback(
    (...args: Args) => {
      const now = Date.now()
      if (now - last.current >= ms) {
        last.current = now
        fn(...args)
      }
    },
    [fn, ms],
  )
}

export const useClickOutside = (handler: () => void) => {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) handler()
    }
    document.addEventListener('mousedown', listener)
    return () => document.removeEventListener('mousedown', listener)
  }, [handler])
  return ref
}
