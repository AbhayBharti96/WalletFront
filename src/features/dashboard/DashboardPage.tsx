import { useEffect, Suspense, lazy, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAppDispatch, useAppSelector, useTheme } from '../../shared/hooks'
import { fetchBalance, fetchTransactions } from '../../store/walletSlice'
import { fetchRewardSummary } from '../../store/rewardsSlice'
import { formatCurrency, getKycInfo, getTierStyle, getTierIcon, getTierProgress } from '../../shared/utils'
import { Skeleton } from '../../shared/components/ui'
import { Icon8 } from '../../shared/components/Icon8'
import { buildWeeklyCashflow } from './weeklyCashflow'

const SpendingOverviewChart = lazy(() => import('./SpendingOverviewChart'))

const lightCardShadow = '0 12px 28px -18px rgba(15,23,42,0.32), 0 3px 8px -3px rgba(15,23,42,0.12)'

const StatCard: React.FC<{
  icon: React.ReactNode
  label: string
  value: string
  sub?: React.ReactNode
  color?: string
  iconColor?: string
  delay?: number
  isDark?: boolean
  onClick?: () => void
}> = ({ icon, label, value, sub, color = 'var(--brand)', iconColor, delay = 0, isDark = false, onClick }) => (
  <motion.div
    className="p-4 rounded-2xl"
    initial={{ opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    style={{
      background: '#ffffff',
      border: '1px solid #cde5db',
      boxShadow: isDark ? 'none' : lightCardShadow,
      cursor: onClick ? 'pointer' : 'default',
    }}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
  >
    <div className="flex items-start justify-between mb-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: `${color}20`, color: iconColor ?? color }}>{icon}</div>
      <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: `${color}20`, color }}>
        Live
      </span>
    </div>
    <div className="text-2xl leading-none tracking-tight font-black" style={{ color: '#0f2342' }}>{value}</div>
    <div className="text-xs font-black tracking-wide mt-1" style={{ color: '#44566f' }}>{label.toUpperCase()}</div>
    {sub && <div className="text-xs mt-3 font-medium" style={{ color: '#9ca6b6' }}>{sub}</div>}
  </motion.div>
)

