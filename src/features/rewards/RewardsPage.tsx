import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import toast from 'react-hot-toast'
import { useAppDispatch, useAppSelector, useNotify, useTheme } from '../../shared/hooks'
import { rewardsService } from '../../core/api'
import { fetchRewardSummary, fetchCatalog, fetchRewardTransactions, redeemReward, redeemPointsThunk } from '../../store/rewardsSlice'
import { fetchBalance } from '../../store/walletSlice'
import { Modal, Skeleton } from '../../shared/components/ui'
import { ScratchCardModal } from '../../shared/components/ScratchCard'
import { formatCurrency, formatDate, getTierStyle, getTierIcon, getTierProgress } from '../../shared/utils'
import type { PendingScratchCard, RewardItem, RewardTier } from '../../types'
import { Icon8 } from '../../shared/components/Icon8'
import { getPendingScratchCards, removePendingScratchCard, subscribeScratchCards } from '../../shared/scratchCards'

const TIER_RANK: Record<RewardTier, number> = {
  SILVER: 0,
  GOLD: 1,
  PLATINUM: 2,
}

const isRewardCurrentlyVisible = (item: RewardItem) => {
  const now = Date.now()
  const activeFrom = item.activeFrom ? new Date(item.activeFrom).getTime() : null
  const activeUntil = item.activeUntil ? new Date(item.activeUntil).getTime() : null
  if (activeFrom && activeFrom > now) return false
  if (activeUntil && activeUntil < now) return false
  return item.active
}

const canSeeCatalogItem = (item: RewardItem, currentTier?: RewardTier) => {
  if (!isRewardCurrentlyVisible(item)) return false
  if (!item.tierRequired) return true
  if (!currentTier) return false
  return TIER_RANK[currentTier] >= TIER_RANK[item.tierRequired]
}

// ── Redeem success animation overlay ────────────────────────────────────────
const RedeemSuccessModal: React.FC<{ coupon?: string; itemName: string; expiresAt?: string | null; onClose: () => void }> = ({ coupon, itemName, expiresAt, onClose }) => (
  <AnimatePresence>
    <motion.div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center sm:p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      role="dialog" aria-modal="true" aria-label="Redemption successful">
      <motion.div className="card w-full max-w-sm text-center overflow-hidden rounded-[24px]"
        initial={{ scale: 0.5, rotate: -8 }} animate={{ scale: 1, rotate: 0 }}
        exit={{ scale: 0.5 }} transition={{ type: 'spring', damping: 14, stiffness: 180 }}>
        <div className="space-y-4 p-5 sm:p-6">
          <motion.div className="inline-flex" initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }}
            transition={{ delay: 0.15, duration: 0.5, times: [0, 0.7, 1] }}><Icon8 name="success" size={58} /></motion.div>
          <div>
            <h3 className="font-display font-bold text-xl" style={{ color: 'var(--text-primary)' }}>Redeemed!</h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{itemName}</p>
          </div>
          {coupon ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Your Coupon Code</p>
              <div className="font-mono font-bold px-3 py-3 rounded-xl text-center break-all leading-relaxed"
                style={{ background: 'var(--bg-primary)', color: 'var(--accent)', border: '2px dashed var(--border)' }}>
                {coupon}
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Save this code — it won't be shown again</p>
            </motion.div>
          ) : (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              className="text-sm font-medium" style={{ color: 'var(--success)' }}>
              Cashback credited to your wallet!
            </motion.p>
          )}
          {expiresAt && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Valid until {formatDate(expiresAt, 'DD MMM YYYY, hh:mm A')}
            </p>
          )}
          <button onClick={onClose} className="btn-primary w-full py-2.5 text-sm" autoFocus>Done</button>
        </div>
      </motion.div>
    </motion.div>
  </AnimatePresence>
)

