// AuthLayout.tsx
import { Outlet, Navigate, Link } from 'react-router-dom'
import { useAppSelector } from '../shared/hooks'
import { useTheme } from '../shared/hooks'
import { motion } from 'framer-motion'
import { Icon8 } from '../shared/components/Icon8'

export default function AuthLayout() {
  const { accessToken } = useAppSelector(s => s.auth)
  const { isDark, toggle } = useTheme()
  if (accessToken) return <Navigate to="/dashboard" replace />

  const features = [
    { icon: 'wallet', label: 'Smart Wallet', desc: 'Secure P2P transfers' },
    { icon: 'rewards', label: 'Earn Rewards', desc: 'Points on every top-up' },
    { icon: 'transactions', label: 'Live Analytics', desc: 'Track your spending' },
    { icon: 'shield', label: 'KYC Secured', desc: 'Verified identities' },
  ] as const

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>
      {/* Branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-5/12 p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg,#052e16 0%,#0d3320 45%,#0a0f1e 100%)' }}>
        <div className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'linear-gradient(rgba(34,197,94,.4) 1px,transparent 1px),linear-gradient(90deg,rgba(34,197,94,.4) 1px,transparent 1px)', backgroundSize: '36px 36px' }} />
        <div className="absolute top-1/3 left-1/4 w-72 h-72 rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle,#22c55e,transparent)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full blur-3xl opacity-10"
          style={{ background: 'radial-gradient(circle,#818cf8,transparent)' }} />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-xl"
            style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>P</div>
          <span className="font-display font-bold text-white text-xl">PayVault</span>
        </div>

        <motion.div className="relative z-10 space-y-4"
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h1 className="text-4xl font-display font-bold text-white leading-snug">
            Your Digital<br />
            <span style={{ color: '#4ade80' }}>Wallet & Rewards</span><br />
            All in One Place
          </h1>
          <p className="text-base" style={{ color: '#86efac' }}>
            Top up, transfer, earn points — and manage everything from one powerful dashboard.
          </p>
        </motion.div>

        <div className="relative z-10 grid grid-cols-2 gap-3">
          {features.map((f, i) => (
            <motion.div key={f.label}
              className="rounded-xl p-3.5"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + i * 0.07 }}>
              <div className="mb-1 inline-flex" aria-hidden="true"><Icon8 name={f.icon} size={24} /></div>
              <div className="text-sm font-semibold text-white">{f.label}</div>
              <div className="text-xs mt-0.5" style={{ color: '#86efac' }}>{f.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col">
        <div className="flex justify-between items-center px-6 py-4">
          <div className="lg:hidden flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-sm"
              style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>P</div>
            <span className="font-display font-bold" style={{ color: 'var(--text-primary)' }}>PayVault</span>
          </div>
          <div className="ml-auto">
            <button onClick={toggle} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="px-3 py-2 rounded-xl transition-all inline-flex items-center gap-1.5 text-xs font-medium"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <Icon8 name={isDark ? 'sun' : 'moon'} size={18} />
              <span style={{ color: 'var(--text-secondary)' }}>{isDark ? 'Dark' : 'Light'}</span>
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <motion.div className="w-full max-w-md"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <Outlet />
          </motion.div>
        </div>
      </div>
    </div>
  )
}
