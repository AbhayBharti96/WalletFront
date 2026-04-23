import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { formatCurrency } from '../utils'
import { Icon8 } from './Icon8'

// ── Modal ─────────────────────────────────────────────────────────────────────
interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, size = 'md' }) => {
  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog" aria-modal="true" aria-label={title}
          >
            <motion.div
              className={`card w-full ${widths[size]} overflow-hidden`}
              initial={{ scale: 0.85, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.85, y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 220 }}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <h2 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>{title}</h2>
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-opacity hover:opacity-60 focus-visible:outline-none focus-visible:ring-2"
                  style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}
                  aria-label="Close modal"
                >✕</button>
              </div>
              <div className="p-5">{children}</div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Confirm Dialog ─────────────────────────────────────────────────────────────
interface ConfirmProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message?: string
  note?: string
  amount?: number
  confirmLabel?: string
  loading?: boolean
  danger?: boolean
}

export const ConfirmDialog: React.FC<ConfirmProps> = ({
  open, onClose, onConfirm, title, message, note = 'This action cannot be undone.', amount, confirmLabel = 'Confirm', loading, danger,
}) => {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="alertdialog" aria-modal="true" aria-label={title}>
            <motion.div
              className="card w-full max-w-sm text-center overflow-hidden"
              initial={{ scale: 0.7, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.7, y: 30, opacity: 0 }}
              transition={{ type: 'spring', damping: 18, stiffness: 250 }}
            >
              <div className="p-6 space-y-4">
                <motion.div className="inline-flex" initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}>
                  <Icon8 name={danger ? 'warning' : 'transfer'} size={44} />
                </motion.div>
                <div>
                  <h3 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{title}</h3>
                  {message && <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{message}</p>}
                  {amount != null && (
                    <div className="text-3xl font-display font-black mt-2" style={{ color: 'var(--brand)' }}>
                      {formatCurrency(amount)}
                    </div>
                  )}
                </div>
                {note && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{note}</p>}
                <div className="flex gap-3">
                  <button onClick={onClose} className="flex-1 btn-secondary py-2.5 text-sm">Cancel</button>
                  <button
                    onClick={onConfirm}
                    disabled={loading}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 ${danger ? 'btn-danger' : 'btn-primary'}`}
                    style={{ opacity: loading ? 0.6 : 1 }}
                  >
                    {loading ? 'Processing...' : confirmLabel}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Success Overlay ────────────────────────────────────────────────────────────
export const SuccessOverlay: React.FC<{ show: boolean; label: string; amount?: number }> = ({ show, label, amount }) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center"
          style={{ background: 'rgba(22,163,74,0.96)', backdropFilter: 'blur(4px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-live="assertive"
          aria-label={`${label} successful`}
        >
          <motion.div className="inline-flex" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 12 }}><Icon8 name="success" size={72} /></motion.div>
          <motion.h2 className="text-3xl font-display font-black text-white mt-4"
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
            {label} Successful!
          </motion.h2>
          {amount != null && (
            <motion.div className="text-4xl font-display font-bold text-white mt-1"
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
              {formatCurrency(amount)}
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton ${className}`} role="status" aria-label="Loading..." />
)

// ── Empty state ───────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon = <Icon8 name="info" size={36} />, title, description, action }) => (
  <div className="text-center py-10 px-4">
    <div className="mb-3 inline-flex" aria-hidden="true">{icon}</div>
    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</p>
    {description && (
      <p className="text-sm mt-1 max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>{description}</p>
    )}
    {action && (
      <button type="button" className="btn-primary mt-4 text-sm py-2 px-4" onClick={action.onClick}>
        {action.label}
      </button>
    )}
  </div>
)

// ── Loading Screen ─────────────────────────────────────────────────────────────
export const LoadingScreen: React.FC = () => (
  <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-bold text-white"
        style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 8px 32px rgba(34,197,94,0.3)' }}>
        P
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <motion.div key={i} className="w-2 h-2 rounded-full" style={{ background: 'var(--brand)' }}
            animate={{ y: [0, -8, 0] }} transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }} />
        ))}
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Loading PayVault…</p>
    </motion.div>
  </div>
)

// ── Not Found ─────────────────────────────────────────────────────────────────
export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ background: 'var(--bg-primary)' }}>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="text-8xl font-display font-black" style={{ color: 'var(--brand)' }}>404</div>
        <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>Page Not Found</h1>
        <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex gap-3 justify-center mt-4">
          <button onClick={() => navigate(-1)} className="btn-secondary py-2.5 px-5 text-sm">← Go Back</button>
          <button onClick={() => navigate('/dashboard')} className="btn-primary py-2.5 px-5 text-sm">Dashboard</button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────
// Some admin endpoints can return `null` for status/kycStatus; keep the UI resilient.
export const StatusBadge: React.FC<{ status?: string | null }> = ({ status }) => {
  const map: Record<string, string> = {
    SUCCESS: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    BLOCKED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    REVERSED: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    CASHBACK: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    COUPON: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    VOUCHER: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    NOT_SUBMITTED: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    INACTIVE: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  }
  const safeStatus = status ?? ''
  const statusClass = map[safeStatus] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${statusClass}`}>
      {safeStatus ? safeStatus.replace(/_/g, ' ') : '—'}
    </span>
  )
}
