import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { adminService } from '../../core/api'
import { useAppSelector } from '../../shared/hooks'
import { formatCurrency, formatDate, getTierStyle } from '../../shared/utils'
import { ConfirmDialog, EmptyState, Skeleton, StatusBadge } from '../../shared/components/ui'
import { Icon8 } from '../../shared/components/Icon8'
import type { RewardItem, RewardItemPayload, RewardItemType, RewardTier } from '../../types'

type CatalogForm = {
  name: string
  description: string
  type: RewardItemType
  pointsRequired: string
  cashbackAmount: string
  tierRequired: '' | RewardTier
  stock: string
  active: boolean
  activeFrom: string
  activeUntil: string
}

const emptyForm: CatalogForm = {
  name: '',
  description: '',
  type: 'VOUCHER',
  pointsRequired: '',
  cashbackAmount: '',
  tierRequired: '',
  stock: '100',
  active: true,
  activeFrom: '',
  activeUntil: '',
}

const toForm = (item: RewardItem): CatalogForm => ({
  name: item.name || '',
  description: item.description || '',
  type: item.type,
  pointsRequired: String(item.pointsRequired ?? ''),
  cashbackAmount: item.cashbackAmount != null ? String(item.cashbackAmount) : '',
  tierRequired: item.tierRequired || '',
  stock: String(item.stock ?? 0),
  active: Boolean(item.active),
  activeFrom: item.activeFrom ? item.activeFrom.slice(0, 16) : '',
  activeUntil: item.activeUntil ? item.activeUntil.slice(0, 16) : '',
})

const validateForm = (form: CatalogForm) => {
  if (!form.name.trim()) return 'Reward name is required'
  const points = Number(form.pointsRequired)
  if (!Number.isFinite(points) || points <= 0) return 'Points required must be greater than zero'
  const stock = Number(form.stock)
  if (!Number.isInteger(stock) || stock < 0) return 'Stock must be zero or more'
  if (form.type === 'CASHBACK') {
    const cashback = Number(form.cashbackAmount)
    if (!Number.isFinite(cashback) || cashback <= 0) return 'Cashback amount is required for cashback rewards'
  }
  if (form.activeFrom && form.activeUntil && form.activeUntil < form.activeFrom) {
    return 'Active until must be after active from'
  }
  return null
}

const toPayload = (form: CatalogForm): RewardItemPayload => ({
  name: form.name.trim(),
  description: form.description.trim() || undefined,
  type: form.type,
  pointsRequired: Number(form.pointsRequired),
  cashbackAmount: form.type === 'CASHBACK' ? Number(form.cashbackAmount) : null,
  tierRequired: form.tierRequired || null,
  stock: Number(form.stock),
  active: form.active,
  activeFrom: form.activeFrom || null,
  activeUntil: form.activeUntil || null,
})

