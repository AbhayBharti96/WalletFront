import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Suspense, lazy, useEffect, useState } from 'react'
import { useAppSelector, useAppDispatch } from './shared/hooks'
import { seedNotifications } from './store/notificationSlice'
import { kycService } from './core/api'
import { updateKycStatus } from './store/authSlice'
import { LoadingScreen, NotFoundPage } from './shared/components/ui'
import AppLayout from './layouts/AppLayout'
import AuthLayout from './layouts/AuthLayout'
import LandingPage from './features/landing/LandingPage'

const LoginPage        = lazy(() => import('./features/auth/LoginPage'))
const SignupPage       = lazy(() => import('./features/auth/SignupPage'))
const ForgotPasswordPage = lazy(() => import('./features/auth/ForgotPasswordPage'))
const DashboardPage    = lazy(() => import('./features/dashboard/DashboardPage'))
const WalletPage       = lazy(() => import('./features/wallet/WalletPage'))
const TransactionsPage = lazy(() => import('./features/transactions/TransactionsPage'))
const RewardsPage      = lazy(() => import('./features/rewards/RewardsPage'))
const KycPage          = lazy(() => import('./features/kyc/KycPage'))
const ProfilePage      = lazy(() => import('./features/profile/ProfilePage'))
const AdminDashboard   = lazy(() => import('./features/admin/AdminDashboard'))
const AdminUsers       = lazy(() => import('./features/admin/AdminUsers'))
const AdminKyc         = lazy(() => import('./features/admin/AdminKyc'))
const AdminCatalog     = lazy(() => import('./features/admin/AdminCatalog'))
// ── Guards ─────────────────────────────────────────────────────────────────────
const RequireAuth: React.FC<{ requireKyc?: boolean; adminOnly?: boolean; kycReady?: boolean }> = ({ requireKyc, adminOnly, kycReady = true }) => {
  const { accessToken, user } = useAppSelector(s => s.auth)
  const hasKycAccess = user?.role === 'ADMIN' || user?.kycStatus === 'APPROVED'
  if (!accessToken) return <Navigate to="/login" replace />
  if (adminOnly && user?.role !== 'ADMIN') return <Navigate to="/dashboard" replace />
  if (requireKyc && !kycReady) return <LoadingScreen />
  if (requireKyc && !hasKycAccess) return <Navigate to="/kyc" replace />
  return <Outlet />
}

export default function App() {
  const dispatch = useAppDispatch()
  const { accessToken, user } = useAppSelector(s => s.auth)
  const { loginAt } = useAppSelector(s => s.auth)
  const [kycReady, setKycReady] = useState(false)

  useEffect(() => {
    if (accessToken && user?.id) {
      dispatch(seedNotifications({
        userId: user.id,
        loginAt,
        kycStatus: user.kycStatus,
        role: user.role,
      }))
    }
  }, [accessToken, dispatch, loginAt, user?.id, user?.kycStatus, user?.role])

  useEffect(() => {
    let active = true

    const syncKycStatus = async () => {
      if (!accessToken || !user?.id) {
        if (active) setKycReady(true)
        return
      }

      if (user.role === 'ADMIN') {
        if (active && user.kycStatus !== 'APPROVED') {
          dispatch(updateKycStatus('APPROVED'))
        }
        if (active) setKycReady(true)
        return
      }

      if (active) setKycReady(false)
      try {
        const { data } = await kycService.status(user.id)
        const next = data?.data?.status
        if (active && next && next !== user.kycStatus) {
          dispatch(updateKycStatus(next))
        }
      } catch {
        // Keep current user status if status API fails; do not block navigation forever.
      } finally {
        if (active) setKycReady(true)
      }
    }

    void syncKycStatus()
    return () => { active = false }
  }, [accessToken, user?.id, user?.kycStatus, dispatch])

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Public auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login"  element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        {/* Protected app shell */}
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={user?.role === 'ADMIN' ? <Navigate to="/admin" replace /> : <DashboardPage />} />
            <Route path="/kyc"       element={<KycPage />} />
            <Route path="/profile"   element={<ProfilePage />} />

            {/* KYC-gated routes */}
            <Route element={<RequireAuth requireKyc kycReady={kycReady} />}>
              <Route path="/wallet"       element={<WalletPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/rewards"      element={<RewardsPage />} />
            </Route>

            {/* Admin-only routes */}
            <Route element={<RequireAuth adminOnly />}>
              <Route path="/admin"        element={<AdminDashboard />} />
              <Route path="/admin/users"  element={<AdminUsers />} />
              <Route path="/admin/kyc"    element={<AdminKyc />} />
              <Route path="/admin/catalog" element={<AdminCatalog />} />
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
