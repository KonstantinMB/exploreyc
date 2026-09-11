/**
 * "Stake on Kenya" — the entire purchase, in one card.
 *
 * WHAT THIS REPLACES. The claim wizard asked for a coordinate, a name, a URL, a
 * tagline, a founder name, a founder title, a founder link, an account and an
 * amount, across four gated steps, before anybody could pay $5. The owner's
 * verdict on that was blunt, and the reference he handed over makes the
 * alternative obvious: pick a country, paste one link, pick a number, pay.
 * Everything else is something the owner can fill in on the plot page
 * afterwards, when they already own something.
 *
 * SO THE MODAL COLLECTS EXACTLY TWO THINGS:
 *
 *   1. one line — a product URL or a social profile (see ./identity.ts, which
 *      turns it into the `name` and `url` the checkout endpoint wants), and
 *   2. an amount, defaulted to the number that takes #1 in this country.
 *
 * The coordinate is derived (see ./derivePoint.ts) and confirmed against the
 * same server geography checkout will use, so a country-level purchase can
 * never land in the sea. NOBODY IS ASKED FOR A COORDINATE any more, before
 * payment or after it: the wizard that used to ask — and the pulsing orange
 * target ring that came with it — is deleted. The optional fields it collected
 * (one line, link, logo, founder name, title, founder link) are edited on the
 * plot's own page once the buyer owns something.
 *
 * THE ONE THING THIS FLOW CANNOT SKIP is the account: `POST /api/world/checkout`
 * is authed, because a plot belongs to somebody who has to be able to come back
 * and edit it. So a logged-out buyer who presses the button gets the login step
 * INSIDE this card rather than a redirect that loses the country, the link and
 * the amount they had already chosen.
 *
 * HONESTY, unchanged from every other World surface: `cents_to_beat === null`
 * renders the word "unknown" (<Money> enforces it), the $5 floor is announced
 * with role="alert", the pay button is type="button" so a stray Enter can never
 * charge anybody, and the no-prize line is on the card.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { ArrowRight, Crown, Loader2, MapPin } from 'lucide-react'

import { cn } from '../../../lib/utils'
import worldApi, { type WorldCheckoutRequest } from '../../../lib/worldApi'
import { useDevAuth } from '../../../contexts/DevAuthContext'
import { MIN_STAKE_CENTS, formatDollars } from '../constants'
import { InfoTip, Money, WorldButton, worldButtonClass } from '../ui'
import { isoFlag } from '../boards/format'
import { INPUT, SECTION_LABEL, TABULAR } from '../styles'
import {
  MAX_STAKE_CENTS,
  dollarsString,
  parseDollarsToCents,
  paymentToTakeFirst,
  validateAmountCents,
} from './amount'
import { AuthStep } from './AuthStep'
import { nameFor } from '../country/names'
import { derivePoint } from './derivePoint'
import { KIND_LABEL, PLACEHOLDER, parseIdentity, type StakeKind } from './identity'

export interface StakeModalProps {
  /** ISO-3166 alpha-2 of the country being staked on. */
  iso: string
  /** Display name, as the API spelled it. */
  countryName: string
  /**
   * What it costs to take #1 here, in cents — the board's own `cents_to_beat`.
   * `null` means genuinely unknown, and this card says so rather than guessing.
   */
  centsToBeat: number | null
  onClose: () => void
}

function messageFrom(err: unknown): string {
  const e = err as AxiosError<{ detail?: string }>
  const detail = e?.response?.data?.detail
  if (detail === 'ocean') {
    return 'That spot came back as open water. Try another country.'
  }
  if (typeof detail === 'string' && detail.length > 0) return detail
  if (e?.response?.status) return `Checkout could not start (${e.response.status}).`
  return 'Checkout could not start.'
}