export default function DashboardPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { user } = useAppSelector(s => s.auth)
  const { balance, loading: wLoad, transactions } = useAppSelector(s => s.wallet)
  const { summary, loading: rLoad } = useAppSelector(s => s.rewards)
  const [showBalance, setShowBalance] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    dispatch(fetchBalance())
    dispatch(fetchTransactions({ page: 0, size: 100 }))
    dispatch(fetchRewardSummary())
  }, [dispatch, user?.id])

  const kycI = getKycInfo(user?.kycStatus)
  const KycIcon = kycI.icon
  const tierS = getTierStyle(summary?.tier)
  const TierIcon = getTierIcon(summary?.tier)
  const tierProgress = getTierProgress(summary)
  const currentTier = tierProgress.currentTier
  const nextTier = tierProgress.nextTier
  const points = tierProgress.points
  const pointsToNextTier = tierProgress.remaining
  const targetForNextTier = tierProgress.nextThreshold
  const tierProgressPct = tierProgress.percent
  const nextTierStyle = getTierStyle(nextTier)
  const showKycBanner = user?.kycStatus === 'NOT_SUBMITTED'
  const maskedBalance = '₹••••••'
  const balanceText = showBalance ? formatCurrency(balance?.balance ?? 0) : maskedBalance
  const weeklyCashflow = useMemo(
    () => buildWeeklyCashflow(transactions?.content ?? [], user?.id),
    [transactions?.content, user?.id]
  )

  const tierProgressScale = (() => {
    return tierProgress.scale
  })()

  return (
    <div className="mx-auto max-w-[1080px] space-y-4 p-3 sm:p-4 lg:p-5">
      <motion.section
        className="rounded-[24px] p-4 lg:p-5"
        style={{ background: 'linear-gradient(120deg, #cde8dd 0%, #c7e0e4 100%)', border: '1px solid #b7d2ce' }}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="grid items-center gap-4 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-3" style={{ background: '#ecf5ef' }}>
              <span aria-hidden="true"><Icon8 name="success" size={14} /></span>
              <span className="text-xs font-black tracking-[0.2em]" style={{ color: '#22b96f' }}>ACCOUNT OVERVIEW</span>
            </div>
            <h1 className="max-w-xl text-2xl font-extrabold leading-[1.1] sm:text-3xl lg:text-4xl" style={{ color: '#0c1a3a' }}>
              Manage your wallet, KYC status, and reward growth from one place.
            </h1>
              <p className="mt-3 text-xs lg:text-sm leading-relaxed max-w-xl" style={{ color: '#4f6275' }}>
                View live wallet balance, KYC status, reward points, and next-tier progress in one place with fast actions for top-up, transfer, and redemption.
              </p>
            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
              <button
                onClick={() => navigate('/wallet')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition-all hover:brightness-95 sm:w-auto"
                style={{ background: '#23c363', color: 'white', boxShadow: '0 12px 24px rgba(35,195,99,0.3)' }}
              >
                Go to wallet
                <span aria-hidden="true">-&gt;</span>
              </button>
              <button
                onClick={() => navigate('/rewards')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all hover:opacity-85 sm:w-auto"
                style={{ background: '#f5f7f8', color: '#172338', border: '1px solid #d9e2e8' }}
              >
                <Icon8 name="rewards" size={18} />
                View rewards
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-3xl p-4" style={{ background: '#f4f6f8', border: '1px solid #d5dee6', boxShadow: isDark ? 'none' : lightCardShadow }}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium" style={{ color: '#9ea8ba' }}>Available Balance</div>
                <button
                  type="button"
                  onClick={() => setShowBalance(v => !v)}
                  className="w-9 h-9 rounded-xl inline-flex items-center justify-center transition-opacity hover:opacity-80"
                  style={{ background: '#ffffff', color: '#0e1f3f', border: '1px solid #d5dee6' }}
                  aria-label={showBalance ? 'Hide wallet balance' : 'Show wallet balance'}
                  aria-pressed={showBalance}
                >
                  <Icon8 name={showBalance ? 'eyeOff' : 'eye'} size={18} />
                </button>
              </div>
              <div className="mt-2 break-words text-3xl font-black leading-none sm:text-4xl" style={{ color: '#0e1f3f' }}>{wLoad ? '...' : balanceText}</div>
              <div
                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: '#ddf3e5', color: '#2aa260' }}
              >
                <span aria-hidden="true">&#8599;</span>
                Active wallet state
              </div>
            </div>
            <div className="rounded-3xl p-4" style={{ background: '#f4f6f8', border: '1px solid #d5dee6', boxShadow: isDark ? 'none' : lightCardShadow }}>
              <div className="text-sm font-medium" style={{ color: '#9ea8ba' }}>Reward Points</div>
              <div className="mt-2 break-words text-3xl font-black leading-none sm:text-4xl" style={{ color: '#0e1f3f' }}>{rLoad ? '...' : points.toLocaleString()}</div>
              <div
                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: tierS.bg, color: tierS.text, border: `1px solid ${tierS.border}` }}
              >
                <TierIcon fontSize="inherit" />
                {currentTier} tier
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {showKycBanner && (
        <motion.div
          className="flex flex-col gap-3 rounded-2xl px-4 py-3 sm:flex-row sm:items-center"
          style={{ background: kycI.bg, border: `1px solid ${kycI.color}40` }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="text-xl" aria-hidden="true"><KycIcon fontSize="inherit" /></span>
          <p className="flex-1 text-sm font-medium" style={{ color: kycI.color }}>{kycI.label} - Wallet features locked</p>
          <button
            onClick={() => navigate('/kyc')}
            className="text-xs font-bold px-3 py-1.5 rounded-lg text-white flex-shrink-0"
            style={{ background: kycI.color }}
            aria-label="Go to KYC verification"
          >
            {user?.kycStatus === 'REJECTED' ? 'Resubmit' : 'Start KYC'}
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard icon={<Icon8 name="wallet" size={24} />} label="Wallet Balance" delay={0} isDark={isDark} value={wLoad ? '...' : balanceText} sub={`Status: ${balance?.status ?? 'INACTIVE'}`} onClick={() => navigate('/wallet')} />
        <StatCard
          icon={<Icon8 name="rewards" size={24} />}
          label="Reward Points"
          color={tierS.text}
          iconColor={tierS.text}
          delay={0.05}
          isDark={isDark}
          value={rLoad ? '...' : points.toLocaleString()}
          sub={<span className="inline-flex items-center gap-1" style={{ color: tierS.text }}><TierIcon fontSize="inherit" /> {currentTier}</span>}
          onClick={() => navigate('/rewards')}
        />
        <StatCard
          icon={<Icon8 name="target" size={24} />}
          label="Next Tier Progress"
          color={nextTier ? nextTierStyle.text : '#6366f1'}
          iconColor={nextTier ? nextTierStyle.text : '#6366f1'}
          delay={0.1}
          isDark={isDark}
          value={rLoad ? '...' : `${tierProgressPct}%`}
          sub={nextTier ? `${points.toLocaleString()} / ${targetForNextTier.toLocaleString()} pts to ${nextTier}` : 'Max tier unlocked'}
          onClick={() => navigate('/rewards')}
        />
        <StatCard icon={<Icon8 name="shield" size={24} />} label="KYC Status" color={kycI.color} delay={0.15} isDark={isDark} value={user?.kycStatus?.replace('_', ' ') ?? '-'} sub={kycI.label} onClick={() => navigate('/kyc')} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <motion.div
          className="p-4 lg:col-span-2 rounded-2xl"
          style={{ background: '#ffffff', border: '1px solid #cde5db', boxShadow: isDark ? 'none' : lightCardShadow }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl leading-tight font-bold" style={{ color: '#1d2b44' }}>Spending Overview</h3>
              <p className="text-xs mt-0.5" style={{ color: '#6c7f90' }}>Debit vs credit this week</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="inline-flex items-center gap-1" style={{ color: '#22c55e' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
                Credit
              </span>
              <span className="inline-flex items-center gap-1" style={{ color: '#ef4444' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />
                Debit
              </span>
            </div>
          </div>
          <Suspense fallback={<Skeleton className="h-[180px] w-full" />}>
            <SpendingOverviewChart data={weeklyCashflow} />
          </Suspense>
        </motion.div>

        <motion.div
          className="p-4 rounded-2xl"
          style={{ background: '#ffffff', border: '1px solid #cde5db', boxShadow: isDark ? 'none' : lightCardShadow }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <h3 className="text-xl leading-tight font-bold mb-4" style={{ color: '#1d2b44' }}>Loyalty Tier</h3>
          <div className="text-center">
            <div className="mb-2 inline-flex items-center justify-center rounded-2xl p-3" style={{ background: tierS.bg, color: tierS.text, border: `1px solid ${tierS.border}` }}>
              <span className="inline-flex text-[44px] leading-none" aria-hidden="true"><TierIcon fontSize="inherit" /></span>
            </div>
            <div className="font-black text-lg" style={{ color: tierS.text }}>{currentTier}</div>
            <div className="text-xs mt-1 mb-3" style={{ color: '#7d8a9e' }}>{points.toLocaleString()} total points</div>
            {nextTier && (
              <div>
                <div className="flex justify-between text-xs mb-1" style={{ color: '#7d8a9e' }}>
                  <span>{currentTier}</span>
                  <span>{nextTier}</span>
                </div>
                <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: '#dce4ea' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${tierS.text}, ${nextTierStyle.text})`,
                      width: '100%',
                      transformOrigin: 'left',
                    }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: tierProgressScale }}
                    transition={{ delay: 0.5, duration: 1 }}
                  />
                </div>
                <div className="text-xs mt-1" style={{ color: '#7d8a9e' }}>
                  {points.toLocaleString()} / {targetForNextTier.toLocaleString()} pts
                </div>
                <div className="text-xs mt-0.5 text-right" style={{ color: '#7d8a9e' }}>{pointsToNextTier.toLocaleString()} pts to {nextTier}</div>
              </div>
            )}
          </div>
          <button onClick={() => navigate('/rewards')} className="w-full btn-primary py-2 text-xs mt-4">View Rewards -&gt;</button>
        </motion.div>
      </div>

      <motion.div
        className="p-4 rounded-2xl"
        style={{ background: '#ffffff', border: '1px solid #cde5db', boxShadow: isDark ? 'none' : lightCardShadow }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold" style={{ color: '#1d2b44' }}>Quick Actions</h3>
          <span className="text-[10px] font-semibold" style={{ color: '#98a6b6' }}>Fast access</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" role="group" aria-label="Quick actions">
          {([
            { icon: 'topup', label: 'Top Up', to: '/wallet', color: '#22c55e' },
            { icon: 'transfer', label: 'Transfer', to: '/wallet', color: '#6366f1' },
            { icon: 'withdraw', label: 'Withdraw', to: '/wallet', color: '#f59e0b' },
            { icon: 'rewards', label: 'Redeem', to: '/rewards', color: '#ec4899' },
          ] as const).map((a, i) => (
            <motion.button
              key={a.label}
              onClick={() => navigate(a.to)}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-all"
              style={{ background: `${a.color}10`, border: `1px solid ${a.color}25`, color: a.color }}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.32 + i * 0.05 }}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              aria-label={a.label}
            >
              <span className="inline-flex" aria-hidden="true"><Icon8 name={a.icon} size={20} /></span>
              <span className="text-xs font-semibold" style={{ color: '#44566f' }}>{a.label}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
