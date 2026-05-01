// ─── TransactionsPage.tsx ────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAppDispatch, useAppSelector, useTheme } from '../../shared/hooks'
import { fetchTransactions, fetchLedger } from '../../store/walletSlice'
import { fetchRewardTransactions } from '../../store/rewardsSlice'
import { walletService } from '../../core/api'
import { formatCurrency, formatDate, getTransactionDisplayTitle, getTransferCounterparty, getTxIcon, isCreditForUser, isTransactionForUser } from '../../shared/utils'
import { Skeleton, StatusBadge } from '../../shared/components/ui'
import type { TxType, RewardTransaction, Transaction } from '../../types'
import { Icon8 } from '../../shared/components/Icon8'

const TX_TYPES: TxType[] = ['TOPUP', 'TRANSFER', 'WITHDRAW', 'CASHBACK', 'REDEEM']
type ExportFormat = 'csv' | 'pdf'

type RedeemRow =
  | { kind: 'wallet'; id: number; createdAt: string; tx: Transaction }
  | { kind: 'reward'; id: number; createdAt: string; tx: RewardTransaction }

const classifyRedeemKind = (description?: string | null): 'CATALOG' | 'POINTS' => {
  const text = (description || '').toLowerCase()
  if (text.includes('cash') || text.includes('wallet') || text.includes('convert')) return 'POINTS'
  return 'CATALOG'
}

const escapePdfText = (value: string) =>
  value.replace(/[^\x20-\x7E]/g, '?').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

const createStatementPdf = (txns: Transaction[], from: string, to: string, userId: number) => {
  const lines = [
    'Wallet Transaction Statement',
    `User ID: ${userId}`,
    `Period: ${from} to ${to}`,
    `Generated: ${new Date().toLocaleString()}`,
    '',
    'ID       Type        Amount        Status      Reference                 Date',
    '--------------------------------------------------------------------------',
    ...txns.map(t => {
      const date = new Date(t.createdAt).toLocaleString()
      const reference = (t.referenceId || '-').slice(0, 24)
      return `${String(t.id).padEnd(8)} ${t.type.padEnd(11)} INR ${String(t.amount).padEnd(9)} ${t.status.padEnd(11)} ${reference.padEnd(25)} ${date}`
    }),
  ]

  if (txns.length === 0) lines.push('No transactions found for this date range.')

  const pageHeight = 842
  const pageWidth = 595
  const marginLeft = 36
  const startY = 792
  const lineHeight = 14
  const maxLinesPerPage = 52
  const pages: string[] = []

  for (let i = 0; i < lines.length; i += maxLinesPerPage) {
    const pageLines = lines.slice(i, i + maxLinesPerPage)
    const text = pageLines
      .map((line, index) => `1 0 0 1 ${marginLeft} ${startY - index * lineHeight} Tm (${escapePdfText(line)}) Tj`)
      .join('\n')
    pages.push(`BT\n/F1 9 Tf\n${text}\nET`)
  }

  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  ]

  pages.forEach((content, i) => {
    const pageObj = 3 + i * 2
    const contentObj = pageObj + 1
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Courier >> >> >> /Contents ${contentObj} 0 R >>`)
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
  })

  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((obj, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`
  })
  const xrefStart = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.slice(1).forEach(offset => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

  return new Blob([pdf], { type: 'application/pdf' })
}

