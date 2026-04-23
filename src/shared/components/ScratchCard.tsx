import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import type { ScratchCardProps, RewardTier } from '../../types'
import { formatCurrency } from '../utils'
import { Icon8 } from './Icon8'
import { useAppSelector } from '../hooks'

type ScratchTheme = {
  cardBg: string
  cardBorder: string
  glow: string
  title: string
  subtitle: string
  scratchTop: string
  scratchMid: string
  scratchBottom: string
  revealFrom: string
  revealTo: string
  revealText: string
  revealSubText: string
  chipBg: string
  chipText: string
}

const SCRATCH_THEMES: Record<RewardTier, ScratchTheme> = {
  SILVER: {
    cardBg: 'linear-gradient(145deg, #1b2f4f, #0f1c33)',
    cardBorder: 'rgba(147, 197, 253, 0.45)',
    glow: '0 0 56px rgba(59,130,246,0.28), 0 24px 80px rgba(0,0,0,0.8)',
    title: '#dbeafe',
    subtitle: '#bfdbfe',
    scratchTop: '#2f4f7b',
    scratchMid: '#223a61',
    scratchBottom: '#182845',
    revealFrom: '#eaf4ff',
    revealTo: '#d7e9ff',
    revealText: '#1e40af',
    revealSubText: '#1d4ed8',
    chipBg: '#dbeafe',
    chipText: '#1d4ed8',
  },
  GOLD: {
    cardBg: 'linear-gradient(145deg, #4f3410, #2a1a04)',
    cardBorder: 'rgba(251, 191, 36, 0.45)',
    glow: '0 0 56px rgba(245,158,11,0.28), 0 24px 80px rgba(0,0,0,0.8)',
    title: '#fde68a',
    subtitle: '#fcd34d',
    scratchTop: '#7a581d',
    scratchMid: '#5a3f10',
    scratchBottom: '#3f2b08',
    revealFrom: '#fff7e0',
    revealTo: '#ffe9b3',
    revealText: '#a16207',
    revealSubText: '#b45309',
    chipBg: '#fef3c7',
    chipText: '#b45309',
  },
  PLATINUM: {
    cardBg: 'linear-gradient(145deg, #3a245f, #1f1639)',
    cardBorder: 'rgba(167, 139, 250, 0.5)',
    glow: '0 0 56px rgba(139,92,246,0.3), 0 24px 80px rgba(0,0,0,0.8)',
    title: '#ddd6fe',
    subtitle: '#c4b5fd',
    scratchTop: '#5d3f93',
    scratchMid: '#452d6f',
    scratchBottom: '#2e1f4f',
    revealFrom: '#f1eaff',
    revealTo: '#e5d5ff',
    revealText: '#6d28d9',
    revealSubText: '#7c3aed',
    chipBg: '#ede9fe',
    chipText: '#7c3aed',
  },
}

const ScratchCanvas: React.FC<{
  width: number
  height: number
  onComplete: () => void
  theme: ScratchTheme
}> = ({ width, height, onComplete, theme }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const completed = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = theme.scratchBottom
    ctx.fillRect(0, 0, width, height)

    const grad = ctx.createLinearGradient(0, 0, width, height)
    grad.addColorStop(0, theme.scratchTop)
    grad.addColorStop(0.52, theme.scratchMid)
    grad.addColorStop(1, theme.scratchBottom)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)

    for (let i = 0; i < 40; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      const r = Math.random() * 28 + 10
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.1 + 0.08})`
      ctx.fill()
    }

    for (let i = 0; i < 20; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      const r = Math.random() * 2 + 1
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.45 + 0.25})`
      ctx.fill()
    }

    ctx.fillStyle = 'rgba(255,255,255,0.42)'
    ctx.font = '700 20px DM Sans, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Scratch to reveal your reward!', width / 2, height / 2 - 12)
    ctx.font = '600 13px DM Sans, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.fillText('Hover, drag, or use your finger', width / 2, height / 2 + 16)
  }, [width, height, theme])

  const scratch = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current
    if (!canvas || completed.current) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(x, y, 30, 0, Math.PI * 2)
    ctx.fill()

    const imageData = ctx.getImageData(0, 0, width, height)
    let transparent = 0
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] < 128) transparent++
    }
    const pct = (transparent / (width * height)) * 100

    if (pct > 58 && !completed.current) {
      completed.current = true
      ctx.clearRect(0, 0, width, height)
      onComplete()
    }
  }, [width, height, onComplete])

  const getPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }

  const onDown = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawing.current = true
    const pos = getPos(e)
    scratch(pos.x, pos.y)
  }

  const onMouseMove = (e: React.MouseEvent) => {
    const pos = getPos(e)
    scratch(pos.x, pos.y)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDrawing.current) return
    const pos = getPos(e)
    scratch(pos.x, pos.y)
  }

  const onUp = () => { isDrawing.current = false }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseDown={onDown}
      onMouseMove={onMouseMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      onTouchStart={onDown}
      onTouchMove={onTouchMove}
      onTouchEnd={onUp}
      style={{ touchAction: 'none', cursor: 'crosshair' }}
      aria-label="Scratch card - scratch to reveal your reward"
    />
  )
}

