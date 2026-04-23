import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAppDispatch, useAppSelector, useNotify, useTheme } from '../../shared/hooks'
import { kycService } from '../../core/api'
import { updateKycStatus } from '../../store/authSlice'
import { formatDate, getKycInfo } from '../../shared/utils'
import type { DocType, KycStatusResponse } from '../../types'
import { Icon8 } from '../../shared/components/Icon8'

const DOC_TYPES: DocType[] = ['AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENSE']
const MAX_FILE_SIZE_MB = 5
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const formatDocType = (type?: DocType) => type ? type.replace(/_/g, ' ') : '-'
const maskDocNumber = (value?: string | null) => {
  if (!value) return '-'
  const clean = value.trim()
  if (clean.length <= 4) return '••••'
  return `${'•'.repeat(Math.max(4, clean.length - 4))}${clean.slice(-4)}`
}

export function KycPage() {
  const dispatch = useAppDispatch()
  const notify = useNotify()
  const { isDark } = useTheme()
  const { user } = useAppSelector(s => s.auth)
  const [kycData, setKycData] = useState<KycStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [docType, setDocType] = useState<DocType>('AADHAAR')
  const [docNumber, setDocNumber] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const [showDocNumber, setShowDocNumber] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user?.id) void fetchStatus()
  }, [user?.id])

  const fetchStatus = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data } = await kycService.status(user.id)
      setKycData(data.data)
      if (data.data?.status) dispatch(updateKycStatus(data.data.status))
    } catch {
      setKycData(null)
    } finally {
      setLoading(false)
    }
  }

  const handleFile = (f: File) => {
    if (f.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (f.size / (1024 * 1024)).toFixed(2)
      const msg = `File is ${sizeMb}MB. Maximum allowed is ${MAX_FILE_SIZE_MB}MB.`
      setFileError(msg)
      setFile(null)
      toast.error(msg)
      return
    }
    setFileError(null)
    setFile(f)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!docNumber.trim()) {
      toast.error('Enter your document number')
      return
    }
    if (!file) {
      toast.error(fileError || 'Upload your document')
      return
    }
    if (!user?.id) return
    setSubmitting(true)
    try {
      const { data } = await kycService.submit(user.id, docType, docNumber, file)
      setKycData(data.data)
      dispatch(updateKycStatus('PENDING'))
      notify('info', 'KYC Submitted', 'Your documents are under review.')
      toast.success("KYC submitted! We'll review it within 24-48 hours.")
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = !kycData || kycData.status === 'REJECTED' || kycData.status === 'NOT_SUBMITTED'
  if (loading) {
    return (
      <div className="p-6 flex justify-center h-64 items-center">
        <div className="animate-spin w-8 h-8 rounded-full border-2" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const kycI = kycData ? getKycInfo(kycData.status) : null
  const KycIcon = kycI?.icon
  const isApproved = kycData?.status === 'APPROVED'
  const kycDetailRows: [string, string][] = kycData
    ? [
        ['Doc Type', formatDocType(kycData.docType)],
        ['Doc Number', showDocNumber ? (kycData.docNumber || '-') : maskDocNumber(kycData.docNumber)],
        ['Submitted', formatDate(kycData.submittedAt, 'DD MMM YYYY')],
        ...(kycData.updatedAt ? [['Updated', formatDate(kycData.updatedAt, 'DD MMM YYYY')]] as [string, string][] : []),
      ]
    : []

  return (
    <div className="px-4 pt-6 pb-8 sm:px-6 lg:px-8 lg:pt-8 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--brand)' }}>Identity check</p>
          <h1 className="text-2xl font-display font-bold leading-tight mt-1" style={{ color: 'var(--text-primary)' }}>KYC Verification</h1>
        </div>
        <p className="text-sm max-w-md sm:text-right" style={{ color: isDark ? '#9fb4d7' : 'var(--text-secondary)' }}>
          {isApproved ? 'Congrats you have activated all the wallet services' : 'Verify your identity to unlock all wallet features'}
        </p>
      </div>

      {kycData && kycI && (
        <motion.div
          className="card overflow-hidden"
          style={{
            borderColor: `${kycI.color}50`,
            background: isDark ? 'linear-gradient(180deg, #101d35 0%, #0f1a30 100%)' : 'var(--bg-card)',
            borderRadius: 8,
          }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:p-6">
            <div className="w-14 h-14 rounded-lg flex items-center justify-center text-3xl flex-shrink-0" style={{ background: kycI.bg, color: kycI.color }}>
              {KycIcon && <KycIcon fontSize="inherit" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{kycI.label}</h2>
                  <p className="text-sm mt-1" style={{ color: isDark ? '#9fb4d7' : 'var(--text-secondary)' }}>
                    {kycData.status === 'APPROVED'
                      ? 'Congrats you have activated all the wallet services.'
                      : kycData.status === 'PENDING'
                        ? 'Your documents are being reviewed.'
                        : kycData.status === 'REJECTED'
                          ? 'Review the reason and submit corrected documents.'
                          : 'Submit your document to complete verification.'}
                  </p>
                </div>
                <span className="inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-bold" style={{ background: kycI.bg, color: kycI.color }}>
                  {kycData.status.replace(/_/g, ' ')}
                </span>
              </div>
              {kycData.status === 'REJECTED' && kycData.rejectionReason && (
                <p className="mt-4 rounded-lg px-3 py-2 text-sm font-medium" style={{ color: 'var(--danger)', background: isDark ? 'rgba(248,113,113,0.12)' : '#fee2e2' }}>
                  Reason: {kycData.rejectionReason}
                </p>
              )}
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {kycDetailRows.map(([k, v]) => (
                  <div key={k} className="rounded-lg px-3 py-2" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'var(--bg-primary)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: isDark ? '#8ca0c1' : 'var(--text-muted)' }}>{k}</div>
                      {k === 'Doc Number' && kycData.docNumber && (
                        <button
                          type="button"
                          onClick={() => setShowDocNumber(s => !s)}
                          className="w-6 h-6 rounded-md inline-flex items-center justify-center transition-opacity hover:opacity-80"
                          style={{ color: isDark ? '#eef4ff' : 'var(--text-secondary)' }}
                          aria-label={showDocNumber ? 'Hide document number' : 'Show document number'}
                          aria-pressed={showDocNumber}
                        >
                          <Icon8 name={showDocNumber ? 'eyeOff' : 'eye'} size={14} />
                        </button>
                      )}
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold" style={{ color: isDark ? '#eef4ff' : 'var(--text-primary)' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {canSubmit && (
        <motion.div
          className="card p-5 sm:p-6"
          style={{ borderRadius: 8 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="mb-5">
            <h2 className="font-display text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {kycData?.status === 'REJECTED' ? 'Resubmit KYC' : 'Submit KYC Documents'}
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Aadhaar, PAN, Passport, or Driving License. Maximum file size: {MAX_FILE_SIZE_MB}MB.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="docType" className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  Document Type
                </label>
                <select id="docType" value={docType} onChange={e => setDocType(e.target.value as DocType)} className="input-field">
                  {DOC_TYPES.map(d => <option key={d} value={d}>{formatDocType(d)}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="docNumber" className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  Document Number
                </label>
                <input
                  id="docNumber"
                  type="password"
                  placeholder="e.g. ABCDE1234F"
                  value={docNumber}
                  onChange={e => setDocNumber(e.target.value)}
                  className="input-field font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Upload Document</label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all sm:p-8"
                style={{
                  borderColor: fileError ? 'var(--danger)' : (drag || file ? 'var(--brand)' : 'var(--border)'),
                  background: drag || file ? 'var(--brand-light)' : 'var(--bg-primary)',
                }}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => {
                  e.preventDefault()
                  setDrag(false)
                  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
                }}
                role="button"
                tabIndex={0}
                aria-label="Upload document file"
                onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                  aria-hidden="true"
                />
                {file ? (
                  <>
                    <div className="inline-flex mb-1"><Icon8 name="kyc" size={30} /></div>
                    <div className="mx-auto max-w-full truncate font-semibold text-sm" style={{ color: 'var(--brand)' }}>{file.name}</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      {(file.size / (1024 * 1024)).toFixed(2)} MB. Click to replace.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="inline-flex mb-1"><Icon8 name="overview" size={30} /></div>
                    <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Drag and drop or click to upload</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>PNG, JPG, or PDF up to {MAX_FILE_SIZE_MB}MB</div>
                  </>
                )}
              </div>
              {fileError && (
                <p className="text-xs mt-1.5 font-medium" style={{ color: 'var(--danger)' }}>{fileError}</p>
              )}
            </div>

            <button type="submit" disabled={submitting} className="w-full btn-primary py-3 text-sm">
              {submitting ? 'Submitting...' : 'Submit KYC'}
            </button>
          </form>
        </motion.div>
      )}
    </div>
  )
}

export default KycPage
