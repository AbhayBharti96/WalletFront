// ─── AdminUsers.tsx ──────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAppSelector, useDebounce } from '../../shared/hooks'
import { adminService } from '../../core/api'
import { formatDate } from '../../shared/utils'
import { StatusBadge, Skeleton } from '../../shared/components/ui'
import type { AdminUserResponse } from '../../types'
import { Icon8 } from '../../shared/components/Icon8'

export function AdminUsers() {
  const { user } = useAppSelector(s => s.auth)
  const role = user?.role || 'ADMIN'
  const [users, setUsers] = useState<AdminUserResponse[]>([])
  const [total, setTotal] = useState(0); const [page, setPage] = useState(0); const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(''); const dSearch = useDebounce(search, 400)
  const [selected, setSelected] = useState<AdminUserResponse | null>(null)
  const [roleTo, setRoleTo] = useState(''); const [actioning, setActioning] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await adminService.listUsers(role, { page, size: 15 })
      setUsers(data.data?.content || []); setTotal(data.data?.totalElements || 0); setTotalPages(data.data?.totalPages || 1)
    } catch { toast.error('Failed') } finally { setLoading(false) }
  }, [role, page])

  useEffect(() => { if (!dSearch) fetchUsers() }, [dSearch, fetchUsers])

  useEffect(() => {
    if (!dSearch) return
    adminService.searchUsers(dSearch, role).then(r => { setUsers(r.data?.data?.content || []); setTotal(r.data?.data?.totalElements || 0) }).catch(() => {})
  }, [dSearch, role])

  const handleBlock = async (u: AdminUserResponse, block: boolean) => {
    setActioning(true)
    try { if (block) await adminService.blockUser(u.id, role); else await adminService.unblockUser(u.id, role); toast.success(block ? 'Blocked' : 'Unblocked'); setSelected(null); fetchUsers() }
    catch { toast.error('Failed') } finally { setActioning(false) }
  }

  const handleRole = async () => {
    if (!selected || !roleTo) return; setActioning(true)
    try { await adminService.changeRole(selected.id, roleTo, role); toast.success('Role updated'); setSelected(null); fetchUsers() }
    catch { toast.error('Failed') } finally { setActioning(false) }
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-5xl mx-auto">
      {/* User detail modal */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)} />
            <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="User management">
              <motion.div className="card w-full max-w-md overflow-hidden" initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 30 }}>
                <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border)' }}>
                  <h2 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>Manage User</h2>
                  <button onClick={() => setSelected(null)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>✕</button>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold text-white" style={{ background: 'linear-gradient(135deg,#22c55e,#6366f1)' }}>{(selected.name || 'U')[0].toUpperCase()}</div>
                    <div><div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{selected.name}</div><div className="text-sm" style={{ color: 'var(--text-muted)' }}>{selected.email}</div></div>
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    {[['Role', selected.role], ['Status', selected.status], ['KYC', selected.kycStatus], ['Joined', formatDate(selected.createdAt, 'DD MMM YYYY')]].map(([k, v]) => (
                      <div key={k}><dt className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{k}</dt><dd className="font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>{v}</dd></div>
                    ))}
                  </dl>
                  <div className="flex gap-2">
                    <select value={roleTo} onChange={e => setRoleTo(e.target.value)} className="input-field py-2 text-sm flex-1" aria-label="Select new role">
                      <option value="">Change Role…</option>
                      {['USER', 'ADMIN', 'MERCHANT'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button onClick={handleRole} disabled={!roleTo || actioning} className="btn-primary px-4 py-2 text-xs flex-shrink-0">Apply</button>
                  </div>
                  <div className="flex gap-3">
                    {selected.status === 'ACTIVE'
                      ? <button onClick={() => handleBlock(selected, true)} disabled={actioning} className="flex-1 btn-danger py-2.5 text-sm inline-flex items-center justify-center gap-1"><Icon8 name="blocked" size={14} /> Block</button>
                      : <button onClick={() => handleBlock(selected, false)} disabled={actioning} className="flex-1 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-1" style={{ background: '#dcfce7', color: '#16a34a' }}><Icon8 name="success" size={14} /> Unblock</button>
                    }
                    <button onClick={() => setSelected(null)} className="flex-1 btn-secondary py-2.5 text-sm">Close</button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div><h1 className="text-xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>User Management</h1></div>
      <div className="relative">
        <span className="absolute left-4 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center pointer-events-none" style={{ color: 'var(--text-muted)' }} aria-hidden="true"><Icon8 name="search" size={16} /></span>
        <input type="search" placeholder="Search by name, email, or phone…" value={search} onChange={e => setSearch(e.target.value)}
          className="input-field py-2.5 text-sm" style={{ paddingLeft: '3.5rem' }} aria-label="Search users" />
      </div>

      <motion.div className="card overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="px-5 py-3 border-b text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>{total.toLocaleString()} users</div>
        {loading
          ? <div className="p-5 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="flex gap-3"><Skeleton className="w-9 h-9 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-1/3" /></div></div>)}</div>
          : users.length === 0 ? <div className="text-center py-12"><div className="inline-flex mb-3"><Icon8 name="transactions" size={36} /></div><p style={{ color: 'var(--text-muted)' }}>No users found</p></div>
          : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full" role="grid" aria-label="Users list">
                  <thead><tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                    {['User', 'Role', 'Status', 'KYC', 'Joined', ''].map(h => <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {users.map((u, i) => (
                      <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg,#22c55e,#6366f1)' }}>{(u.name || 'U')[0].toUpperCase()}</div>
                            <div><div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{u.name || '—'}</div><div className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.email}</div></div>
                          </div>
                        </td>
                        <td className="px-5 py-3"><StatusBadge status={u.role} /></td>
                        <td className="px-5 py-3"><StatusBadge status={u.status} /></td>
                        <td className="px-5 py-3"><StatusBadge status={u.kycStatus} /></td>
                        <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(u.createdAt, 'DD MMM YY')}</td>
                        <td className="px-5 py-3"><button onClick={() => setSelected(u)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }} aria-label={`Manage ${u.name}`}>Manage</button></td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn-secondary py-1.5 px-4 text-xs" style={{ opacity: page === 0 ? 0.4 : 1 }}>← Prev</button>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Page {page + 1} of {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="btn-secondary py-1.5 px-4 text-xs" style={{ opacity: page >= totalPages - 1 ? 0.4 : 1 }}>Next →</button>
              </div>
            </>
          )
        }
      </motion.div>
    </div>
  )
}
export default AdminUsers