export const ScratchCardModal: React.FC<ScratchCardProps> = ({
  points, transactionAmount, onRevealed, onClose,
}) => {
  const [revealed, setRevealed] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const tier = useAppSelector(s => s.rewards.summary?.tier) ?? 'SILVER'
  const theme = useMemo(() => SCRATCH_THEMES[tier], [tier])

  const cardW = 340
  const cardH = 160

  const handleComplete = useCallback(() => {
    setRevealed(true)
    confetti({
      particleCount: 130,
      spread: 82,
      origin: { y: 0.55 },
      colors: ['#22c55e', '#4ade80', '#fbbf24', '#818cf8', '#f472b6'],
      startVelocity: 35,
      gravity: 0.8,
    })
  }, [])

  const handleClaim = () => {
    setClaimed(true)
    onRevealed(points)
    setTimeout(onClose, 1800)
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-label="Scratch card reward"
      >
        <motion.div
          className="relative w-full max-w-sm"
          initial={{ scale: 0.72, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.72, y: 50 }}
          transition={{ type: 'spring', damping: 18, stiffness: 180 }}
        >
          <div
            className="rounded-3xl overflow-hidden"
            style={{
              background: theme.cardBg,
              border: `1px solid ${theme.cardBorder}`,
              boxShadow: theme.glow,
            }}
          >
            <div className="px-6 pt-5 pb-3 text-center">
              <motion.div
                animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="inline-flex mb-1"
              >
                <Icon8 name="success" size={38} />
              </motion.div>
              <h2 className="font-display font-bold text-lg" style={{ color: theme.title }}>You earned a reward!</h2>
              <p className="text-sm mt-0.5" style={{ color: theme.subtitle }}>
                Transfer of {formatCurrency(transactionAmount)} processed
              </p>
            </div>

            <div className="px-5 pb-2">
              <div className="scratch-card-wrapper" style={{ width: cardW, maxWidth: '100%', height: cardH, margin: '0 auto' }}>
                <div
                  className="scratch-reveal-content absolute inset-0 flex flex-col items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${theme.revealFrom}, ${theme.revealTo})`,
                    borderRadius: 20,
                  }}
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={revealed ? { scale: [0, 1.25, 1] } : {}}
                    transition={{ duration: 0.45, type: 'spring' }}
                    className="text-center relative z-[2]"
                  >
                    <div className="reward-coin-badge" aria-hidden="true">
                      <div className="coin-stack">
                        <span className="coin coin-back" />
                        <span className="coin coin-mid" />
                        <span className="coin coin-front" />
                      </div>
                    </div>
                    <div className="font-display font-black text-4xl mt-1" style={{ color: theme.revealText }}>
                      +{points}
                    </div>
                    <div className="text-sm font-bold" style={{ color: theme.revealSubText }}>REWARD POINTS</div>
                    <div className="text-xs mt-1" style={{ color: theme.revealSubText }}>1 pt = Rs 1 cashback</div>
                  </motion.div>
                </div>

                {!revealed && (
                  <ScratchCanvas
                    width={cardW}
                    height={cardH}
                    onComplete={handleComplete}
                    theme={theme}
                  />
                )}
              </div>
            </div>

            <div className="px-6 pb-5 pt-2 text-center space-y-3">
              {!revealed ? (
                <p className="text-sm font-medium" style={{ color: theme.subtitle }}>
                  Hover or scratch the card above to reveal your points
                </p>
              ) : !claimed ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <p className="text-sm font-semibold" style={{ color: theme.title }}>
                    You unlocked <span style={{ color: theme.subtitle }}>{points} bonus points!</span>
                  </p>
                  <motion.button
                    onClick={handleClaim}
                    className="w-full py-3 rounded-2xl font-bold text-sm"
                    style={{ background: theme.chipBg, color: theme.chipText }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    aria-label={`Claim ${points} reward points`}
                  >
                    Claim {points} Points -&gt;
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center"
                >
                  <div className="inline-flex mb-1"><Icon8 name="success" size={30} /></div>
                  <p className="text-sm font-bold" style={{ color: theme.title }}>Points added to your account!</p>
                </motion.div>
              )}

              {!claimed && (
                <button
                  onClick={onClose}
                  className="text-xs font-medium"
                  style={{ color: 'rgba(255,255,255,0.42)' }}
                  aria-label="Close scratch card without claiming"
                >
                  Skip for now
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
