/**
 * The arithmetic behind a stake, and nothing else.
 *
 * These four functions were the only part of the deleted claim wizard's
 * `AmountPicker` that survived it: the wizard's slider, its preset pills and
 * its two "takes #1 in <scope>" rows are gone with the rest of the wizard, but
 * the RULES they enforced are the same rules the server enforces, and the
 * stake modal still has to say them before Stripe does.
 *
 * Nothing here invents a number. `paymentToTakeFirst` returns null for an
 * unknown leader stake rather than guessing one — <Money cents={null}> is what
 * prints the word "unknown" at the call site.
 */

import { MIN_STAKE_CENTS, formatDollars } from '../constants'

/**
 * Ceiling for a single payment, in cents ($999,999). Mirrors the server-side
 * cap so no control can represent an amount the server would refuse.
 */
export const MAX_STAKE_CENTS = 99_999_900

/**
 * The same rules the checkout endpoint enforces, checked here so the buyer
 * hears them before Stripe does. Returns null when the amount is payable.
 */
export function validateAmountCents(cents: number): string | null {
  if (!Number.isFinite(cents) || !Number.isInteger(cents)) {
    return 'Enter an amount in whole cents.'
  }
  if (cents < MIN_STAKE_CENTS) {
    return `Minimum is ${formatDollars(MIN_STAKE_CENTS)}.`
  }
  if (cents > MAX_STAKE_CENTS) {
    return `That is above the ${formatDollars(MAX_STAKE_CENTS)} per-payment limit.`
  }
  return null
}

/**
 * Payment that takes #1 in a scope, net of what the buyer already holds.
 * `centsToBeat` is the server's total (leader + margin); rank is cumulative
 * stake, so a buyer holding $20 against a $50 target needs $31, not $51.
 */
export function paymentToTakeFirst(centsToBeat: number | null, existingCents = 0): number | null {
  if (centsToBeat === null) return null
  return Math.max(MIN_STAKE_CENTS, centsToBeat - existingCents)
}

/** "12", "12.5", "$1,234.56" → cents, or null when not a parsable amount. */
export function parseDollarsToCents(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '')
  if (cleaned === '' || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return null
  const [dollars, cents = ''] = cleaned.split('.')
  return Number(dollars) * 100 + Number((cents + '00').slice(0, 2))
}

/** Whole dollars for an input, without a trailing ".00" nobody typed. */
export function dollarsString(cents: number): string {
  return cents % 100 === 0 ? String(Math.round(cents / 100)) : (cents / 100).toFixed(2)
}
