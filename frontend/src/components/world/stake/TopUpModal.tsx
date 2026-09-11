/**
 * "Top up Stripe" — adding stake to a plot you already own, in one card.
 *
 * WHAT THIS REPLACES. The top-up used to render the whole claim wizard inside a
 * dialog with `initial.plotId` set, which meant loading four gated steps and a
 * seven-field identity form so that an OWNER — somebody who already has a name,
 * a URL, a tagline and a logo on the board — could type one number. The wizard
 * is deleted. This is the number.
 *
 * The plot supplies everything else. Its own coordinates go on the request so
 * the payload shape stays uniform with a fresh claim; the server ignores the
 * text fields for a top-up and credits the existing plot (`world.py`, the
 * `plot_id is not None` branch of `_fulfil_claim`).
 *
 * NO AUTH STEP. This card is only ever rendered for `plot.is_mine === true`,
 * which the API only ever returns for a request that carried a session. There
 * is nobody to log in.
 *
 * HONESTY, identical to <StakeModal>: `cents_to_beat === null` renders the word
 * "unknown" (<Money> enforces it), the $5 floor is announced with role="alert",
 * the pay button is type="button" so a stray Enter can never charge anybody,
 * and the no-prize line is on the card.
 */

import { useId, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { AxiosError } from 'axios'
import { ArrowRight, Crown, Loader2 } from 'lucide-react'

import { cn } from '../../../lib/utils'
import worldApi, { type WorldCheckoutRequest, type WorldPlot } from '../../../lib/worldApi'
import { MIN_STAKE_CENTS, formatDollars } from '../constants'
import { InfoTip, Money, WorldButton, worldButtonClass } from '../ui'
import { INPUT, SECTION_LABEL, TABULAR } from '../styles'
import {
  MAX_STAKE_CENTS,
  dollarsString,
  parseDollarsToCents,
  paymentToTakeFirst,
  validateAmountCents,
} from './amount'

export interface TopUpModalProps {
  plot: WorldPlot
  /**
   * What it costs to take #1 in this plot's country, in cents — the board's own
   * `cents_to_beat`. `null` means genuinely unknown, and this card says so.
   */
  centsToBeat: number | null
  onClose: () => void
}

function messageFrom(err: unknown): string {
  const e = err as AxiosError<{ detail?: string }>
  const detail = e?.response?.data?.detail
  if (typeof detail === 'string' && detail.length > 0) return detail
  if (e?.response?.status) return `Checkout could not start (${e.response.status}).`
  return 'Checkout could not start.'
}

export function TopUpModal({ plot, centsToBeat, onClose }: TopUpModalProps) {
  const baseId = useId()
  const amountId = `${baseId}-amount`
  const readoutId = `${baseId}-readout`
  const contentRef = useRef<HTMLDivElement>(null)

  // Rank is CUMULATIVE, so the number that takes #1 is net of what this plot
  // already holds — a plot on $20 against a $50 target needs $31, not $51.
  const suggested = paymentToTakeFirst(centsToBeat, plot.total_cents) ?? MIN_STAKE_CENTS
  const [amountCents, setAmountCents] = useState(suggested)
  const [draft, setDraft] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  const amountError = validateAmountCents(amountCents)
  const takesFirst = centsToBeat !== null && plot.total_cents + amountCents >= centsToBeat

  const commitAmount = (cents: number) =>
    setAmountCents(
      Number.isFinite(cents)
        ? Math.min(MAX_STAKE_CENTS, Math.max(0, Math.round(cents)))
        : MIN_STAKE_CENTS,
    )

  const submit = async () => {
    if (submitting) return
    setCheckoutError(null)
    if (amountError) {
      document.getElementById(amountId)?.focus()
      return
    }

    setSubmitting(true)
    const payload: WorldCheckoutRequest = {
      // The plot's own coordinates, so the request shape matches a fresh claim.
      // Text fields are ignored server-side on a top-up.
      lat: plot.lat,
      lng: plot.lng,
      name: '',
      url: '',
      tagline: '',
      plot_id: plot.id,
      amount_cents: amountCents,
    }

    try {
      const { data } = await worldApi.createCheckout(payload)
      if (!data?.checkout_url) throw new Error('Checkout started but returned no payment link.')
      // `submitting` is deliberately left set: the page is on its way to Stripe
      // and a button that springs back to life invites a second charge.
      window.location.assign(data.checkout_url)
    } catch (err) {
      setCheckoutError(
        err instanceof Error && !('response' in err) ? err.message : messageFrom(err),
      )
      setSubmitting(false)
    }
  }

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[1001] bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none" />
        {/* `world-root` on the Content: Radix portals this outside the page
            tree, so the tokens are re-established here. Bottom sheet on phones,
            centred card from sm — the split every World dialog uses. */}
        <DialogPrimitive.Content
          ref={contentRef}
          aria-describedby={undefined}
          // Focus the card itself rather than its first tabbable child: that
          // child is an InfoTip, which opens on focus, and it would unfurl over
          // the amount field the moment the card appeared.
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            contentRef.current?.focus()
          }}
          tabIndex={-1}
          className={
            'world-root fixed inset-x-0 bottom-0 z-[1001] flex max-h-[92svh] flex-col ' +
            'rounded-t-sm border-t border-border shadow-lg focus:outline-none ' +
            'pb-[env(safe-area-inset-bottom)] ' +
            'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:max-w-md ' +
            'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-sm sm:border sm:pb-0 ' +
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 ' +
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none'
          }
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
            <DialogPrimitive.Title className="font-mono text-xl font-bold leading-tight">
              Top up <span className="text-[#FB651E]">{plot.name}</span>
            </DialogPrimitive.Title>

            <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
              You hold <Money cents={plot.total_cents} className="text-foreground" /> in{' '}
              {plot.country_name}. Every dollar you add counts toward your rank there.{' '}
              <InfoTip label={`How rank works in ${plot.country_name}`}>
                Ranks are cumulative — the stake you already hold still counts, so you only pay the
                difference. No prize, no payout, no refund.
              </InfoTip>
            </p>

            <div className="mt-5 flex items-center gap-1.5">
              <span className={SECTION_LABEL}>Add to your stake</span>
            </div>

            <div
              className={cn(
                INPUT,
                'mt-1.5 flex items-center gap-2 py-0',
                'focus-within:border-[#FB651E]/60 focus-within:outline focus-within:outline-2',
                'focus-within:outline-offset-2 focus-within:outline-[#FB651E]',
                amountError && 'border-[#FB651E]',
              )}
            >
              <span className="world-num text-lg font-bold text-[#FB651E]" aria-hidden="true">
                $
              </span>
              <input
                id={amountId}
                inputMode="decimal"
                autoComplete="off"
                aria-label={`Amount to add to ${plot.name}, in dollars`}
                aria-describedby={readoutId}
                aria-invalid={amountError !== null}
                className="min-h-[2.5rem] w-full min-w-0 bg-transparent text-lg font-bold text-foreground outline-none"
                style={TABULAR}
                value={draft ?? dollarsString(amountCents)}
                onFocus={() => setDraft(dollarsString(amountCents))}
                onChange={(event) => {
                  setDraft(event.target.value)
                  const parsed = parseDollarsToCents(event.target.value)
                  // Raw while typing: clamping mid-keystroke fights anyone
                  // entering "100" one digit at a time.
                  if (parsed !== null) setAmountCents(parsed)
                }}
                onBlur={() => {
                  setDraft(null)
                  commitAmount(amountCents)
                }}
              />
            </div>

            {amountError ? (
              <p
                id={readoutId}
                role="alert"
                className="mt-2 font-mono text-xs font-semibold leading-snug text-[#FB651E]"
              >
                {amountError}
              </p>
            ) : (
              <p
                id={readoutId}
                role="status"
                aria-live="polite"
                className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm leading-snug"
              >
                {takesFirst ? (
                  <>
                    <Crown aria-hidden className="h-4 w-4 shrink-0 text-[#FB651E]" />
                    <span>
                      Takes you to{' '}
                      <Money
                        cents={plot.total_cents + amountCents}
                        className="text-[#FB651E]"
                      />{' '}
                      — #1 in {plot.country_name}
                    </span>
                  </>
                ) : centsToBeat === null ? (
                  // No leader figure came back, so there is no price for the top
                  // spot and this card does not invent one.
                  <span className="text-muted-foreground">
                    Takes you to{' '}
                    <Money cents={plot.total_cents + amountCents} className="text-foreground" /> ·
                    price to take #1: <Money cents={null} />
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Takes you to{' '}
                    <Money cents={plot.total_cents + amountCents} className="text-foreground" /> ·{' '}
                    <Money cents={centsToBeat} className="text-[#FB651E]" /> takes #1
                  </span>
                )}
              </p>
            )}

            {checkoutError ? (
              <p
                role="alert"
                className="mt-3 font-mono text-xs font-semibold leading-snug text-[#FB651E]"
              >
                {checkoutError}
              </p>
            ) : null}
          </div>

          {/* ---- the one button ------------------------------------------- */}
          <div className="shrink-0 border-t border-border bg-card px-5 py-4">
            {/* type="button", always: a stray Enter anywhere in this card must
                never charge anybody. */}
            <WorldButton
              variant="primary"
              size="lg"
              block
              disabled={submitting}
              onClick={() => void submit()}
            >
              {submitting ? (
                <>
                  <Loader2
                    aria-hidden
                    className="h-[1.125rem] w-[1.125rem] animate-spin motion-reduce:animate-none"
                  />
                  Opening checkout…
                </>
              ) : (
                <>
                  Continue to checkout
                  {amountError ? null : <> — {formatDollars(amountCents)}</>}
                  <ArrowRight aria-hidden className="h-[1.125rem] w-[1.125rem]" />
                </>
              )}
            </WorldButton>

            <p className="mt-2 text-center text-[11px] leading-tight text-muted-foreground">
              Charged once on Stripe. No prize, no payout, no refund.
            </p>

            <div className="mt-2 text-center">
              <DialogPrimitive.Close
                className={worldButtonClass('ghost', 'sm', { className: 'mx-auto' })}
              >
                Maybe later
              </DialogPrimitive.Close>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export default TopUpModal
