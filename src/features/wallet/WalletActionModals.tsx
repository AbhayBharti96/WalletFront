import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useAppDispatch, useAppSelector, useDebounce, useNotify } from '../../shared/hooks'
import { fetchBalance, fetchTransactions, transferFunds, withdrawFunds } from '../../store/walletSlice'
import { fetchRewardSummary } from '../../store/rewardsSlice'
import { rewardsService, userService, walletService } from '../../core/api'
import { ConfirmDialog, Modal, SuccessOverlay } from '../../shared/components/ui'
import { ScratchCardModal } from '../../shared/components/ScratchCard'
import { Icon8 } from '../../shared/components/Icon8'
import { calcPoints, formatCurrency, generateKey } from '../../shared/utils'
import type { ReceiverSuggestion, RazorpayOptions, TransferRequest } from '../../types'
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
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay="true"]')
    if (existing) {
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

export type WalletActionModalType = 'topup' | 'transfer' | 'withdraw' | null

interface WalletActionModalsProps {
  modal: WalletActionModalType
  onClose: () => void
}

export default function WalletActionModals({ modal, onClose }: WalletActionModalsProps) {
  const dispatch = useAppDispatch()
  const notify = useNotify()
  const { user } = useAppSelector(s => s.auth)
  const { balance } = useAppSelector(s => s.wallet)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [successLabel, setSuccessLabel] = useState('')
  const [successAmount, setSuccessAmount] = useState(0)
  const [showSuccess, setShowSuccess] = useState(false)
  const [scratchOpen, setScratchOpen] = useState(false)
  const [scratchPoints, setScratchPoints] = useState(0)
  const [scratchAmount, setScratchAmount] = useState(0)
  const [scratchCardId, setScratchCardId] = useState<string | null>(null)
  const [topupAmount, setTopupAmount] = useState('')
  const [transfer, setTransfer] = useState<{ receiverId: string; amount: string; description: string }>({
    receiverId: '',
    amount: '',
    description: '',
  })
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [receiverQuery, setReceiverQuery] = useState('')
  const [receiverResults, setReceiverResults] = useState<ReceiverSuggestion[]>([])
  const [selectedReceiver, setSelectedReceiver] = useState<ReceiverSuggestion | null>(null)
  const [receiverLoading, setReceiverLoading] = useState(false)
  const debouncedReceiverQuery = useDebounce(receiverQuery, 350)

  useEffect(() => {
    if (!user?.id) return
    dispatch(fetchBalance())
    dispatch(fetchTransactions({ page: 0, size: 6 }))
    dispatch(fetchRewardSummary())
  }, [dispatch, user?.id])

  useEffect(() => {
    if (modal === 'transfer') return
    setReceiverQuery('')
    setReceiverResults([])
    setSelectedReceiver(null)
    setReceiverLoading(false)
  }, [modal])

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

  const resetTransfer = () => {
    setTransfer({ receiverId: '', amount: '', description: '' })
    setReceiverQuery('')
    setSelectedReceiver(null)
    setReceiverResults([])
  }

  const closeAll = () => {
    setConfirmOpen(false)
    onClose()
  }

  const triggerSuccess = (label: string, amount: number) => {
    setSuccessLabel(label)
    setSuccessAmount(amount)
    setShowSuccess(true)
    dispatch(fetchBalance())
    dispatch(fetchTransactions({ page: 0, size: 6 }))
    dispatch(fetchRewardSummary())
    setTimeout(() => setShowSuccess(false), 2400)
  }

  const handleTopup = async () => {
    if (actionLoading) return

    const amount = Number(topupAmount)
    if (Number.isNaN(amount) || amount < 1) {
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

            closeAll()
            triggerSuccess('Top-up', amount)
            notify('success', 'Top-up Successful!', `${formatCurrency(amount)} added to your wallet`)
            toast.success(`Wallet topped up with ${formatCurrency(amount)}`)
            setTopupAmount('')
          } catch {
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
                dispatch(fetchTransactions({ page: 0, size: 6 }))
                toast('Top-up cancelled', { icon: 'i' })
              } catch {
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
          await walletService.failPayment(user.id, orderId, response?.error?.description || 'Payment failed')
          dispatch(fetchTransactions({ page: 0, size: 6 }))
        } catch {
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

  const handleScratchRevealed = async (pts: number) => {
    try {
      await rewardsService.earnInternal(user!.id, scratchAmount)
    } catch {}
    if (user?.id && scratchCardId) removePendingScratchCard(user.id, scratchCardId)
    dispatch(fetchRewardSummary())
    notify('success', `+${pts} Points Added!`, `Reward points for your transfer of ${formatCurrency(scratchAmount)}`)
    toast.success(`${pts} reward points added to your account!`)
    setScratchCardId(null)
  }

  const handleTransferConfirm = async () => {
    setActionLoading(true)
    const payload: TransferRequest = {
      receiverId: parseInt(transfer.receiverId, 10),
      amount: parseFloat(transfer.amount),
      idempotencyKey: generateKey(),
      description: transfer.description || 'Transfer',
    }

    const res = await dispatch(transferFunds(payload))
    setActionLoading(false)
    setConfirmOpen(false)
    if (transferFunds.fulfilled.match(res)) {
      closeAll()
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
      resetTransfer()
    } else {
      toast.error((res.payload as string) || 'Transfer failed')
    }
  }

  const handleWithdrawConfirm = async () => {
    const amount = parseFloat(withdrawAmount)
    setActionLoading(true)
    const res = await dispatch(withdrawFunds(amount))
    setActionLoading(false)
    setConfirmOpen(false)
    if (withdrawFunds.fulfilled.match(res)) {
      closeAll()
      triggerSuccess('Withdrawal', amount)
      notify('success', 'Withdrawal Successful', `${formatCurrency(amount)} will be credited to your bank.`)
      toast.success('Withdrawal initiated!')
      setWithdrawAmount('')
    } else {
      toast.error((res.payload as string) || 'Withdrawal failed')
    }
  }

  return (
    <>
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

      <Modal open={modal === 'topup'} onClose={onClose} title="Top Up Wallet">
        <div className="space-y-4">
          <div>
            <label htmlFor="dashboard-topup-amount" className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Amount (Rs)</label>
            <input id="dashboard-topup-amount" type="number" placeholder="Enter amount" min={1}
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
                  Rs {a.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleTopup} disabled={actionLoading || !topupAmount} className="w-full btn-primary py-3 text-sm">
            {actionLoading ? 'Processing...' : `Pay ${topupAmount ? formatCurrency(parseFloat(topupAmount)) : '—'} via Razorpay`}
          </button>
        </div>
      </Modal>

      <Modal open={modal === 'transfer'} onClose={onClose} title="Transfer Money">
        <div className="space-y-4">
          <div>
            <label htmlFor="dashboard-receiver-search" className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Receiver</label>
            <div className="relative">
              <input
                id="dashboard-receiver-search"
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
            { key: 'amount' as const, label: 'Amount Rs (max Rs25,000)', placeholder: '0.00', type: 'number' },
            { key: 'description' as const, label: 'Note (optional)', placeholder: 'e.g. Rent, Lunch split', type: 'text' },
          ].map(f => (
            <div key={f.key}>
              <label htmlFor={`dashboard-tf-${f.key}`} className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
              <input id={`dashboard-tf-${f.key}`} type={f.type} placeholder={f.placeholder}
                value={transfer[f.key]} onChange={e => setTransfer(p => ({ ...p, [f.key]: e.target.value }))} className="input-field" />
            </div>
          ))}

          <button onClick={() => {
            const amt = parseFloat(transfer.amount)
            if (!transfer.receiverId) { toast.error('Select a receiver'); return }
            if (!amt || amt < 1 || amt > 25000) { toast.error('Amount must be Rs1-Rs25,000'); return }
            setConfirmOpen(true)
          }} className="w-full btn-primary py-3 text-sm">Review Transfer</button>
        </div>
      </Modal>

      <Modal open={modal === 'withdraw'} onClose={onClose} title="Withdraw Funds">
        <div className="space-y-4">
          <div className="p-3 rounded-xl text-sm" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
            Available: <strong style={{ color: 'var(--brand)' }}>{formatCurrency(balance?.balance ?? 0)}</strong>
          </div>
          <div>
            <label htmlFor="dashboard-withdraw-amount" className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Amount (Rs)</label>
            <input id="dashboard-withdraw-amount" type="number" placeholder="Enter amount" min={1} max={balance?.balance ?? 0}
              value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {[500, 1000, 2000].map(a => (
              <button key={a} onClick={() => setWithdrawAmount(String(Math.min(a, balance?.balance ?? 0)))}
                className="rounded-lg px-3 py-2 text-xs font-semibold"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                Rs {a.toLocaleString('en-IN')}
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

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={modal === 'transfer' ? handleTransferConfirm : handleWithdrawConfirm}
        title={modal === 'transfer' ? 'Confirm Transfer' : 'Confirm Withdrawal'}
        message={modal === 'transfer' ? `Send to User #${transfer.receiverId}` : 'Funds will be transferred to your bank'}
        amount={modal === 'transfer' ? parseFloat(transfer.amount) : parseFloat(withdrawAmount)}
        loading={actionLoading}
      />
    </>
  )
}