const tierSelectStyle = (tier: CatalogForm['tierRequired']) => {
  if (!tier) return undefined
  const colors: Record<RewardTier, { bg: string; color: string; border: string }> = {
    SILVER: { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' },
    GOLD: { bg: '#fef9c3', color: '#a16207', border: '#fbbf24' },
    PLATINUM: { bg: '#ede9fe', color: '#7c3aed', border: '#a78bfa' },
  }
  const c = colors[tier]
  return { background: c.bg, color: c.color, borderColor: c.border }
}

export function AdminCatalog() {
  const { user } = useAppSelector(s => s.auth)
  const role = user?.role || 'ADMIN'
  const [items, setItems] = useState<RewardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState(false)
  const [form, setForm] = useState<CatalogForm>(emptyForm)
  const [editing, setEditing] = useState<RewardItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RewardItem | null>(null)

  const activeCount = useMemo(() => items.filter(item => item.active).length, [items])

  const loadCatalog = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await adminService.catalog(role)
      setItems(data.data || [])
    } catch {
      toast.error('Could not load catalog')
    } finally {
      setLoading(false)
    }
  }, [role])

  useEffect(() => { void loadCatalog() }, [loadCatalog])

  const resetForm = () => {
    setForm(emptyForm)
    setEditing(null)
  }

  const startEdit = (item: RewardItem) => {
    setEditing(item)
    setForm(toForm(item))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const error = validateForm(form)
    if (error) {
      toast.error(error)
      return
    }

    setActioning(true)
    try {
      const payload = toPayload(form)
      if (editing) {
        await adminService.updateCatalogItem(editing.id, payload, role)
        toast.success('Catalog item updated')
      } else {
        await adminService.addCatalogItem(payload, role)
        toast.success('Catalog item added')
      }
      resetForm()
      await loadCatalog()
    } catch {
      toast.error('Catalog update failed')
    } finally {
      setActioning(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setActioning(true)
    try {
      await adminService.deleteCatalogItem(deleteTarget.id, role)
      toast.success('Catalog item deleted')
      setDeleteTarget(null)
      await loadCatalog()
    } catch {
      toast.error('Delete failed')
    } finally {
      setActioning(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-6xl mx-auto">
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete catalog item"
        message={deleteTarget ? `Delete ${deleteTarget.name}?` : undefined}
        confirmLabel="Delete"
        loading={actioning}
        danger
      />

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>Catalog Management</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {items.length} items, {activeCount} active
          </p>
        </div>
        {editing && (
          <button type="button" onClick={resetForm} className="btn-secondary px-4 py-2 text-sm">
            Add New
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Icon8 name="rewards" size={22} />
          <h2 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
            {editing ? 'Edit Catalog Item' : 'Add Catalog Item'}
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Name</span>
            <input
              className="input-field"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Amazon voucher"
              required
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Type</span>
            <select
              className="input-field"
              value={form.type}
              onChange={e => setForm(prev => ({ ...prev, type: e.target.value as RewardItemType, cashbackAmount: e.target.value === 'CASHBACK' ? prev.cashbackAmount : '' }))}
            >
              <option value="VOUCHER">Voucher</option>
              <option value="COUPON">Coupon</option>
              <option value="CASHBACK">Cashback</option>
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Points Required</span>
            <input
              className="input-field"
              type="number"
              min="1"
              value={form.pointsRequired}
              onChange={e => setForm(prev => ({ ...prev, pointsRequired: e.target.value }))}
              placeholder="500"
              required
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Stock</span>
            <input
              className="input-field"
              type="number"
              min="0"
              step="1"
              value={form.stock}
              onChange={e => setForm(prev => ({ ...prev, stock: e.target.value }))}
              required
            />
          </label>

          {form.type === 'CASHBACK' && (
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Cashback Amount</span>
              <input
                className="input-field"
                type="number"
                min="1"
                step="0.01"
                value={form.cashbackAmount}
                onChange={e => setForm(prev => ({ ...prev, cashbackAmount: e.target.value }))}
                placeholder="50"
                required
              />
            </label>
          )}

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Tier</span>
            <select
              className="input-field"
              value={form.tierRequired}
              onChange={e => setForm(prev => ({ ...prev, tierRequired: e.target.value as '' | RewardTier }))}
              style={tierSelectStyle(form.tierRequired)}
            >
              <option value="">Any tier</option>
              <option value="SILVER">Silver</option>
              <option value="GOLD">Gold</option>
              <option value="PLATINUM">Platinum</option>
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Active From</span>
            <div className="relative">
              <input
                className="input-field catalog-date-input pr-12"
                type="datetime-local"
                value={form.activeFrom}
                onChange={e => setForm(prev => ({ ...prev, activeFrom: e.target.value }))}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} aria-hidden="true">
                <Icon8 name="calendar" size={18} />
              </span>
            </div>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Active Until</span>
            <div className="relative">
              <input
                className="input-field catalog-date-input pr-12"
                type="datetime-local"
                value={form.activeUntil}
                onChange={e => setForm(prev => ({ ...prev, activeUntil: e.target.value }))}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} aria-hidden="true">
                <Icon8 name="calendar" size={18} />
              </span>
            </div>
          </label>
        </div>

        <label className="space-y-1.5 block">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Description</span>
          <textarea
            className="input-field min-h-20"
            value={form.description}
            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Short redemption detail"
          />
        </label>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
          <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={e => setForm(prev => ({ ...prev, active: e.target.checked }))}
              className="w-4 h-4"
            />
            Active in catalog
          </label>
          <div className="flex gap-2">
            {editing && <button type="button" onClick={resetForm} className="btn-secondary px-4 py-2 text-sm">Cancel</button>}
            <button type="submit" disabled={actioning} className="btn-primary px-5 py-2 text-sm" style={{ opacity: actioning ? 0.65 : 1 }}>
              {actioning ? 'Saving...' : editing ? 'Update Item' : 'Add Item'}
            </button>
          </div>
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b text-sm font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
          Catalog Items
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="No catalog items" description="Add the first reward for users to redeem." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" role="grid" aria-label="Catalog list">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                  {['Reward', 'Type', 'Tier', 'Cost', 'Cashback', 'Stock', 'Active', 'Window', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {items.map(item => (
                  <tr key={item.id}>
                    <td className="px-5 py-3 min-w-56">
                      <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{item.name}</div>
                      <div className="text-xs line-clamp-1" style={{ color: 'var(--text-muted)' }}>{item.description || 'No description'}</div>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={item.type} /></td>
                    <td className="px-5 py-3">
                      {item.tierRequired ? (
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={{
                            background: getTierStyle(item.tierRequired).bg,
                            color: getTierStyle(item.tierRequired).text,
                            border: `1px solid ${getTierStyle(item.tierRequired).border}`,
                          }}
                        >
                          {item.tierRequired}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Any</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{item.pointsRequired} pts</td>
                    <td className="px-5 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {item.type === 'CASHBACK' ? formatCurrency(item.cashbackAmount || 0) : '-'}
                    </td>
                    <td className="px-5 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{item.stock}</td>
                    <td className="px-5 py-3"><StatusBadge status={item.active ? 'ACTIVE' : 'INACTIVE'} /></td>
                    <td className="px-5 py-3 text-xs min-w-44" style={{ color: 'var(--text-muted)' }}>
                      {item.activeFrom || item.activeUntil
                        ? `${formatDate(item.activeFrom, 'DD MMM YY')} - ${formatDate(item.activeUntil, 'DD MMM YY')}`
                        : 'Always'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => startEdit(item)} className="btn-secondary px-3 py-1.5 text-xs">Edit</button>
                        <button type="button" onClick={() => setDeleteTarget(item)} className="btn-danger px-3 py-1.5 text-xs">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminCatalog
