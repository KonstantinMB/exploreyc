// Step three of the claim wizard: how much.
//
// Ported from startupworld's claim/AmountPicker.tsx. The "$X takes #1 in
// <scope>" readout is the product — it is the first and largest thing on the
// screen, recomputes on every keystroke and slider pixel, and each figure is
// a button that fills the amount in. It never guesses: a scope whose leader
// stake is unknown renders <Money cents={null}>, which prints the word
// "unknown" — there is no code path in this file that invents a number.
//
// Every figure on this screen goes through <Money>, so money is the one thing
// set with tabular numerals (column alignment is the entire point of a
// numeral) while every label around it stays in the rounded sans.

import { useId, useState } from 'react'
import { Crown, Info } from 'lucide-react'

import { cn } from '../../../lib/utils'
import { MIN_STAKE_CENTS, formatDollars } from '../constants'
import { Money, WorldButton, WorldCard, WorldHeading } from '../ui'
import { HINT, INPUT, LABEL, PRESSABLE, SANS, TABULAR } from './styles'

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
    <div className="flex flex-col gap-6" style={SANS}>
      {/* ---- the readout — the reason this screen exists ------------------ */}
      <div className="flex flex-col gap-2.5">
        <WorldHeading level={3}>What it takes</WorldHeading>

        {/* One polite live region for the whole readout, so a drag that flips
            City from "takes it" to "does not" speaks once, not twice. */}
        {/* Rows are inset inside the card rather than full-bleed. Two reasons,
            both practical: `overflow-hidden` would clip the focus ring of the
            scope buttons, and an inset row can keep the 10px radius the shared
            focus ring draws — so focusing one never changes its shape. */}
        <WorldCard flat aria-live="polite" className="flex flex-col gap-1 p-1.5">
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
        </WorldCard>
      </div>

      {/* ---- the amount itself ------------------------------------------- */}
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={amountId} className={LABEL}>
            Your stake
          </label>

          {/* The real control is the <input> inside, so the ring has to come
              from :focus-within on this wrapper. It is the SAME ring as
              everywhere else — --w-focus-ring, not a second one invented
              here. */}
          <div
            className={cn(
              INPUT,
              'flex w-36 items-center gap-1 py-0 pr-3',
              'focus-within:border-[#FB651E]/40 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#FB651E]',
              amountError && 'border-[#FB651E]/40 bg-[#FB651E]/[0.05]',
            )}
          >
            {/* Real text rather than a pseudo-element, so a screen reader
                still hears the unit. */}
            <span
              className="world-num text-base font-bold text-[#FB651E]"
              aria-hidden="true"
            >
              $
            </span>
            <input
              id={amountId}
              inputMode="decimal"
              autoComplete="off"
              className="w-full min-w-0 bg-transparent text-right text-base font-semibold text-foreground outline-none"
              style={TABULAR}
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
          <div className="relative py-1">
            {/* Native range input, left NATIVE on purpose: `appearance: none`
                would need a ::-webkit-slider-thumb rule to draw a thumb at
                all, and the thumb rules live in world.css, which this file
                does not own. `accent-color` tints the real control instead —
                keyboard support (arrows, Home/End), a visible thumb in every
                engine, and one accent. */}
            <input
              type="range"
              min={MIN_STAKE_CENTS / 100}
              max={Math.round(maxCents / 100)}
              step={1}
              value={sliderDollars}
              aria-label="Amount to stake"
              aria-valuetext={formatDollars(sliderDollars * 100)}
              onChange={(event) => onChange(Number(event.target.value) * 100)}
              className="world-focus relative z-10 w-full cursor-pointer"
              style={{ accentColor: '#FB651E' }}
            />

            {/* Where the two ranks sit on the track. Drawn OVER the native
                control (which is opaque, so an underlay would be invisible)
                but with pointer-events off, so it is never a hit target. Only
                drawn for a scope whose leader is known. */}
            {marks.map((mark) => (
              <span
                key={mark.key}
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 top-0 z-20 w-0.5 bg-[#FB651E] opacity-40"
                style={{ left: `${position(mark.cents)}%` }}
              />
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <Money cents={MIN_STAKE_CENTS} />
            <Money cents={maxCents} />
          </div>
        </div>

        <div className="flex gap-2">
          {PRESETS_CENTS.map((cents) => {
            const active = valueCents === cents
            return (
              <WorldButton
                key={cents}
                variant={active ? 'primary' : 'secondary'}
                size="sm"
                aria-pressed={active}
                onClick={() => commit(cents)}
                className="flex-1"
              >
                <Money cents={cents} />
              </WorldButton>
            )
          })}
        </div>

        {amountError ? (
          <p id={amountHintId} role="alert" className="text-xs font-semibold leading-snug text-[#FB651E]">
            {amountError}
          </p>
        ) : (
          <p id={amountHintId} className={HINT}>
            {existingStakeCents > 0 ? (
              <>
                You already hold <Money cents={existingStakeCents} /> here — this takes you to{' '}
                <Money cents={existingStakeCents + valueCents} />. Non-refundable.
              </>
            ) : (
              <>
                From <Money cents={MIN_STAKE_CENTS} />. Charged once, non-refundable.
              </>
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

const SCOPE_LABEL =
  'w-[4.5rem] shrink-0 text-xs font-bold text-muted-foreground'

function ScopeRow({ scope, place, needed, amountCents, onTake }: ScopeRowProps) {
  // No place, or a place whose current leader we do not know. Either way this
  // row has no honest number to print — inventing one is the single failure
  // mode that would make a buyer feel cheated after they had already paid.
  // <Money cents={null}> is what prints the word "unknown".
  if (!place || needed === null) {
    return (
      <div className="flex items-start gap-3 rounded-sm px-3.5 py-3.5">
        <span className={cn(SCOPE_LABEL, 'pt-0.5')}>{scope}</span>
        <p className="flex min-w-0 flex-1 items-start gap-2 text-sm leading-snug text-muted-foreground">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {place ? (
            <span>
              The leader stake in {place} is <Money cents={null} />. Your rank there is settled at
              checkout.
            </span>
          ) : (
            <span>No {scope.toLowerCase()} in range for this point.</span>
          )}
        </p>
      </div>
    )
  }

  const takesIt = amountCents >= needed

  if (takesIt) {
    return (
      <div className="flex items-start gap-3 rounded-sm bg-[#FB651E]/[0.05] px-3.5 py-3.5 shadow-[inset_3px_0_0_#FB651E]">
        <span className={cn(SCOPE_LABEL, 'pt-1')}>{scope}</span>
        <p className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1 leading-snug">
          <Crown aria-hidden="true" className="h-[1.125rem] w-[1.125rem] self-center text-[#FB651E]" />
          <span className="text-base font-bold text-foreground">#1 in {place}</span>
          <span className="text-sm text-muted-foreground">
            at <Money cents={amountCents} />
          </span>
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
        PRESSABLE,
        'group flex w-full items-center gap-3 rounded-sm px-3.5 py-3.5 text-left',
        'hover:bg-[#FB651E]/[0.05]',
      )}
    >
      <span className={SCOPE_LABEL}>{scope}</span>

      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
        {/* The largest thing on the screen, and the reason it exists. */}
        <Money
          cents={needed}
          className="text-3xl font-bold leading-none tracking-tight text-[#FB651E]"
        />
        <span className="text-sm leading-snug text-muted-foreground">
          takes #1 in <span className="font-semibold text-foreground">{place}</span>
        </span>
      </span>

      {/* A row that fills in a number has to say so. Quiet, but never hidden
          behind a hover — an affordance nobody can see is not an affordance. */}
      <span
        aria-hidden="true"
        className={cn(
          'flex shrink-0 items-center rounded-sm border border-border px-3 py-1.5',
          'font-mono text-xs font-semibold text-muted-foreground',
          'transition-colors duration-150 motion-reduce:transition-none',
          'group-hover:border-[#FB651E]/40 group-hover:text-[#FB651E]',
        )}
      >
        Use this
      </span>
    </button>
  )
}