// ── Reward catalog card ───────────────────────────────────────────────────────
const RewardCard: React.FC<{ item: RewardItem; userPoints: number; onRedeem: (item: RewardItem) => void }> = ({ item, userPoints, onRedeem }) => {
  const canRedeem = userPoints >= item.pointsRequired && item.stock > 0 && item.active
  const typeIcon = { CASHBACK: 'wallet', COUPON: 'transactions', VOUCHER: 'rewards' }[item.type] || 'rewards'
  const TierIcon = getTierIcon(item.tierRequired)
  const tierS = getTierStyle(item.tierRequired)
  const hasTier = Boolean(item.tierRequired)

  return (
    <motion.div
      className="card card-hover reward-shine flex flex-col"
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      style={hasTier ? { borderColor: tierS.border, boxShadow: tierS.glow } : undefined}
    >
      <div className="p-5 flex-1">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: 'var(--bg-primary)' }} aria-hidden="true"><Icon8 name={typeIcon as React.ComponentProps<typeof Icon8>['name']} size={24} /></div>
          <div className="flex flex-wrap justify-end gap-1.5 max-w-[70%]">
            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: '#fef3c7', color: '#a16207' }}>
              <span className="inline-flex items-center gap-1"><Icon8 name="star" size={12} /> {item.pointsRequired.toLocaleString()} pts</span>
            </span>
            {item.tierRequired && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: tierS.bg, color: tierS.text, border: `1px solid ${tierS.border}` }}>
                <TierIcon fontSize="inherit" />
                <span>{item.tierRequired}+</span>
              </span>
            )}
          </div>
        </div>
        <h4 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{item.name}</h4>
        <p className="text-xs mb-2 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{item.description}</p>
        {item.type === 'CASHBACK' && item.cashbackAmount && (
          <p className="text-xs font-bold" style={{ color: 'var(--brand)' }}>
            Get {formatCurrency(item.cashbackAmount)} cashback
          </p>
        )}
        {item.activeUntil && (
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Expires {formatDate(item.activeUntil, 'DD MMM YYYY, hh:mm A')}
          </p>
        )}
        <p className="text-xs mt-1" style={{ color: item.stock > 0 ? 'var(--text-muted)' : 'var(--danger)' }}>
          {item.stock > 0 ? `${item.stock} remaining` : 'Out of stock'}
        </p>
      </div>
      <div className="px-5 pb-5">
        <motion.button
          onClick={() => canRedeem && onRedeem(item)}
          disabled={!canRedeem}
          whileTap={canRedeem ? { scale: 0.95 } : {}}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: canRedeem ? 'var(--brand)' : 'var(--bg-primary)',
            color: canRedeem ? '#fff' : 'var(--text-muted)',
            border: `1px solid ${canRedeem ? 'var(--brand)' : 'var(--border)'}`,
            cursor: canRedeem ? 'pointer' : 'not-allowed',
          }}
          aria-label={canRedeem ? `Redeem ${item.name} for ${item.pointsRequired} points` : 'Cannot redeem'}
          aria-disabled={!canRedeem}
        >
          {!item.active ? 'Unavailable'
            : item.stock === 0 ? 'Out of Stock'
            : userPoints < item.pointsRequired ? `Need ${(item.pointsRequired - userPoints).toLocaleString()} more pts`
            : 'Redeem Now'}
        </motion.button>
      </div>
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RewardsPage() {
  const dispatch = useAppDispatch()
  const notify = useNotify()
  const { isDark } = useTheme()
  const { user } = useAppSelector(s => s.auth)
  const { summary, catalog, transactions, loading } = useAppSelector(s => s.rewards)

  const [tab, setTab] = useState<'catalog' | 'scratch' | 'history'>('catalog')
  const [confirmItem, setConfirmItem] = useState<RewardItem | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [successData, setSuccessData] = useState<{ coupon?: string; itemName: string; expiresAt?: string | null } | null>(null)
  const [redeemPts, setRedeemPts] = useState('')
  const [ptsLoading, setPtsLoading] = useState(false)
  const [pendingScratchCards, setPendingScratchCards] = useState<PendingScratchCard[]>([])
  const [activeScratchCard, setActiveScratchCard] = useState<PendingScratchCard | null>(null)

  useEffect(() => {
    if (user?.id) {
      dispatch(fetchRewardSummary()); dispatch(fetchCatalog()); dispatch(fetchRewardTransactions())
    }
  }, [dispatch, user?.id])

  useEffect(() => {
    if (!user?.id) {
      setPendingScratchCards([])
      return
    }
    const sync = () => setPendingScratchCards(getPendingScratchCards(user.id))
    sync()
    return subscribeScratchCards(sync)
  }, [user?.id])

  const handleRedeemItem = async () => {
    if (!confirmItem) return
    const redeemedItem = confirmItem
    setActionLoading(true)
    const res = await dispatch(redeemReward(confirmItem.id))
    setActionLoading(false); setConfirmItem(null)

    if (redeemReward.fulfilled.match(res)) {
      // Confetti burst
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ['#22c55e', '#f59e0b', '#818cf8', '#f472b6'] })
      setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 50, origin: { x: 0 }, colors: ['#22c55e', '#fbbf24'] }), 250)
      setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 50, origin: { x: 1 }, colors: ['#818cf8', '#f472b6'] }), 400)

      const redemption = res.payload?.data
      setSuccessData({ coupon: redemption?.couponCode, itemName: redeemedItem.name, expiresAt: redeemedItem.activeUntil })
      dispatch(fetchRewardSummary()); dispatch(fetchRewardTransactions()); dispatch(fetchBalance()); dispatch(fetchCatalog())
      notify('success', 'Reward Redeemed!', `${redeemedItem.name} successfully redeemed`)
    } else {
      toast.error(res.payload as string || 'Redemption failed')
    }
  }

  const handleRedeemPoints = async () => {
    const pts = parseInt(redeemPts)
    if (!pts || pts < 1) { toast.error('Enter valid points'); return }
    if (pts > (summary?.points ?? 0)) { toast.error('Insufficient points'); return }
    setPtsLoading(true)
    const res = await dispatch(redeemPointsThunk(pts))
    setPtsLoading(false)
    if (redeemPointsThunk.fulfilled.match(res)) {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.65 }, colors: ['#22c55e', '#fbbf24'] })
      dispatch(fetchRewardSummary()); dispatch(fetchRewardTransactions()); dispatch(fetchBalance())
      notify('success', 'Points Converted!', `${pts} points = ${formatCurrency(pts)} credited to wallet`)
      toast.success(`${formatCurrency(pts)} added to your wallet!`)
      setRedeemPts('')
    } else {
      toast.error(res.payload as string || 'Conversion failed')
    }
  }

  const tierStyle = getTierStyle(summary?.tier)
  const tierProgress = getTierProgress(summary)
  const pts = tierProgress.points
  const TierIcon = getTierIcon(summary?.tier)
  const currentTier = summary?.tier as RewardTier | undefined
  const nextTierStyle = getTierStyle(tierProgress.nextTier)
  const visibleCatalog = catalog.filter(item => canSeeCatalogItem(item, currentTier))
  const softMuted = isDark ? '#9fb4d7' : 'var(--text-muted)'
  const softSecondary = isDark ? '#bfd0ea' : 'var(--text-secondary)'
  const isSilver = (summary?.tier ?? 'SILVER') === 'SILVER'
  const effectiveTierText = isDark && isSilver ? '#dbe7ff' : tierStyle.text
  const effectiveTierBorder = isDark && isSilver ? '#3f567a' : tierStyle.border

  const handlePendingScratchClaim = async (card: PendingScratchCard) => {
    try {
      await rewardsService.earnInternal(card.userId, card.transactionAmount)
      await dispatch(fetchRewardSummary())
      await dispatch(fetchBalance())
      await dispatch(fetchRewardTransactions())
      removePendingScratchCard(card.userId, card.id)
      setPendingScratchCards(cards => cards.filter(item => item.id !== card.id))
      notify('success', `+${card.points} Points Added!`, `Reward points for your transfer of ${formatCurrency(card.transactionAmount)}`)
      toast.success(`${card.points} reward points added to your account!`)
    } catch {
      toast.error('Could not claim scratch card points')
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-3 sm:p-4 lg:p-6">
      {successData && (
        <RedeemSuccessModal coupon={successData.coupon} itemName={successData.itemName} expiresAt={successData.expiresAt} onClose={() => setSuccessData(null)} />
      )}
      {activeScratchCard && (
        <ScratchCardModal
          points={activeScratchCard.points}
          transactionAmount={activeScratchCard.transactionAmount}
          onRevealed={async () => {
            await handlePendingScratchClaim(activeScratchCard)
            setActiveScratchCard(null)
          }}
          onClose={() => setActiveScratchCard(null)}
        />
      )}

      {/* Redeem item confirm */}
      <AnimatePresence>
        {confirmItem && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setConfirmItem(null)} />
            <motion.div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4"
              role="dialog" aria-modal="true" aria-label={`Confirm redeem ${confirmItem.name}`}>
              <motion.div className="card w-full max-w-sm text-center overflow-hidden rounded-[24px]"
                initial={{ scale: 0.7, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.7, y: 30 }}
                transition={{ type: 'spring', damping: 18 }}>
                <div className="space-y-4 p-5 sm:p-6">
                  <motion.div className="inline-flex" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }}>
                    <Icon8 name={({ CASHBACK: 'wallet', COUPON: 'transactions', VOUCHER: 'rewards' }[confirmItem.type] || 'rewards') as React.ComponentProps<typeof Icon8>['name']} size={42} />
                  </motion.div>
                  <div>
                    <h3 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{confirmItem.name}</h3>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{confirmItem.description}</p>
                    <div className="text-2xl font-bold mt-3" style={{ color: '#f59e0b' }}>
                      <span className="inline-flex items-center gap-1"><Icon8 name="star" size={16} /> {confirmItem.pointsRequired.toLocaleString()} points</span>
                    </div>
                  </div>
                  {confirmItem.type === 'CASHBACK' && confirmItem.cashbackAmount && (
                    <div className="p-2 rounded-xl text-sm" style={{ background: '#dcfce7', color: '#16a34a' }}>
                      {formatCurrency(confirmItem.cashbackAmount)} will be credited instantly
                    </div>
                  )}
                  <div className="flex flex-col-reverse gap-3 sm:flex-row">
                    <button onClick={() => setConfirmItem(null)} className="flex-1 btn-secondary py-2.5 text-sm">Cancel</button>
                    <motion.button onClick={handleRedeemItem} disabled={actionLoading}
                      className="flex-1 btn-primary py-2.5 text-sm" whileTap={{ scale: 0.96 }}
                      style={{ opacity: actionLoading ? 0.6 : 1 }}>
                      {actionLoading ? 'Redeeming…' : 'Confirm Redeem'}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div>
        <h1 className="text-xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>Rewards & Loyalty</h1>
        <p className="text-sm mt-0.5" style={{ color: softSecondary }}>Earn points, level up, and redeem amazing rewards</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div className="card p-5" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-3xl font-display font-black inline-flex items-center gap-1" style={{ color: '#f59e0b' }}><Icon8 name="star" size={22} /> {pts.toLocaleString()}</div>
          <div className="text-sm mt-1" style={{ color: softSecondary }}>Available Points</div>
          <div className="text-xs mt-0.5" style={{ color: softMuted }}>1 point = ₹1 cashback value</div>
        </motion.div>

        <motion.div className="card p-5" style={{ borderColor: `${effectiveTierBorder}80`, background: isDark ? '#111d34' : 'var(--bg-card)' }}
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-3xl" style={{ color: effectiveTierText }}><TierIcon fontSize="inherit" /></span>
            <div>
              <div className="font-bold font-display" style={{ color: effectiveTierText }}>{summary?.tier ?? 'SILVER'}</div>
              <div className="text-xs" style={{ color: softMuted }}>Loyalty Tier</div>
            </div>
          </div>
          {tierProgress.nextTier && (
            <>
              <div className="w-full h-2 rounded-full overflow-hidden mt-2" style={{ background: isDark ? '#2d4263' : 'var(--border)' }}>
                <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg,${tierStyle.text},${nextTierStyle.text})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${tierProgress.percent}%` }}
                  transition={{ delay: 0.4, duration: 1.2, ease: 'easeOut' }} />
              </div>
              <div className="text-xs mt-1" style={{ color: softMuted }}>
                {tierProgress.remaining.toLocaleString()} pts to {tierProgress.nextTier}
              </div>
            </>
          )}
        </motion.div>

        <motion.div className="card p-5" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Convert to Cash</div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input type="number" placeholder="Points" min={1} max={pts} value={redeemPts}
              onChange={e => setRedeemPts(e.target.value)} className="input-field py-2 text-sm flex-1"
              aria-label="Points to convert to cash" />
            <motion.button onClick={handleRedeemPoints} disabled={ptsLoading || !redeemPts}
              className="btn-primary px-3 py-2 text-xs flex-shrink-0 sm:w-auto" whileTap={{ scale: 0.95 }}>
              {ptsLoading ? '…' : '→ ₹'}
            </motion.button>
          </div>
          {redeemPts && <div className="text-xs mt-1 font-medium" style={{ color: 'var(--brand)' }}>= {formatCurrency(parseInt(redeemPts) || 0)}</div>}
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="grid w-full grid-cols-3 gap-1 rounded-xl p-1 sm:w-fit sm:flex" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        role="tablist" aria-label="Rewards sections">
        {(['catalog', 'scratch', 'history'] as const).map(t => (
          <button key={t} role="tab" aria-selected={tab === t}
            onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
            style={{ background: tab === t ? 'var(--brand)' : 'transparent', color: tab === t ? '#fff' : softSecondary }}>
            {t === 'catalog' ? 'Catalog' : t === 'scratch' ? `Scratch${pendingScratchCards.length ? ` (${pendingScratchCards.length})` : ''}` : 'History'}
          </button>
        ))}
      </div>

      {/* Catalog */}
      {tab === 'catalog' && (
        <div role="tabpanel" aria-label="Rewards catalog">
          {loading
            ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-52 w-full" />)}</div>
            : visibleCatalog.length === 0
              ? <div className="card p-12 text-center"><div className="inline-flex mb-3"><Icon8 name="rewards" size={40} /></div><p style={{ color: 'var(--text-muted)' }}>No rewards available</p></div>
              : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleCatalog.map(item => (
                    <RewardCard key={item.id} item={item} userPoints={pts} onRedeem={setConfirmItem} />
                  ))}
                </div>
          }
        </div>
      )}

      {tab === 'scratch' && (
        <motion.div className="card p-5" role="tabpanel" aria-label="Scratch cards"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {pendingScratchCards.length === 0
            ? <div className="text-center py-12"><div className="inline-flex mb-3"><Icon8 name="rewards" size={40} /></div><p style={{ color: 'var(--text-muted)' }}>No scratch cards waiting</p></div>
            : <div className="grid gap-4 sm:grid-cols-2">
                {pendingScratchCards.map(card => (
                  <div key={card.id} className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-primary)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Pending Scratch Card</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                          Transfer {formatCurrency(card.transactionAmount)} on {formatDate(card.createdAt, 'DD MMM YYYY, hh:mm A')}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>
                        <Icon8 name="star" size={12} /> {card.points} pts
                      </span>
                    </div>
                    <div className="mt-4 flex gap-3">
                      <button onClick={() => setActiveScratchCard(card)} className="btn-primary flex-1 py-2.5 text-sm">Open Card</button>
                      <button onClick={() => removePendingScratchCard(card.userId, card.id)} className="btn-secondary px-4 py-2.5 text-sm">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
          }
        </motion.div>
      )}

      {/* History */}
      {tab === 'history' && (
        <motion.div className="card overflow-hidden" role="tabpanel" aria-label="Reward transaction history"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {transactions.length === 0
            ? <div className="text-center py-12"><div className="inline-flex mb-3"><Icon8 name="transactions" size={40} /></div><p style={{ color: 'var(--text-muted)' }}>No reward transactions yet</p></div>
            : <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {transactions.map((tx, i) => (
                  <motion.div key={tx.id} className="flex flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{
                        background: (tx.type === 'EARN' || tx.type === 'BONUS') ? '#fef3c7' : '#ede9fe',
                        color: (tx.type === 'EARN' || tx.type === 'BONUS') ? '#b45309' : '#7c3aed',
                      }}>
                      <Icon8 name={({ EARN: 'star', BONUS: 'target', REDEEM: 'rewards', EXPIRE: 'clock' }[tx.type] || 'star') as React.ComponentProps<typeof Icon8>['name']} size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{tx.description || tx.type}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {formatDate(tx.createdAt, 'DD MMM YYYY, hh:mm A')}
                        {tx.expiryDate ? ` • Expires ${formatDate(tx.expiryDate, 'DD MMM YYYY, hh:mm A')}` : ''}
                      </div>
                    </div>
                    <div className="font-bold text-sm" style={{ color: (tx.type === 'REDEEM' || tx.type === 'EXPIRE') ? 'var(--danger)' : '#f59e0b' }}>
                      {(tx.type === 'REDEEM' || tx.type === 'EXPIRE') ? '-' : '+'}{tx.points} pts
                    </div>
                  </motion.div>
                ))}
              </div>
          }
        </motion.div>
      )}
    </div>
  )
}
