import type { PendingScratchCard } from '../types'

const scratchStorageKey = (userId: number) => `payvault-pending-scratch-cards:${userId}`
const scratchEventName = 'payvault-pending-scratch-cards-updated'

const safeParse = (value: string | null): PendingScratchCard[] => {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const emitScratchCardsChanged = () => window.dispatchEvent(new Event(scratchEventName))

export const getPendingScratchCards = (userId?: number | null): PendingScratchCard[] => {
  if (!userId) return []
  return safeParse(localStorage.getItem(scratchStorageKey(userId)))
}

export const addPendingScratchCard = (card: PendingScratchCard): void => {
  const cards = getPendingScratchCards(card.userId)
  localStorage.setItem(scratchStorageKey(card.userId), JSON.stringify([card, ...cards]))
  emitScratchCardsChanged()
}

export const removePendingScratchCard = (userId: number, cardId: string): void => {
  const next = getPendingScratchCards(userId).filter(card => card.id !== cardId)
  localStorage.setItem(scratchStorageKey(userId), JSON.stringify(next))
  emitScratchCardsChanged()
}

export const subscribeScratchCards = (listener: () => void): (() => void) => {
  window.addEventListener(scratchEventName, listener)
  return () => window.removeEventListener(scratchEventName, listener)
}