export function StakeModal({ iso, countryName, centsToBeat, onClose }: StakeModalProps) {
  const baseId = useId()
  const linkId = `${baseId}-link`
  const amountId = `${baseId}-amount`
  const readoutId = `${baseId}-readout`
  const contentRef = useRef<HTMLDivElement>(null)
  const { user } = useDevAuth()

  const [kind, setKind] = useState<StakeKind>('product')
  const [link, setLink] = useState('')
  const [showLinkError, setShowLinkError] = useState(false)
  const [step, setStep] = useState<'form' | 'auth'>('form')
  const [submitting, setSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  // ---- the amount ---------------------------------------------------------
  // Defaulted to the payment that takes #1 here, floored at $5. That is the
  // number the reference pre-fills, and it is the number that makes the offer
  // legible: the buyer sees what winning costs before they see a field.

  const suggested = paymentToTakeFirst(centsToBeat, 0) ?? MIN_STAKE_CENTS
  const [amountCents, setAmountCents] = useState(suggested)
  const [draft, setDraft] = useState<string | null>(null)
  const touched = useRef(false)

  // `cents_to_beat` often lands a moment after this card opens (the board query
  // is still in flight). Adopt it — but only while the buyer has not typed, or
  // we would overwrite an amount they chose on purpose.
  useEffect(() => {
    if (touched.current) return
    setAmountCents(suggested)
  }, [suggested])

  // ---- where this plot goes -----------------------------------------------
  // The country's own record carries the centroid and the plot count. The
  // count is the seed: consecutive buyers in one country get different offsets,
  // so two stakes in Kenya are two beads rather than one.

  const countryQuery = useQuery({
    queryKey: ['world', 'country', iso],
    queryFn: () => worldApi.getCountry(iso).then((r) => r.data),
    enabled: iso.length === 2,
    staleTime: 30_000,
  })
  const country = countryQuery.data ?? null
  const seed = `${iso}:${country?.plots_count ?? 0}`

  const pointQuery = useQuery({
    queryKey: ['world', 'stake-point', iso, seed],
    enabled: countryQuery.isSuccess,
    staleTime: Infinity,
    retry: false,
    queryFn: () =>
      derivePoint(
        iso,
        seed,
        country?.centroid_lat != null && country?.centroid_lng != null
          ? { lat: country.centroid_lat, lng: country.centroid_lng }
          : null,
      ),
  })
  const point = pointQuery.data ?? null

  // ---- validity ------------------------------------------------------------

  const identity = useMemo(() => parseIdentity(kind, link), [kind, link])
  const amountError = validateAmountCents(amountCents)
  const takesFirst = centsToBeat !== null && amountCents >= centsToBeat

  // Logging in removes the auth step from under the buyer — put them back on
  // the form with everything they typed still in it.
  useEffect(() => {
    if (user && step === 'auth') setStep('form')
  }, [user, step])

  const commitAmount = (cents: number) => {
    touched.current = true
    setAmountCents(
      Number.isFinite(cents)
        ? Math.min(MAX_STAKE_CENTS, Math.max(0, Math.round(cents)))
        : MIN_STAKE_CENTS,
    )
  }

  // ---- checkout ------------------------------------------------------------

  const submit = async () => {
    if (submitting) return
    setCheckoutError(null)

    if (!identity.ok) {
      setShowLinkError(true)
      document.getElementById(linkId)?.focus()
      return
    }
    if (amountError) {
      document.getElementById(amountId)?.focus()
      return
    }
    if (!user) {
      setStep('auth')
      return
    }

    // The coordinate is usually settled long before this — the query starts
    // when the card opens and the buyer has a link and an amount to type. When
    // it is not, this waits for it rather than disabling the one button on the
    // card while a background request finishes.
    setSubmitting(true)
    let resolved = point
    if (!resolved) {
      const { data: refetched } = await pointQuery.refetch()
      resolved = refetched ?? null
    }
    if (!resolved || !resolved.confirmed) {
      setCheckoutError(
        `We could not place a plot inside ${countryName} automatically. Try again in a moment, or stake on another country.`,
      )
      setSubmitting(false)
      return
    }

    const payload: WorldCheckoutRequest = {
      lat: resolved.lat,
      lng: resolved.lng,
      name: identity.value.name,
      url: identity.value.url,
      // The plot's own words are collected after payment, on its page — this
      // card asks for one line and means it.
      tagline: '',
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

  const flag = isoFlag(iso)
  const name = countryName || nameFor(iso)

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
          /*
           * WITHOUT THIS, OPENING THE CARD COVERS ITS OWN FORM.
           *
           * Radix autofocuses the first tabbable child. The first tabbable
           * child here is the InfoTip beside the explainer sentence, and an
           * InfoTip opens on focus (the ARIA tooltip pattern says it must) —
           * so the bubble unfurled over the Product URL toggle and the input
           * the moment the modal appeared, every time.
           *
           * Focus the card itself instead: the title is announced, nothing is
           * obscured, no mobile keyboard is summoned by autofocusing a text
           * field inside a bottom sheet, and the first Tab still lands on the
           * first control.
           */
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
              Stake on{' '}
              <span aria-hidden className="mr-0.5">
                {flag}
              </span>
              <span className="text-[#FB651E]">{name}</span>
            </DialogPrimitive.Title>

            {step === 'auth' ? (
              <>
                {/* One step, and only for people who do not have an account
                    yet. Everything typed above is still here when they come
                    back — this card never unmounts. */}
                <div className="mt-4">
                  <AuthStep />
                </div>
                <WorldButton
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={() => setStep('form')}
                >
                  Back to your stake
                </WorldButton>
              </>
            ) : (
              <>
                {/* ONE explainer sentence. Everything else that used to be a
                    paragraph here is an InfoTip now. */}
                {/* Normal text flow, NOT a flex row: as a flex item the whole
                    sentence is one box, so on any width where it wrapped the
                    icon was pushed onto a line of its own and read as an
                    orphan. Inline, it trails the full stop the way a footnote
                    mark does. */}
                <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
                  Your rank in {name} is your{' '}
                  <strong className="text-foreground">total stake</strong> there.{' '}
                  <InfoTip label={`How rank works in ${name}`}>
                    Ranks are cumulative. Top up later and you only pay the difference — the stake
                    you already hold still counts. No prize, no payout, no refund.
                  </InfoTip>
                </p>

                {/* ---- what goes on the plot ------------------------------ */}
                <div
                  role="group"
                  aria-label="What to put on the plot"
                  className="mt-5 grid grid-cols-2 gap-1.5 rounded-sm border border-border p-1"
                >
                  {(['product', 'social'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={kind === option}
                      onClick={() => {
                        setKind(option)
                        setShowLinkError(false)
                      }}
                      className={cn(
                        'world-focus min-h-[2.25rem] cursor-pointer rounded-sm px-2 py-1.5',
                        'font-mono text-xs font-semibold transition-colors duration-150',
                        'motion-reduce:transition-none',
                        kind === option
                          ? 'bg-[#FB651E]/[0.12] text-[#FB651E]'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {KIND_LABEL[option]}
                    </button>
                  ))}
                </div>

                <label htmlFor={linkId} className="sr-only">
                  {KIND_LABEL[kind]}
                </label>
                <input
                  id={linkId}
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={link}
                  onChange={(event) => {
                    setLink(event.target.value)
                    if (showLinkError) setShowLinkError(false)
                  }}
                  onBlur={() => link.trim() !== '' && setShowLinkError(true)}
                  // The placeholder IS the instruction — a real example of the
                  // thing we want, rather than a sentence describing one.
                  placeholder={PLACEHOLDER[kind]}
                  aria-invalid={showLinkError && !identity.ok}
                  aria-errormessage={showLinkError && !identity.ok ? `${linkId}-error` : undefined}
                  className={cn(INPUT, 'mt-2', showLinkError && !identity.ok && 'border-[#FB651E]')}
                />
                {showLinkError && !identity.ok ? (
                  <p
                    id={`${linkId}-error`}
                    role="alert"
                    className="mt-1.5 font-mono text-xs font-semibold leading-snug text-[#FB651E]"
                  >
                    {identity.error}
                  </p>
                ) : identity.ok ? (
                  // What the board will actually say, before they buy it.
                  <p className="mt-1.5 font-mono text-xs leading-snug text-muted-foreground">
                    On the board as{' '}
                    <strong className="text-foreground">{identity.value.name}</strong>
                  </p>
                ) : null}

                {/* ---- the amount ----------------------------------------- */}
                <div className="mt-5 flex items-center gap-1.5">
                  <span className={SECTION_LABEL}>Your stake</span>
                  <InfoTip label="What the stake buys" align="start">
                    A one-off payment. It sets your rank in {name} and puts your logo on the globe
                    — it is an ad buy, not a bet. No prize, no payout, no refund.
                  </InfoTip>
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
                    aria-label={`Your stake in ${name}, in dollars`}
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
                      if (parsed !== null) {
                        touched.current = true
                        setAmountCents(parsed)
                      }
                    }}
                    onBlur={() => {
                      setDraft(null)
                      commitAmount(amountCents)
                    }}
                  />
                </div>

                {/* ---- the live readout — the reason the field is here ----- */}
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
                          <Money cents={amountCents} className="text-[#FB651E]" /> takes #1 in {name}
                        </span>
                      </>
                    ) : centsToBeat === null ? (
                      // No leader figure came back, so there is no price for the
                      // top spot and this card does not invent one. <Money
                      // cents={null}> is what prints the word.
                      <span className="text-muted-foreground">
                        <Money cents={amountCents} className="text-foreground" /> puts you on the
                        board in {name} · price to take #1: <Money cents={null} />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        <Money cents={amountCents} className="text-foreground" /> puts you on the
                        board in {name} ·{' '}
                        <Money cents={centsToBeat} className="text-[#FB651E]" /> takes #1
                      </span>
                    )}
                  </p>
                )}

                {/* What was chosen on the buyer's behalf, said out loud. A
                    derived coordinate that nobody mentions is a surprise on the
                    plot page. There is no "pick it yourself" escape here any
                    more, because there is no coordinate picker any more — the
                    country IS the unit. */}
                <p className="mt-3 flex items-start gap-1.5 text-xs leading-snug text-muted-foreground">
                  <MapPin aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {pointQuery.isPending ? (
                      <>Finding you a spot in {name}…</>
                    ) : point?.confirmed ? (
                      <>We will plant it inside {name} for you.</>
                    ) : (
                      <>We could not place a spot in {name} automatically yet.</>
                    )}
                  </span>
                </p>

                {checkoutError ? (
                  <p
                    role="alert"
                    className="mt-3 font-mono text-xs font-semibold leading-snug text-[#FB651E]"
                  >
                    {checkoutError}
                  </p>
                ) : null}
              </>
            )}
          </div>

          {/* ---- the one button ------------------------------------------- */}
          {step === 'form' ? (
            <div className="shrink-0 border-t border-border bg-card px-5 py-4">
              {/* type="button", always: a stray Enter anywhere in this card
                  must never charge anybody. */}
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
                    {user ? 'Continue to checkout' : 'Continue'}
                    {amountError ? null : <> — {formatDollars(amountCents)}</>}
                    <ArrowRight aria-hidden className="h-[1.125rem] w-[1.125rem]" />
                  </>
                )}
              </WorldButton>

              {/* ONE line of fine print. The no-prize sentence is byte-for-byte
                  the one every other World surface carries. */}
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
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export default StakeModal
