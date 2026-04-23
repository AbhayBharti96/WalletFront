import { describe, expect, it } from 'vitest'
import rewardsReducer, { fetchRewardSummary } from '@/store/rewardsSlice'
import type { RewardSummary } from '@/types'

const baseSummary = (overrides: Partial<RewardSummary> = {}): RewardSummary => ({
  userId: 1,
  points: 1200,
  tier: 'GOLD',
  nextTier: 'PLATINUM',
  pointsToNextTier: 3800,
  ...overrides,
})

const payload = (data: RewardSummary | null, userId = 1) => ({ userId, data })

describe('rewardsSlice tier handling', () => {
  it('keeps incoming tier when it is same or higher than current tier', () => {
    // First payload sets the current state to GOLD.
    const firstAction = fetchRewardSummary.fulfilled(payload(baseSummary()), 'req-1', undefined)
    const stateAfterFirst = rewardsReducer(undefined, firstAction)

    // Second payload upgrades to PLATINUM, which should be accepted.
    const upgradePayload = baseSummary({
      points: 5400,
      tier: 'PLATINUM',
      nextTier: undefined,
      pointsToNextTier: undefined,
    })
    const secondAction = fetchRewardSummary.fulfilled(payload(upgradePayload), 'req-2', undefined)
    const stateAfterUpgrade = rewardsReducer(stateAfterFirst, secondAction)

    expect(stateAfterUpgrade.summary?.tier).toBe('PLATINUM')
  })

  it('accepts a lower tier payload when the backend reports it', () => {
    // Start from a user who already reached GOLD.
    const goldAction = fetchRewardSummary.fulfilled(payload(baseSummary()), 'req-1', undefined)
    const stateAfterGold = rewardsReducer(undefined, goldAction)

    // Simulate the backend reporting the user's current tier as SILVER.
    const regressedPayload = baseSummary({
      points: 828,
      tier: 'SILVER',
      nextTier: 'GOLD',
      pointsToNextTier: 172,
    })
    const regressedAction = fetchRewardSummary.fulfilled(payload(regressedPayload), 'req-2', undefined)
    const finalState = rewardsReducer(stateAfterGold, regressedAction)

    expect(finalState.summary?.tier).toBe('SILVER')
    expect(finalState.summary?.nextTier).toBe('GOLD')
    expect(finalState.summary?.pointsToNextTier).toBe(172)
  })

  it('preserves existing summary when a later payload is null', () => {
    // Seed state with a valid GOLD summary.
    const initial = rewardsReducer(undefined, fetchRewardSummary.fulfilled(payload(baseSummary()), 'req-1', undefined))

    // Null payload can happen on malformed API response unwrap; we keep prior state.
    const afterNull = rewardsReducer(initial, fetchRewardSummary.fulfilled(payload(null), 'req-2', undefined))

    expect(afterNull.summary).toEqual(initial.summary)
    expect(afterNull.summary?.tier).toBe('GOLD')
  })

  it('accepts same-tier updates and refreshes numeric fields', () => {
    // Start from one GOLD snapshot.
    const initial = rewardsReducer(undefined, fetchRewardSummary.fulfilled(payload(baseSummary({
      points: 1200,
      pointsToNextTier: 3800,
    })), 'req-1', undefined))

    // New GOLD payload with updated points should replace previous numbers.
    const updatedPayload = baseSummary({
      points: 1500,
      pointsToNextTier: 3500,
    })
    const updated = rewardsReducer(initial, fetchRewardSummary.fulfilled(payload(updatedPayload), 'req-2', undefined))

    expect(updated.summary?.tier).toBe('GOLD')
    expect(updated.summary?.points).toBe(1500)
    expect(updated.summary?.pointsToNextTier).toBe(3500)
  })
})