export function TransactionsPage() {
  const dispatch = useAppDispatch()
  const { isDark } = useTheme()
  const { user } = useAppSelector(s => s.auth)
  const { transactions, ledger, txLoading } = useAppSelector(s => s.wallet)
  const { transactions: rewardTxns } = useAppSelector(s => s.rewards)
  const [tab, setTab]         = useState<'txn' | 'ledger'>('txn')
  const [filter, setFilter]   = useState<TxType | 'ALL'>('ALL')
  const [page, setPage]       = useState(0)
  const [from, setFrom]       = useState('')
  const [to, setTo]           = useState('')
  const [downloading, setDl]  = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const fromDateRef = useRef<HTMLInputElement>(null)
  const toDateRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user?.id) {
      dispatch(fetchTransactions({ page, size: 12 }))
      dispatch(fetchLedger({}))
      dispatch(fetchRewardTransactions())
    }
  }, [dispatch, user?.id, page])

  const download = async (format: ExportFormat) => {
    if (!from || !to) { toast.error('Select a date range'); return }
    setExportOpen(false)
    setDl(true)
    try {
      if (format === 'csv') {
        const resp = await walletService.downloadStatement(user!.id, from, to)
        downloadBlob(resp.data as Blob, `statement_${from}_${to}.csv`)
      } else {
        const resp = await walletService.statement(user!.id, from, to)
        const pdf = createStatementPdf(resp.data, from, to, user!.id)
        downloadBlob(pdf, `statement_${from}_${to}.pdf`)
      }
      toast.success(`${format.toUpperCase()} statement downloaded!`)
    } catch { toast.error('Download failed') } finally { setDl(false) }
  }

  const walletTxList = (transactions?.content ?? []).filter(t => isTransactionForUser(t, user?.id))
  const txList = walletTxList.filter(t => filter === 'ALL' || t.type === filter)
  const redeemRows: RedeemRow[] = [
    ...walletTxList
      .filter(t => t.type === 'REDEEM')
      .map(t => ({ kind: 'wallet' as const, id: t.id, createdAt: t.createdAt, tx: t })),
    ...rewardTxns
      .filter(t => t.type === 'REDEEM')
      .map(t => ({ kind: 'reward' as const, id: t.id, createdAt: t.createdAt, tx: t })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const totalPages = transactions?.totalPages ?? 1
  const softMuted = isDark ? '#9fb4d7' : 'var(--text-muted)'
  const softSecondary = isDark ? '#bfd0ea' : 'var(--text-secondary)'
  const openDatePicker = (input: HTMLInputElement | null) => {
    input?.focus()
    ;(input as (HTMLInputElement & { showPicker?: () => void }) | null)?.showPicker?.()
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-3 sm:p-4 lg:p-6">
      <div><h1 className="text-xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>Transactions</h1>
        <p className="text-sm mt-0.5" style={{ color: softSecondary }}>Full history of your wallet activity</p></div>

      {/* Download bar */}
      <motion.div className="card flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="w-full sm:w-auto">
          <label htmlFor="from-date" className="block text-xs font-semibold mb-1" style={{ color: softMuted }}>From</label>
          <div className="relative">
            <input
              ref={fromDateRef}
              id="from-date"
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="input-field date-input py-2 text-sm"
              style={{ paddingRight: '2.75rem' }}
            />
            <button
              type="button"
              aria-label="Open from date picker"
              onClick={() => openDatePicker(fromDateRef.current)}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md"
              style={{ color: softSecondary }}
            >
              <Icon8 name="calendar" size={18} />
            </button>
          </div>
        </div>
        <div className="w-full sm:w-auto">
          <label htmlFor="to-date" className="block text-xs font-semibold mb-1" style={{ color: softMuted }}>To</label>
          <div className="relative">
            <input
              ref={toDateRef}
              id="to-date"
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="input-field date-input py-2 text-sm"
              style={{ paddingRight: '2.75rem' }}
            />
            <button
              type="button"
              aria-label="Open to date picker"
              onClick={() => openDatePicker(toDateRef.current)}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md"
              style={{ color: softSecondary }}
            >
              <Icon8 name="calendar" size={18} />
            </button>
          </div>
        </div>
        <div className="relative w-full sm:w-auto">
          <button
            onClick={() => {
              if (!from || !to) { toast.error('Select a date range'); return }
              setExportOpen(open => !open)
            }}
            disabled={downloading}
            className="flex w-full items-center justify-center gap-2 py-2.5 text-sm sm:w-auto btn-primary"
            aria-haspopup="menu"
            aria-expanded={exportOpen}
          >
            <span aria-hidden="true" className="inline-flex"><Icon8 name="transactions" size={14} /></span>
            {downloading ? 'Downloading...' : 'Export'}
          </button>
          {exportOpen && (
            <div
              role="menu"
              className="absolute right-0 z-20 mt-2 w-36 overflow-hidden rounded-lg shadow-xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => download('pdf')}
                className="block w-full px-4 py-2 text-left text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                PDF
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => download('csv')}
                className="block w-full px-4 py-2 text-left text-sm font-semibold"
                style={{ color: 'var(--text-primary)', borderTop: '1px solid var(--border)' }}
              >
                CSV
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="grid w-full grid-cols-2 gap-1 rounded-xl p-1 sm:w-fit sm:flex" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} role="tablist">
        {[{ id: 'txn', label: 'Transactions' }, { id: 'ledger', label: 'Ledger' }].map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id as any} onClick={() => setTab(t.id as any)}
            className="rounded-lg px-4 py-2 text-sm font-semibold transition-all"
            style={{ background: tab === t.id ? 'var(--brand)' : 'transparent', color: tab === t.id ? '#fff' : softSecondary }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'txn' && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter transactions">
            {(['ALL', ...TX_TYPES] as const).map(f => {
              if (f === 'ALL') {
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                    style={{ background: filter === f ? 'var(--brand)' : 'var(--bg-card)', color: filter === f ? '#fff' : softSecondary, border: `1px solid ${filter === f ? 'var(--brand)' : 'var(--border)'}` }}
                  >
                    ✦ All
                  </button>
                )
              }

              const TxIcon = getTxIcon(f)
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{ background: filter === f ? 'var(--brand)' : 'var(--bg-card)', color: filter === f ? '#fff' : softSecondary, border: `1px solid ${filter === f ? 'var(--brand)' : 'var(--border)'}` }}
                >
                  <span className="inline-flex items-center gap-2">
                    <TxIcon fontSize="inherit" />
                    {f}
                  </span>
                </button>
              )
            })}
          </div>

          <motion.div className="card overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {txLoading ? (
              <div className="p-5 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="flex gap-3"><Skeleton className="w-10 h-10 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-1/2" /></div><Skeleton className="h-4 w-20" /></div>)}</div>
            ) : filter === 'REDEEM' ? (
              redeemRows.length === 0 ? (
                <div className="text-center py-12"><div className="inline-flex mb-3"><Icon8 name="info" size={36} /></div><p style={{ color: 'var(--text-muted)' }}>No redeem history found</p></div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {redeemRows.map((row, i) => {
                    if (row.kind === 'wallet') {
                      const tx = row.tx
                      return (
                        <motion.div key={`wallet-redeem-${tx.id}`} className="flex flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                            style={{ background: '#fee2e2', color: '#b91c1c' }}>
                            <Icon8 name="wallet" size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Redeem (Wallet)</span>
                              <StatusBadge status={tx.status} />
                            </div>
                            <div className="text-xs truncate mt-0.5" style={{ color: softMuted }}>
                              {tx.description || `Ref: ${tx.referenceId}`} · {formatDate(tx.createdAt)}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-bold text-sm" style={{ color: 'var(--danger)' }}>
                              -{formatCurrency(tx.amount)}
                            </div>
                          </div>
                        </motion.div>
                      )
                    }

                    const tx = row.tx
                    const redeemKind = classifyRedeemKind(tx.description)
                    return (
                        <motion.div key={`reward-redeem-${tx.id}`} className="flex flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                          style={{ background: '#ede9fe', color: '#7c3aed' }}>
                          <Icon8 name={redeemKind === 'POINTS' ? 'wallet' : 'rewards'} size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                              {redeemKind === 'POINTS' ? 'Redeem (Points to Cash)' : 'Redeem (Catalog)'}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--bg-primary)', color: softSecondary, border: '1px solid var(--border)' }}>
                              REWARDS
                            </span>
                          </div>
                          <div className="text-xs truncate mt-0.5" style={{ color: softMuted }}>
                            {tx.description || 'Reward redemption'} · {formatDate(tx.createdAt)}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-bold text-sm" style={{ color: 'var(--danger)' }}>
                            -{tx.points} pts
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )
            ) : txList.length === 0 ? (
              <div className="text-center py-12"><div className="inline-flex mb-3"><Icon8 name="info" size={36} /></div><p style={{ color: 'var(--text-muted)' }}>No transactions found</p></div>
            ) : (
              <>
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {txList.map((tx, i) => {
                    const TxIcon = getTxIcon(tx.type)
                    const credit = isCreditForUser(tx, user?.id)
                    const title = getTransactionDisplayTitle(tx, user?.id)
                    const counterparty = getTransferCounterparty(tx, user?.id)
                    const descriptor = counterparty
                      ? `${counterparty}${tx.description && tx.description !== 'Transfer' ? ` - ${tx.description}` : ''}`
                      : (tx.description || `Ref: ${tx.referenceId}`)
                    return (
                      <motion.div key={tx.id} className="flex flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                          style={{ background: credit ? '#dcfce7' : '#fee2e2', color: credit ? '#15803d' : '#b91c1c' }}>
                          <TxIcon fontSize="inherit" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{title}</span>
                            <StatusBadge status={tx.status} />
                          </div>
                          <div className="text-xs truncate mt-0.5" style={{ color: softMuted }}>{descriptor} · {formatDate(tx.createdAt)}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-bold text-sm" style={{ color: credit ? 'var(--success)' : 'var(--danger)' }}>
                            {credit ? '+' : '-'}{formatCurrency(tx.amount)}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
                <div className="flex flex-col gap-3 px-4 py-4 border-t sm:flex-row sm:items-center sm:justify-between sm:px-5" style={{ borderColor: 'var(--border)' }}>
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn-secondary py-1.5 px-4 text-xs" style={{ opacity: page === 0 ? 0.4 : 1 }} aria-label="Previous page">← Prev</button>
                  <span className="text-xs" style={{ color: softMuted }}>Page {page + 1} of {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="btn-secondary py-1.5 px-4 text-xs" style={{ opacity: page >= totalPages - 1 ? 0.4 : 1 }} aria-label="Next page">Next →</button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}

      {tab === 'ledger' && (
        <motion.div className="card overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {!ledger?.content?.length ? (
            <div className="text-center py-12"><div className="inline-flex mb-3"><Icon8 name="transactions" size={36} /></div><p style={{ color: 'var(--text-muted)' }}>No ledger entries</p></div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {ledger.content.map((e, i) => (
                <motion.div key={e.id} className="flex flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: e.type === 'CREDIT' ? '#dcfce7' : '#fee2e2', color: e.type === 'CREDIT' ? '#15803d' : '#b91c1c' }}>{e.type === 'CREDIT' ? '↑' : '↓'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{e.description || e.type}</div>
                    <div className="text-xs" style={{ color: softMuted }}>Ref: {e.referenceId} · {formatDate(e.createdAt)}</div>
                  </div>
                  <div className="font-bold text-sm" style={{ color: e.type === 'CREDIT' ? 'var(--success)' : 'var(--danger)' }}>
                    {e.type === 'CREDIT' ? '+' : '-'}{formatCurrency(e.amount)}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
export default TransactionsPage
