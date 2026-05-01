import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAppDispatch, useAppSelector, useNotify, useDebounce } from '../../shared/hooks'
import { fetchBalance, fetchTransactions, transferFunds, withdrawFunds } from '../../store/walletSlice'
import { fetchRewardSummary } from '../../store/rewardsSlice'
import { walletService, rewardsService, userService } from '../../core/api'
import { Modal, ConfirmDialog, SuccessOverlay, Skeleton, EmptyState } from '../../shared/components/ui'
import { ScratchCardModal } from '../../shared/components/ScratchCard'
import { formatCurrency, formatDate, getTransactionDisplayTitle, getTransferCounterparty, getTxIcon, isCreditForUser, isTransactionForUser, generateKey, calcPoints } from '../../shared/utils'
import { StatusBadge } from '../../shared/components/ui'
import type { TransferRequest, RazorpayOptions, ReceiverSuggestion } from '../../types'
import { Icon8 } from '../../shared/components/Icon8'
import { addPendingScratchCard, removePendingScratchCard } from '../../shared/scratchCards'

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000]

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js'
let razorpayScriptPromise: Promise<void> | null = null

const canSearchReceiver = (value: string) => {
  const q = value.trim()
  return /^\d+$/.test(q) || q.length >= 2
}

function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.Razorpay) return Promise.resolve()

  if (razorpayScriptPromise) return razorpayScriptPromise

  razorpayScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-razorpay="true"]`)
    if (existing) {
      // If a script tag exists, assume it's either loading or loaded.
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay script')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = RAZORPAY_SCRIPT_URL
    script.defer = true
    script.dataset.razorpay = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Razorpay script'))
    document.body.appendChild(script)
  })

  return razorpayScriptPromise
}

export default function WalletPage() {
  const dispatch     = useAppDispatch()
  const navigate     = useNavigate()
  const notify       = useNotify()
  const { user, loginAt } = useAppSelector(s => s.auth)
  const { balance, transactions, loading, txLoading } = useAppSelector(s => s.wallet)
  const [showBalance, setShowBalance] = useState(false)

  // Modal state
  const [modal, setModal]           = useState<null | 'topup' | 'transfer' | 'withdraw'>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Success overlay
  const [successLabel, setSuccessLabel] = useState('')
  const [successAmount, setSuccessAmount] = useState(0)
  const [showSuccess, setShowSuccess]   = useState(false)

  // Scratch card
  const [scratchOpen, setScratchOpen]     = useState(false)
  const [scratchPoints, setScratchPoints] = useState(0)
  const [scratchAmount, setScratchAmount] = useState(0)
  const [scratchCardId, setScratchCardId] = useState<string | null>(null)

  // Form values
  const [topupAmount, setTopupAmount]       = useState('')
  const [transfer, setTransfer]             = useState<{ receiverId: string; amount: string; description: string }>
    ({ receiverId: '', amount: '', description: '' })
  const [receiverQuery, setReceiverQuery] = useState('')
  const [receiverResults, setReceiverResults] = useState<ReceiverSuggestion[]>([])
  const [selectedReceiver, setSelectedReceiver] = useState<ReceiverSuggestion | null>(null)
  const [receiverLoading, setReceiverLoading] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const debouncedReceiverQuery = useDebounce(receiverQuery, 350)

  useEffect(() => {
    if (user?.id) {
      dispatch(fetchBalance())
      dispatch(fetchTransactions({ page: 0, size: 6 }))
      dispatch(fetchRewardSummary())
    }
  }, [dispatch, user?.id])

  useEffect(() => {
    const q = debouncedReceiverQuery.trim()
    if (modal !== 'transfer' || !canSearchReceiver(q) || selectedReceiver) {
      setReceiverResults([])
      setReceiverLoading(false)
      return
    }

    let cancelled = false
    setReceiverLoading(true)
    userService.searchReceivers(q)
      .then(({ data }) => {
        if (!cancelled) setReceiverResults(data.data || [])
      })
      .catch(() => {
        if (!cancelled) setReceiverResults([])
      })
      .finally(() => {
        if (!cancelled) setReceiverLoading(false)
      })

    return () => { cancelled = true }
  }, [debouncedReceiverQuery, modal, selectedReceiver])

  useEffect(() => {
    if (modal === 'transfer') return
    setReceiverQuery('')
    setReceiverResults([])
    setSelectedReceiver(null)
    setReceiverLoading(false)
  }, [modal])

  const triggerSuccess = (label: string, amount: number) => {
    setSuccessLabel(label); setSuccessAmount(amount); setShowSuccess(true)
    dispatch(fetchBalance()); dispatch(fetchTransactions({ page: 0, size: 6 }))
    setTimeout(() => setShowSuccess(false), 2400)
  }

  // ── Razorpay Top-Up ────────────────────────────────────────────────────────
  const handleTopup = async () => {
    if (actionLoading) return

    const amount = Number(topupAmount)
    if (isNaN(amount) || amount < 1) {
      toast.error('Enter a valid amount')
      return
    }

    if (!user) {
      toast.error('User not logged in')
      return
    }

    setActionLoading(true)

    try {
      const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID?.trim()
      if (!keyId) {
        toast.error('Payment is not configured. Set VITE_RAZORPAY_KEY_ID in your environment.')
        setActionLoading(false)
        return
      }

      await loadRazorpayScript()

      const orderRes = await walletService.createOrder(user.id, amount)
      const order = orderRes.data
      const orderId = order.orderId ?? order.id

      await dispatch(fetchTransactions({ page: 0, size: 6 }))

      if (!window.Razorpay) {
        toast.error('Payment gateway not loaded. Please refresh.')
        setActionLoading(false)
        return
      }

      let paymentCompleted = false
      let paymentFailed = false

      const rzp = new window.Razorpay({
        key: keyId,
        amount: order.amount,
        currency: order.currency || 'INR',
        order_id: orderId,
        name: 'PayVault',
        description: 'Wallet Top-up',
        theme: { color: '#22c55e' },
        prefill: {
          name: user.fullName,
          email: user.email,
        },
        handler: async (response) => {
          try {
            paymentCompleted = true
            await walletService.verifyPayment(user.id, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            })

            await dispatch(fetchBalance())
            await dispatch(fetchTransactions({ page: 0, size: 6 }))

            setModal(null)
            setSuccessLabel('Top-up')
            setSuccessAmount(amount)
            setShowSuccess(true)
            setTimeout(() => setShowSuccess(false), 2400)

            notify('success', 'Top-up Successful!', `${formatCurrency(amount)} added to your wallet`)
            toast.success(`Wallet topped up with ${formatCurrency(amount)}`)
            setTopupAmount('')
          } catch (_) {
            toast.error('Payment verification failed')
          } finally {
            setActionLoading(false)
          }
        },
        modal: {
          ondismiss: async () => {
            if (!paymentCompleted && !paymentFailed) {
              try {
                await walletService.cancelPayment(user.id, orderId)
                await dispatch(fetchTransactions({ page: 0, size: 6 }))
                toast('Top-up cancelled', { icon: 'i' })
              } catch (_) {
                toast.error('Could not record top-up cancellation')
              }
            }
            setActionLoading(false)
          },
        },
      } as RazorpayOptions)

      rzp.on('payment.failed', async (response: any) => {
        paymentFailed = true
        try {
          await walletService.failPayment(
            user.id,
            orderId,
            response?.error?.description || 'Payment failed'
          )
          await dispatch(fetchTransactions({ page: 0, size: 6 }))
        } catch (_) {
          toast.error('Could not record payment failure')
        }
        toast.error('Payment failed. Please try again.')
        setActionLoading(false)
      })

      rzp.open()
    } catch (err: any) {
      toast.error(err.message || 'Top-up failed')
      setActionLoading(false)
    }
  }

  // ── Scratch card claimed ────────────────────────────────────────────────────
  const handleScratchRevealed = async (pts: number) => {
    // Call internal earn endpoint
    try {
      await rewardsService.earnInternal(user!.id, scratchAmount)
    } catch (_) { /* best effort */ }
    if (user?.id && scratchCardId) removePendingScratchCard(user.id, scratchCardId)
    dispatch(fetchRewardSummary())
    notify('success', `+${pts} Points Added!`, `Reward points for your transfer of ${formatCurrency(scratchAmount)}`)
    toast.success(`${pts} reward points added to your account!`)
    setScratchCardId(null)
  }

  // ── Transfer ───────────────────────────────────────────────────────────────
  const handleTransferConfirm = async () => {
    setActionLoading(true)
    const payload: TransferRequest = {
      receiverId:     parseInt(transfer.receiverId),
      amount:         parseFloat(transfer.amount),
      idempotencyKey: generateKey(),
      description:    transfer.description || 'Transfer',
    }
    const res = await dispatch(transferFunds(payload))
    setActionLoading(false); setConfirmOpen(false)
    if (transferFunds.fulfilled.match(res)) {
      setModal(null)
      triggerSuccess('Transfer', payload.amount)
      const earned = calcPoints(payload.amount)
      if (earned > 0) {
        const pendingCard = {
          id: `${Date.now()}-${payload.receiverId}-${earned}`,
          userId: user!.id,
          points: earned,
          transactionAmount: payload.amount,
          createdAt: new Date().toISOString(),
        }
        addPendingScratchCard(pendingCard)
        setScratchCardId(pendingCard.id)
        setScratchPoints(earned)
        setScratchAmount(payload.amount)
        setTimeout(() => setScratchOpen(true), 2600)
      }
      notify('success', 'Transfer Successful', `${formatCurrency(payload.amount)} sent to user #${payload.receiverId}`)
      toast.success('Transfer successful!')
      setTransfer({ receiverId: '', amount: '', description: '' })
      setReceiverQuery('')
      setSelectedReceiver(null)
      setReceiverResults([])
    } else { toast.error(res.payload as string || 'Transfer failed') }
  }

  // ── Withdraw ───────────────────────────────────────────────────────────────
  const handleWithdrawConfirm = async () => {
    const amount = parseFloat(withdrawAmount)
    setActionLoading(true)
    const res = await dispatch(withdrawFunds(amount))
    setActionLoading(false); setConfirmOpen(false)
    if (withdrawFunds.fulfilled.match(res)) {
      setModal(null)
      triggerSuccess('Withdrawal', amount)
      notify('success', 'Withdrawal Successful', `${formatCurrency(amount)} will be credited to your bank.`)
      toast.success('Withdrawal initiated!')
      setWithdrawAmount('')
    } else { toast.error(res.payload as string || 'Withdrawal failed') }
  }

  const txList = (transactions?.content ?? []).filter(tx => isTransactionForUser(tx, user?.id))

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-3 sm:p-4 lg:p-6">
      <SuccessOverlay show={showSuccess} label={successLabel} amount={successAmount} />

      {scratchOpen && (
        <ScratchCardModal
          points={scratchPoints}
          transactionAmount={scratchAmount}
          onRevealed={handleScratchRevealed}
          onClose={() => {
            setScratchOpen(false)
            setScratchCardId(null)
          }}
        />
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>My Wallet</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Manage your balance, top up, and transfer funds</p>
      </div>

      {/* Balance card */}
      <motion.div className="relative overflow-hidden rounded-3xl p-4 sm:p-6"
        style={{ background: 'linear-gradient(135deg,#052e16 0%,#0d3320 50%,#0a0f1e 100%)' }}
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="absolute top-0 right-0 w-72 h-72 blur-3xl opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle,#22c55e,transparent)', transform: 'translate(30%,-30%)' }} />
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#86efac' }}>Available Balance</div>
            <button
              type="button"
              onClick={() => setShowBalance(v => !v)}
              className="w-9 h-9 rounded-xl inline-flex items-center justify-center transition-opacity hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.12)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.12)' }}
              aria-label={showBalance ? 'Hide wallet balance' : 'Show wallet balance'}
              aria-pressed={showBalance}
            >
              <Icon8 name={showBalance ? 'eyeOff' : 'eye'} size={18} color="#ffffff" />
            </button>
          </div>
          {loading
            ? <div className="skeleton h-10 w-44 rounded-lg mb-2" />
            : <motion.div className="mb-1 break-words text-3xl font-black leading-none text-white sm:text-4xl"
                initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
                {showBalance ? formatCurrency(balance?.balance ?? 0) : '₹••••••'}
              </motion.div>
          }
          <div className="mb-5 text-xs leading-5 sm:leading-normal" style={{ color: '#4ade80' }}>
            {balance?.status ?? 'ACTIVE'} - Last updated {loginAt ? formatDate(loginAt, 'hh:mm A') : 'just now'}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="group" aria-label="Wallet actions">
            {[
              { label: 'Top Up', icon: 'topup', key: 'topup', bg: '#22c55e' },
              { label: 'Transfer', icon: 'transfer', key: 'transfer', bg: 'rgba(255,255,255,0.12)' },
              { label: 'Withdraw', icon: 'withdraw', key: 'withdraw', bg: 'rgba(255,255,255,0.12)' },
              { label: 'History', icon: 'transactions', key: 'history', bg: 'rgba(255,255,255,0.12)' },
            ].map(btn => (
              <motion.button key={btn.key}
                onClick={() => btn.key === 'history' ? navigate('/transactions') : setModal(btn.key as any)}
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all sm:w-auto"
                style={{ background: btn.bg, border: '1px solid rgba(255,255,255,0.1)' }}>
                <Icon8 name={btn.icon as React.ComponentProps<typeof Icon8>['name']} size={16} color="#ffffff" />
                {btn.label}
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Recent transactions */}
      <motion.div className="card p-4 sm:p-5" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Transactions</h3>
          <button onClick={() => navigate('/transactions')} className="text-xs font-medium" style={{ color: 'var(--brand)' }}>View All →</button>
        </div>

        {txLoading
          ? <div className="space-y-3">{[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div className="flex-1 space-y-2"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-1/3" /></div>
                <Skeleton className="h-4 w-20" />
              </div>))}</div>
          : txList.length === 0
            ? <EmptyState icon={<Icon8 name="wallet" size={34} />} title="No transactions yet" description="Top up or transfer to see activity here." />
            : <div className="space-y-1">
                {txList.map((tx, i) => {
                  const TxIcon = getTxIcon(tx.type)
                  const credit = isCreditForUser(tx, user?.id)
                  const title = getTransactionDisplayTitle(tx, user?.id)
                  const counterparty = getTransferCounterparty(tx, user?.id)
                  const descriptor = counterparty
                    ? `${counterparty}${tx.description && tx.description !== 'Transfer' ? ` - ${tx.description}` : ''}`
                    : (tx.description || tx.referenceId)
                  return (
                    <motion.div key={tx.id}
                      className="flex flex-col items-start gap-3 rounded-xl px-3 py-3 sm:flex-row sm:items-center sm:py-2.5"
                      style={{ background: 'var(--bg-primary)' }}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                        style={{ background: credit ? '#dcfce7' : '#fee2e2', color: credit ? '#15803d' : '#b91c1c' }}>
                        <TxIcon fontSize="inherit" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</span>
                          <StatusBadge status={tx.status} />
                        </div>
                        <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                          {descriptor} · {formatDate(tx.createdAt, 'DD MMM, hh:mm A')}
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-left sm:ml-auto sm:text-right">
                        <div className="text-sm font-bold" style={{ color: credit ? 'var(--success)' : 'var(--danger)' }}>
                          {credit ? '+' : '-'}{formatCurrency(tx.amount)}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
        }
      </motion.div>

      {/* ── Modals ── */}

      {/* Top Up */}
      <Modal open={modal === 'topup'} onClose={() => setModal(null)} title="Top Up Wallet">
        <div className="space-y-4">
          <div>
            <label htmlFor="topup-amount" className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Amount (₹)</label>
            <input id="topup-amount" type="number" placeholder="Enter amount" min={1}
              value={topupAmount} onChange={e => setTopupAmount(e.target.value)} className="input-field text-2xl font-display font-bold" />
          </div>
          <div>
            <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Quick amounts</div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {QUICK_AMOUNTS.map(a => (
                <button key={a} onClick={() => setTopupAmount(String(a))}
                  className="rounded-lg px-3 py-2 text-xs font-semibold transition-all"
                  style={{
                    background: topupAmount === String(a) ? 'var(--brand)' : 'var(--bg-primary)',
                    color: topupAmount === String(a) ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${topupAmount === String(a) ? 'var(--brand)' : 'var(--border)'}`,
                  }}>
                  ₹{a.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </div>
          <div className="p-3 rounded-xl text-xs" style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
            <span className="inline-flex items-start gap-1 leading-5">
              <Icon8 name="info" size={14} />
              Top-up adds wallet balance only. Reward scratch card is available on successful transfer.
            </span>
          </div>
          <button onClick={handleTopup} disabled={actionLoading || !topupAmount} className="w-full btn-primary py-3 text-sm">
            {actionLoading ? 'Processing…' : `Pay ${topupAmount ? formatCurrency(parseFloat(topupAmount)) : '—'} via Razorpay`}
          </button>
        </div>
      </Modal>

      {/* Transfer */}
      <Modal open={modal === 'transfer'} onClose={() => setModal(null)} title="Transfer Money">
        <div className="space-y-4">
          <div>
            <label htmlFor="receiver-search" className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Receiver</label>
            <div className="relative">
              <input
                id="receiver-search"
                type="text"
                placeholder="Search by name, email, or user ID"
                value={receiverQuery}
                onChange={e => {
                  setReceiverQuery(e.target.value)
                  setSelectedReceiver(null)
                  setTransfer(p => ({ ...p, receiverId: '' }))
                }}
                className="input-field"
                style={{ paddingLeft: '2.75rem', paddingRight: receiverQuery ? '2.75rem' : undefined }}
                autoComplete="off"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
                <Icon8 name="search" size={16} />
              </span>
              {receiverQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setReceiverQuery('')
                    setSelectedReceiver(null)
                    setReceiverResults([])
                    setTransfer(p => ({ ...p, receiverId: '' }))
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center transition-opacity hover:opacity-80"
                  style={{ color: 'var(--text-muted)', background: 'transparent' }}
                  aria-label="Clear receiver search"
                >
                  <span aria-hidden="true" className="text-lg leading-none">x</span>
                </button>
              )}
            </div>

            {selectedReceiver && (
              <div className="mt-2 flex flex-col items-start justify-between gap-3 rounded-lg px-3 py-2 text-xs sm:flex-row sm:items-center"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                <div className="min-w-0">
                  <div className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{selectedReceiver.name}</div>
                  <div className="truncate" style={{ color: 'var(--text-muted)' }}>{selectedReceiver.email} - User #{selectedReceiver.id}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedReceiver(null)
                    setReceiverQuery('')
                    setTransfer(p => ({ ...p, receiverId: '' }))
                  }}
                  className="font-semibold"
                  style={{ color: 'var(--danger)' }}
                >
                  Change
                </button>
              </div>
            )}

            {!selectedReceiver && canSearchReceiver(receiverQuery) && (
              <div className="mt-2 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                {receiverLoading ? (
                  <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)', background: 'var(--bg-primary)' }}>Searching...</div>
                ) : receiverResults.length === 0 ? (
                  <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)', background: 'var(--bg-primary)' }}>No receiver found</div>
                ) : receiverResults.map(receiver => (
                  <button
                    key={receiver.id}
                    type="button"
                    onClick={() => {
                      setSelectedReceiver(receiver)
                      setReceiverQuery(`${receiver.name} - ${receiver.email}`)
                      setTransfer(p => ({ ...p, receiverId: String(receiver.id) }))
                      setReceiverResults([])
                    }}
                    className="w-full px-3 py-2 text-left text-xs transition-opacity hover:opacity-80"
                    style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}
                  >
                    <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{receiver.name}</div>
                    <div style={{ color: 'var(--text-muted)' }}>{receiver.email} - User #{receiver.id}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {[
            { key: 'amount' as const, label: 'Amount ₹ (max ₹25,000)', placeholder: '0.00', type: 'number' },
            { key: 'description' as const, label: 'Note (optional)', placeholder: 'e.g. Rent, Lunch split', type: 'text' },
          ].map(f => (
            <div key={f.key}>
              <label htmlFor={`tf-${f.key}`} className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
              <input id={`tf-${f.key}`} type={f.type} placeholder={f.placeholder}
                value={transfer[f.key]} onChange={e => setTransfer(p => ({ ...p, [f.key]: e.target.value }))} className="input-field" />
            </div>
          ))}
          <div className="p-3 rounded-xl text-xs" style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
            <span className="inline-flex items-start gap-1 leading-5">
              <Icon8 name="star" size={14} />
              Win a scratch card after a successful transfer.
            </span>
          </div>
          <button onClick={() => {
            const amt = parseFloat(transfer.amount)
            if (!transfer.receiverId) { toast.error('Select a receiver'); return }
            if (!amt || amt < 1 || amt > 25000) { toast.error('Amount must be ₹1–₹25,000'); return }
            setConfirmOpen(true)
          }} className="w-full btn-primary py-3 text-sm">Review Transfer →</button>
        </div>
      </Modal>

      {/* Withdraw */}
      <Modal open={modal === 'withdraw'} onClose={() => setModal(null)} title="Withdraw Funds">
        <div className="space-y-4">
          <div className="p-3 rounded-xl text-sm" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
            Available: <strong style={{ color: 'var(--brand)' }}>{showBalance ? formatCurrency(balance?.balance ?? 0) : '₹••••••'}</strong>
          </div>
          <div>
            <label htmlFor="withdraw-amount" className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Amount (₹)</label>
            <input id="withdraw-amount" type="number" placeholder="Enter amount" min={1} max={balance?.balance ?? 0}
              value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {[500, 1000, 2000].map(a => (
              <button key={a} onClick={() => setWithdrawAmount(String(Math.min(a, balance?.balance ?? 0)))}
                className="rounded-lg px-3 py-2 text-xs font-semibold"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                ₹{a.toLocaleString('en-IN')}
              </button>
            ))}
            <button onClick={() => setWithdrawAmount(String(balance?.balance ?? 0))}
              className="rounded-lg px-3 py-2 text-xs font-semibold"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              Max
            </button>
          </div>
          <button onClick={() => {
            const amt = parseFloat(withdrawAmount)
            if (!amt || amt < 1) { toast.error('Enter a valid amount'); return }
            if (amt > (balance?.balance ?? 0)) { toast.error('Insufficient balance'); return }
            setConfirmOpen(true)
          }} className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
            style={{ background: '#f59e0b' }}>
            Withdraw {withdrawAmount ? formatCurrency(parseFloat(withdrawAmount)) : '—'}
          </button>
        </div>
      </Modal>

      {/* Confirm */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={modal === 'transfer' ? handleTransferConfirm : handleWithdrawConfirm}
        title={modal === 'transfer' ? 'Confirm Transfer' : 'Confirm Withdrawal'}
        message={modal === 'transfer' ? `Send to User #${transfer.receiverId}` : 'Funds will be transferred to your bank'}
        amount={modal === 'transfer' ? parseFloat(transfer.amount) : parseFloat(withdrawAmount)}
        loading={actionLoading}
      />
    </div>
  )
}

