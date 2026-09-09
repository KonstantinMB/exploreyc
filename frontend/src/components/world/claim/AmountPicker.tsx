// Step three of the claim wizard: how much.
//
// Ported from startupworld's claim/AmountPicker.tsx. The "$X takes #1 in
// <scope>" readout is the product — it is the first and largest thing on the
// screen, recomputes on every keystroke and slider pixel, and each figure is
// a button that fills the amount in. It never guesses: a scope whose leader
// stake is unknown says so plainly instead of printing a number.

import { useId, useState } from 'react'
import { ArrowRight, Crown, Info } from 'lucide-react'

import { cn } from '../../../lib/utils'
import { MIN_STAKE_CENTS, formatDollars } from '../constants'

/** What each scope currently costs to win. null = unknown, never guessed. */
export interface AmountContext {
  cityName: string | null
  /** Total cents needed to take #1 in the city (server's cents_to_beat). */
  cityCentsToBeat: number | null
  countryName: string | null
  countryCentsToBeat: number | null
}

/**
 * Ceiling for a single payment, in cents ($999,999). Mirrors the server-side
 * cap so the slider cannot represent an amount the server would refuse.
 */
export const MAX_STAKE_CENTS = 99_999_900

const PRESETS_CENTS = [500, 2500, 10_000] as const

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

function clampAmount(cents: number): number {
  if (!Number.isFinite(cents)) return MIN_STAKE_CENTS
  return Math.min(MAX_STAKE_CENTS, Math.max(MIN_STAKE_CENTS, Math.round(cents)))
}

function dollarsString(cents: number): string {
  return cents % 100 === 0 ? String(Math.round(cents / 100)) : (cents / 100).toFixed(2)
}

/** "12", "12.5", "$1,234.56" → cents, or null when not a parsable amount. */
export function parseDollarsToCents(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '')
  if (cleaned === '' || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return null
  const [dollars, cents = ''] = cleaned.split('.')
  return Number(dollars) * 100 + Number((cents + '00').slice(0, 2))
}

export interface AmountPickerProps {
  valueCents: number
  onChange: (cents: number) => void
  context?: AmountContext | null
  /** Cumulative stake the buyer already holds at this plot (top-up flow). */
  existingStakeCents?: number
}

