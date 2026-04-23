import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAppSelector } from '../../shared/hooks'
import { adminService } from '../../core/api'
import { formatDate } from '../../shared/utils'
import { Skeleton } from '../../shared/components/ui'
import type { KycStatusResponse } from '../../types'
import { Icon8 } from '../../shared/components/Icon8'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

const resolveDocPreviewUrl = (docFilePath?: string): string | null => {
  if (!docFilePath) return null
  if (/^https?:\/\//i.test(docFilePath)) return docFilePath

  const normalized = docFilePath.replace(/\\/g, '/')
  const uploadsIndex = normalized.toLowerCase().indexOf('/uploads/')
  const maybePublicPath = uploadsIndex >= 0 ? normalized.slice(uploadsIndex) : normalized

  if (maybePublicPath.startsWith('/')) {
    return API_BASE ? `${API_BASE}${maybePublicPath}` : maybePublicPath
  }
  if (maybePublicPath.startsWith('api/')) {
    return API_BASE ? `${API_BASE}/${maybePublicPath}` : `/${maybePublicPath}`
  }
  return API_BASE ? `${API_BASE}/${maybePublicPath}` : `/${maybePublicPath}`
}

const getFileExt = (url?: string | null): string => {
  if (!url) return ''
  const clean = url.split('?')[0].split('#')[0]
  const dot = clean.lastIndexOf('.')
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : ''
}

export function AdminKyc() {
  const { user } = useAppSelector(s => s.auth)
  const role = user?.role || 'ADMIN'
  const [items, setItems] = useState<KycStatusResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [selected, setSelected] = useState<KycStatusResponse | null>(null)
  const [reason, setReason] = useState('')
  const [actioning, setActioning] = useState(false)
  const [docPreviewError, setDocPreviewError] = useState(false)

  useEffect(() => {
    void fetchPending()
  }, [page])

  const fetchPending = async () => {
    setLoading(true)
    try {
      const { data } = await adminService.pendingKyc(role, page)
      setItems(data.data?.content || [])
      setTotalPages(data.data?.totalPages || 1)
    } catch {
      toast.error('Failed to load KYC queue')
    } finally {
      setLoading(false)
    }
  }

  const handle = async (approve: boolean) => {
    if (!selected || !user) return
    if (!approve && !reason.trim()) {
      toast.error('Provide a rejection reason')
      return
    }
    setActioning(true)
    try {
      if (approve) {
        await adminService.approveKyc(selected.kycId, role, user.email!)
      } else {
        await adminService.rejectKyc(selected.kycId, reason, role, user.email!)
      }
      toast.success(approve ? 'KYC Approved' : 'KYC Rejected')
      setSelected(null)
      setReason('')
      void fetchPending()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Action failed')
    } finally {
      setActioning(false)
    }
  }

  const selectedDocUrl = resolveDocPreviewUrl(selected?.docFilePath)
  const selectedDocExt = getFileExt(selectedDocUrl)
  const isPdf = selectedDocExt === 'pdf'
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(selectedDocExt)

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-4xl mx-auto">
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
            />
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-label="KYC Review"
            >
              <motion.div
                className="card w-full max-w-lg overflow-hidden"
                initial={{ scale: 0.85, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.85, y: 30 }}
              >
                <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border)' }}>
                  <h2 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>KYC Review - #{selected.kycId}</h2>
                  <button onClick={() => setSelected(null)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>X</button>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <div className="text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                      Submitted Document
                    </div>
                    {selectedDocUrl ? (
                      <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)', background: 'var(--bg-primary)' }}>
                        {!docPreviewError && isImage && (
                          <img
                            src={selectedDocUrl}
                            alt="Submitted KYC document"
                            className="w-full max-h-64 object-contain"
                            onError={() => setDocPreviewError(true)}
                          />
                        )}
                        {!docPreviewError && isPdf && (
                          <iframe
                            src={selectedDocUrl}
                            title="Submitted KYC PDF"
                            className="w-full h-64"
                            onError={() => setDocPreviewError(true)}
                          />
                        )}
                        {(docPreviewError || (!isImage && !isPdf)) && (
                          <div className="p-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                            Preview unavailable for this file type.
                          </div>
                        )}
                        <div className="px-3 py-2 border-t flex items-center justify-between gap-2" style={{ borderColor: 'var(--border)' }}>
                          <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                            {selected.docFilePath || '-'}
                          </span>
                          <a
                            href={selectedDocUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold px-2 py-1 rounded-md"
                            style={{ background: 'var(--bg-card)', color: 'var(--brand)', border: '1px solid var(--border)' }}
                          >
                            Open
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-primary)' }}>
                        No document path provided by API.
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      ['Name', selected.userName],
                      ['Email', selected.userEmail],
                      ['Doc Type', selected.docType],
                      ['Doc Number', selected.docNumber],
                      ['Submitted', formatDate(selected.submittedAt)],
                    ].map(([k, v]) => (
                      <div key={k as string}>
                        <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{k}</div>
                        <div className="font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>{v || '-'}</div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label htmlFor="reject-reason" className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                      Rejection Reason (required to reject)
                    </label>
                    <textarea
                      id="reject-reason"
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      className="input-field resize-none"
                      rows={3}
                      placeholder="Describe the issue with this submission..."
                    />
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => handle(false)} disabled={actioning} className="flex-1 btn-danger py-2.5 text-sm inline-flex items-center justify-center gap-1">
                      <Icon8 name="error" size={14} /> {actioning ? '...' : 'Reject'}
                    </button>
                    <button onClick={() => handle(true)} disabled={actioning} className="flex-1 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-1" style={{ background: '#dcfce7', color: '#16a34a' }}>
                      <Icon8 name="success" size={14} /> {actioning ? '...' : 'Approve'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div>
        <h1 className="text-xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>KYC Review Queue</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Review and approve or reject pending KYC submissions</p>
      </div>

      <motion.div className="card overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {loading ? (
          <div className="p-5 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-8 w-28 rounded-xl" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex mb-3"><Icon8 name="success" size={40} /></div>
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>No pending KYC submissions</p>
          </div>
        ) : (
          <>
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {items.map((item, i) => (
                <motion.div
                  key={item.kycId}
                  className="flex items-center gap-4 px-5 py-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: '#fef3c7' }}>
                    <Icon8 name="kyc" size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{item.userName}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.userEmail}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#fef3c7', color: '#d97706' }}>{item.docType}</span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(item.submittedAt, 'DD MMM, hh:mm A')}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelected(item)
                      setReason('')
                      setDocPreviewError(false)
                    }}
                    className="btn-primary py-2 px-4 text-xs flex-shrink-0"
                    aria-label={`Review KYC for ${item.userName}`}
                  >Review</button>
                </motion.div>
              ))}
            </div>
            <div className="flex items-center justify-between px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn-secondary py-1.5 px-4 text-xs" style={{ opacity: page === 0 ? 0.4 : 1 }}>
                Prev
              </button>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Page {page + 1} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="btn-secondary py-1.5 px-4 text-xs" style={{ opacity: page >= totalPages - 1 ? 0.4 : 1 }}>
                Next
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}

export default AdminKyc
