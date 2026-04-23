// ─── AdminDashboard.tsx ──────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useAppSelector } from '../../shared/hooks'
import { adminService } from '../../core/api'
import type { AdminDashboard as AdminDashboardType } from '../../types'
import { Icon8 } from '../../shared/components/Icon8'

const COLORS = ['#22c55e', '#6366f1', '#f59e0b', '#ef4444']

const S: React.FC<{ icon: React.ReactNode; label: string; value?: number; color?: string; delay?: number }> =
  ({ icon, label, value, color = 'var(--brand)', delay = 0 }) => (
  <motion.div className="card p-5" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
    <div className="flex items-center gap-3 mb-2">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: `${color}15` }}>{icon}</div>
      <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
    <div className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>{value?.toLocaleString() ?? '—'}</div>
  </motion.div>
)

export function AdminDashboard() {
  const { user } = useAppSelector(s => s.auth)
  const [stats, setStats] = useState<AdminDashboardType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { adminService.dashboard(user?.role || 'ADMIN').then(r => setStats(r.data.data)).catch(() => {}).finally(() => setLoading(false)) }, [])

  if (loading) return <div className="p-6 flex justify-center h-64 items-center"><div className="animate-spin w-8 h-8 rounded-full border-2" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} /></div>

  const kycData = stats ? [
    { name: 'Approved', value: stats.kycApproved }, { name: 'Pending', value: stats.kycPending },
    { name: 'Rejected', value: stats.kycRejected }, { name: 'Not Submitted', value: stats.kycNotSubmitted },
  ] : []
  const growthData = stats ? [
    { l: 'Today', v: stats.newUsersToday }, { l: 'This Week', v: stats.newUsersThisWeek }, { l: 'This Month', v: stats.newUsersThisMonth },
  ] : []
  const Tip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return <div className="card px-3 py-2 text-xs"><div style={{ color: 'var(--text-muted)' }}>{label || payload[0].name}</div><div className="font-bold" style={{ color: 'var(--brand)' }}>{payload[0].value}</div></div>
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>Admin Dashboard</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          Monitor wallet platform health with user growth, KYC pipeline status, approvals, and account activity metrics.
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <S icon={<Icon8 name="users" size={20} />} label="Total Users" value={stats?.totalUsers} delay={0} />
        <S icon={<Icon8 name="success" size={20} />} label="Active Users" value={stats?.activeUsers} color="#22c55e" delay={0.05} />
        <S icon={<Icon8 name="blocked" size={20} />} label="Blocked" value={stats?.blockedUsers} color="#ef4444" delay={0.1} />
        <S icon={<Icon8 name="clock" size={20} />} label="KYC Pending" value={stats?.kycPending} color="#f59e0b" delay={0.15} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <S icon={<Icon8 name="new" size={20} />} label="New Today" value={stats?.newUsersToday} color="#6366f1" delay={0.2} />
        <S icon={<Icon8 name="calendar" size={20} />} label="This Week" value={stats?.newUsersThisWeek} color="#6366f1" delay={0.22} />
        <S icon={<Icon8 name="success" size={20} />} label="KYC Approved Today" value={stats?.kycApprovedToday} color="#22c55e" delay={0.24} />
        <S icon={<Icon8 name="error" size={20} />} label="KYC Rejected Today" value={stats?.kycRejectedToday} color="#ef4444" delay={0.26} />
      </div>
      <div className="grid lg:grid-cols-3 gap-5">
        <motion.div className="card p-5 lg:col-span-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h3 className="font-display font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>User Growth</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={growthData}><XAxis dataKey="l" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} /><YAxis hide /><Tooltip content={<Tip />} /><Bar dataKey="v" fill="#22c55e" radius={[6,6,0,0]} /></BarChart>
          </ResponsiveContainer>
        </motion.div>
        <motion.div className="card p-5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <h3 className="font-display font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>KYC Status</h3>
          <ResponsiveContainer width="100%" height={160}><PieChart><Pie data={kycData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value">{kycData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Pie><Tooltip content={<Tip />} /></PieChart></ResponsiveContainer>
          <div className="space-y-1 mt-2">{kycData.map((d, i) => (<div key={d.name} className="flex items-center justify-between text-xs"><div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} /><span style={{ color: 'var(--text-secondary)' }}>{d.name}</span></div><span className="font-medium" style={{ color: 'var(--text-primary)' }}>{d.value}</span></div>))}</div>
        </motion.div>
      </div>
    </div>
  )
}
export default AdminDashboard