export function AmountPicker({
  valueCents,
  onChange,
  context = null,
  existingStakeCents = 0,
}: AmountPickerProps) {
  const baseId = useId()
  const amountId = `${baseId}-amount`
  const amountHintId = `${baseId}-amount-hint`

  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')

  const amountError = validateAmountCents(valueCents)

  const cityNeeded = paymentToTakeFirst(context?.cityCentsToBeat ?? null, existingStakeCents)
  const countryNeeded = paymentToTakeFirst(context?.countryCentsToBeat ?? null, existingStakeCents)

  /**
   * The slider always reaches far enough to take the country, so the top spot
   * is something a buyer can physically drag to rather than a number they are
   * told about. Capped at the payment ceiling.
   */
  const maxCents = Math.min(
    MAX_STAKE_CENTS,
    Math.max(
      10_000,
      countryNeeded !== null ? Math.ceil((countryNeeded * 1.25) / 100) * 100 : 0,
      Math.ceil((valueCents * 1.25) / 100) * 100,
    ),
  )

  const commit = (cents: number) => onChange(clampAmount(cents))

  const sliderDollars = Math.min(
    Math.max(Math.round(valueCents / 100), MIN_STAKE_CENTS / 100),
    Math.round(maxCents / 100),
  )

  const position = (cents: number) =>
    ((Math.min(cents, maxCents) - MIN_STAKE_CENTS) / Math.max(1, maxCents - MIN_STAKE_CENTS)) * 100

  const marks = [
    { key: 'city', cents: cityNeeded },
    { key: 'country', cents: countryNeeded },
  ].filter(
    (m): m is { key: string; cents: number } =>
      m.cents !== null && m.cents >= MIN_STAKE_CENTS && m.cents <= maxCents,
  )

  return (
    <div className="flex flex-col gap-6 font-mono">
      {/* ---- the readout — the reason this screen exists ------------------ */}
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">What it takes</span>

        {/* One polite live region for the whole readout, so a drag that flips
            City from "takes it" to "does not" speaks once, not twice. */}
        <div
          aria-live="polite"
          className="flex flex-col divide-y divide-border/80 rounded-sm border border-border/80 bg-card/50"
        >
          <ScopeRow
            scope="City"
            place={context?.cityName ?? null}
            needed={cityNeeded}
            amountCents={valueCents}
            onTake={() => cityNeeded !== null && commit(cityNeeded)}
          />
          <ScopeRow
            scope="Country"
            place={context?.countryName ?? null}
            needed={countryNeeded}
            amountCents={valueCents}
            onTake={() => countryNeeded !== null && commit(countryNeeded)}
          />
        </div>
      </div>

      {/* ---- the amount itself ------------------------------------------- */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={amountId} className="text-xs uppercase tracking-wider text-muted-foreground">
            Your stake
          </label>

          <div
            className={cn(
              'flex h-9 w-32 items-center gap-1 rounded-md border bg-background px-3',
              'ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
              amountError ? 'border-red-500' : 'border-input focus-within:border-[#FB651E]/60',
            )}
          >
            {/* Real text rather than a pseudo-element, so a screen reader
                still hears the unit. Orange because it is live data. */}
            <span className="text-sm font-medium text-[#FB651E]">$</span>
            <input
              id={amountId}
              inputMode="decimal"
              autoComplete="off"
              className="w-full bg-transparent text-right font-mono text-sm outline-none"
              value={focused ? draft : dollarsString(valueCents)}
              aria-invalid={amountError !== null}
              aria-describedby={amountHintId}
              onFocus={() => {
                setDraft(dollarsString(valueCents))
                setFocused(true)
              }}
              onChange={(event) => {
                setDraft(event.target.value)
                const parsed = parseDollarsToCents(event.target.value)
                // Raw while typing: clamping mid-keystroke would fight anyone
                // typing "100" one digit at a time.
                if (parsed !== null) onChange(parsed)
              }}
              onBlur={() => {
                setFocused(false)
                commit(valueCents)
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="relative">
            {/* Native range input: free keyboard support (arrows, Home/End),
                and aria-valuetext can carry the money shape directly. */}
            <input
              type="range"
              min={MIN_STAKE_CENTS / 100}
              max={Math.round(maxCents / 100)}
              step={1}
              value={sliderDollars}
              aria-label="Amount to stake"
              aria-valuetext={formatDollars(sliderDollars * 100)}
              onChange={(event) => onChange(Number(event.target.value) * 100)}
              className="h-2 w-full cursor-pointer appearance-none rounded-none accent-[#FB651E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
              style={{
                background: `linear-gradient(to right, #FB651E 0%, #FB651E ${position(sliderDollars * 100)}%, hsl(var(--muted)) ${position(sliderDollars * 100)}%, hsl(var(--muted)) 100%)`,
              }}
            />

            {/* Where the two ranks sit on the track. Decoration over the real
                control — pointer-events off, never a hit target. Only drawn
                for a scope whose leader is known. */}
            {marks.map((mark) => (
              <span
                key={mark.key}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-[#FB651E]"
                style={{ left: `${position(mark.cents)}%` }}
              />
            ))}
          </div>

          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{formatDollars(MIN_STAKE_CENTS)}</span>
            <span>{formatDollars(maxCents)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {PRESETS_CENTS.map((cents) => {
            const active = valueCents === cents
            return (
              <button
                key={cents}
                type="button"
                aria-pressed={active}
                onClick={() => commit(cents)}
                className={cn(
                  'h-10 flex-1 rounded-md border font-mono text-sm transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
                  active
                    ? 'border-[#FB651E] bg-[#FB651E] text-white hover:bg-[#E65C00]'
                    : 'border-input bg-background hover:border-[#FB651E]/60 hover:text-[#FB651E]',
                )}
              >
                {formatDollars(cents)}
              </button>
            )
          })}
        </div>

        {amountError ? (
          <p id={amountHintId} role="alert" className="text-xs leading-snug text-red-500">
            {amountError}
          </p>
        ) : (
          <p id={amountHintId} className="text-xs leading-snug text-muted-foreground">
            {existingStakeCents > 0 ? (
              <>
                You already hold {formatDollars(existingStakeCents)} here — this takes you to{' '}
                {formatDollars(existingStakeCents + valueCents)}. Non-refundable.
              </>
            ) : (
              <>From {formatDollars(MIN_STAKE_CENTS)}. Charged once, non-refundable.</>
            )}
          </p>
        )}
      </div>
    </div>
  )
}

interface ScopeRowProps {
  scope: string
  place: string | null
  /** Payment that takes #1, already net of the buyer's stake. null = unknown. */
  needed: number | null
  amountCents: number
  onTake: () => void
}

function ScopeRow({ scope, place, needed, amountCents, onTake }: ScopeRowProps) {
  // No place, or a place whose current leader we do not know. Either way this
  // row has no honest number to print — inventing one is the single failure
  // mode that would make a buyer feel cheated after they had already paid.
  if (!place || needed === null) {
    return (
      <div className="flex items-start gap-3 px-3 py-3.5">
        <span className="w-16 shrink-0 pt-0.5 text-xs uppercase tracking-wider text-muted-foreground">
          {scope}
        </span>
        <p className="flex min-w-0 flex-1 items-start gap-2 text-sm leading-snug text-muted-foreground">
          <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {place
            ? `The leader stake in ${place} is unknown. Your rank there is settled at checkout.`
            : `No ${scope.toLowerCase()} in range for this point.`}
        </p>
      </div>
    )
  }

  const takesIt = amountCents >= needed

  if (takesIt) {
    return (
      <div className="flex items-start gap-3 bg-[#FB651E]/5 px-3 py-3.5 shadow-[inset_2px_0_0_#FB651E]">
        <span className="w-16 shrink-0 pt-0.5 text-xs uppercase tracking-wider text-muted-foreground">
          {scope}
        </span>
        <p className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1 text-base leading-snug">
          <Crown aria-hidden="true" className="h-4 w-4 self-center text-[#FB651E]" />
          <span className="font-medium text-foreground">#1 in {place}</span>
          <span className="text-sm text-muted-foreground">at {formatDollars(amountCents)}</span>
        </p>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onTake}
      aria-label={`Set the amount to ${formatDollars(needed)} — takes first place in ${place}`}
      className={cn(
        'group flex w-full items-start justify-start gap-3 px-3 py-3.5 text-left transition-colors',
        'hover:bg-[#FB651E]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
      )}
    >
      <span className="w-16 shrink-0 pt-2 text-xs uppercase tracking-wider text-muted-foreground">
        {scope}
      </span>

      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
        {/* The largest thing on the screen, and the reason it exists. */}
        <span className="text-[1.75rem] font-semibold leading-none tracking-tight text-[#FB651E]">
          {formatDollars(needed)}
        </span>
        <span className="text-sm leading-snug text-muted-foreground">
          takes #1 in <span className="text-foreground">{place}</span>
        </span>
      </span>

      {/* A row that fills in a number has to say so. Quiet, but never hidden
          behind a hover — an affordance nobody can see is not an affordance. */}
      <span
        aria-hidden="true"
        className="flex shrink-0 items-center gap-1 self-center whitespace-nowrap text-xs text-muted-foreground group-hover:text-foreground"
      >
        Use
        <ArrowRight className="h-3 w-3" />
      </span>
    </button>
  )
}
