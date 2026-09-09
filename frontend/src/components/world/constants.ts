// ExploreYC World — gamification constants.
// Mirror of backend/world_constants.py — keep the two in sync by hand.

/** Minimum stake to claim a plot ($5.00). Enforced server-side too. */
export const MIN_STAKE_CENTS = 500

/** Extra cents required on top of the leader's stake to overtake a rank. */
export const OVERTAKE_MARGIN_CENTS = 100

/** Plots snap to the nearest city within this radius; beyond it, city is null. */
export const CITY_SNAP_RADIUS_KM = 50

/**
 * Cents needed to overtake a leader whose stake is `leaderCents`.
 * Returns null when the leader's stake is unknown — the UI must say
 * "unknown" in that case, never guess a number.
 */
export function centsToBeat(leaderCents: number | null): number | null {
  if (leaderCents == null) return null
  return leaderCents + OVERTAKE_MARGIN_CENTS
}

/**
 * Format an integer cents amount as dollars: 500 -> "$5", 1950 -> "$19.50".
 * Whole-dollar amounts drop the ".00" for terminal-clean numbers.
 */
export function formatDollars(cents: number): string {
  const negative = cents < 0
  const abs = Math.abs(cents)
  const dollars = Math.floor(abs / 100)
  const rem = abs % 100
  const body = rem === 0 ? `$${dollars.toLocaleString('en-US')}` : `$${dollars.toLocaleString('en-US')}.${String(rem).padStart(2, '0')}`
  return negative ? `-${body}` : body
}

// ---- Promotions ----

export type PromotionTierId = '7d' | '30d'

export interface PromotionTier {
  id: PromotionTierId
  label: string
  days: number
  price_cents: number
}

/** Self-serve featured-placement tiers (launch pricing). */
export const PROMOTION_TIERS: PromotionTier[] = [
  { id: '7d', label: '7 days', days: 7, price_cents: 1900 },
  { id: '30d', label: '30 days', days: 30, price_cents: 4900 },
]

/** Max concurrently active featured promotions per country (global scope counts separately). */
export const MAX_FEATURED_PER_COUNTRY = 3
