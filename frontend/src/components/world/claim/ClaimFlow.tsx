// ExploreYC World — the claim wizard, ported from startupworld's
// claim/ClaimFlow.tsx into the ExploreYC stack (React Router SPA, TanStack
// Query, DevAuth accounts, /api/world/* contract).
//
// All step state lives here, in one place, and it is never cleared on
// failure. A buyer who typed their name, their line and their link and then
// hits a 500 from checkout must land back on exactly what they had, with the
// error explained — losing that form is how a paying customer becomes a
// bounced one.
//
// Steps are gated but state is not: going back to fix a typo cannot discard
// the amount already chosen. Tabs are reachable as soon as everything BEFORE
// them is satisfied, in either direction — "no skipping something
// unfinished", never "no going forward".
//
// The page owns the surface (bottom sheet on phones, card on desktop) and the
// globe, but the PICKING UI lives in here, on step 1 — see PlaceSummary. A
// globe click arrives as `initial: {lat, lng}`; a city chosen in step 1's
// search goes back out through `onChoosePoint` and returns the same way, so
// both gestures end up in one place. This component renders inline and never
// navigates on its own — the only redirect is `window.location.assign` to
// Stripe.

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'

import { cn } from '../../../lib/utils'
import { apiClient } from '../../../lib/api'
import worldApi, { type WhereResponse, type WorldCheckoutRequest } from '../../../lib/worldApi'
import { MIN_STAKE_CENTS } from '../constants'
import { useDevAuth } from '../../../contexts/DevAuthContext'
import { Money, WorldButton, WorldHeading } from '../ui'
import { HINT, PRESSABLE, SANS } from './styles'

import { AmountPicker, validateAmountCents, type AmountContext } from './AmountPicker'
import { AuthStep } from './AuthStep'
import { ClaimSummary } from './ClaimSummary'
import { EMPTY_IDENTITY, IdentityForm, validateIdentity, type IdentityValue } from './IdentityForm'
import { PlaceSummary, placeLabel, type PlaceState } from './PlaceSummary'
import { stashPendingLogo } from './logoStash'

export type ClaimInitial =
  /** The buyer clicked the globe; the page hands the coordinate over. */
  | { lat: number; lng: number }
  /** Claiming a seed pin — the company's coordinate and identity prefill. */
  | { companyId: number }
  /** Topping up an existing plot: amount only, text fields ignored. */
  | { plotId: number }

export interface ClaimFlowProps {
  initial?: ClaimInitial
  /**
   * A coordinate was chosen inside the flow — in practice, a city picked from
   * the search on step 1. The page owns the globe and the authoritative
   * coordinate, so it hears about it here, flies the camera, and re-renders
   * this flow with `initial: {lat, lng}`. That keeps ONE source of truth for
   * "where the plot goes" no matter which of the two gestures produced it.
   *
   * Omitted by callers with a fixed coordinate (a top-up, a seed claim).
   */
  onChoosePoint?: (point: { lat: number; lng: number }) => void
}

type StepId = 'place' | 'identity' | 'auth' | 'amount'

const STEP_LABELS: Record<StepId, string> = {
  place: 'Place',
  identity: 'You',
  auth: 'Account',
  amount: 'Amount',
}

const DEFAULT_AMOUNT_CENTS = 2500

function isOceanError(err: unknown): boolean {
  const e = err as AxiosError<{ detail?: string }>
  return e?.response?.status === 400 && e.response.data?.detail === 'ocean'
}

function messageFrom(err: unknown): string {
  if (isOceanError(err)) {
    return 'That point is open water — plots only go on land. Pick a point inside a country.'
  }
  const e = err as AxiosError<{ detail?: string }>
  const detail = e?.response?.data?.detail
  if (typeof detail === 'string' && detail.length > 0) return detail
  if (e?.response?.status) return `Checkout could not start (${e.response.status}).`
  return 'Checkout could not start.'
}

/** Company websites are stored bare or http; our link rule is https-only. */
function httpsify(url: string | undefined | null): string {
  const raw = (url ?? '').trim()
  if (raw === '') return ''
  if (raw.startsWith('https://')) return raw
  if (raw.startsWith('http://')) return `https://${raw.slice('http://'.length)}`
  if (/^[\w.-]+\.[a-z]{2,}/i.test(raw)) return `https://${raw}`
  return ''
}

export default function ClaimFlow({ initial, onChoosePoint }: ClaimFlowProps) {
  const reduced = useReducedMotion()
  const { user, loading: authLoading } = useDevAuth()

  const initialCoords = initial && 'lat' in initial ? { lat: initial.lat, lng: initial.lng } : null
  const companyId = initial && 'companyId' in initial ? initial.companyId : null
  const plotId = initial && 'plotId' in initial ? String(initial.plotId) : null
  const topUp = plotId !== null

  // ---- source data ---------------------------------------------------------

  const companyQuery = useQuery({
    queryKey: ['world-claim-company', companyId],
    enabled: companyId !== null,
    staleTime: 5 * 60_000,
    queryFn: () => apiClient.getCompany(companyId as number).then((r) => r.data),
  })

  const plotQuery = useQuery({
    queryKey: ['world-claim-plot', plotId],
    enabled: topUp,
    queryFn: () => worldApi.getPlot(plotId as string).then((r) => r.data),
  })
  const plot = plotQuery.data ?? null

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(initialCoords)

  // The page confirms picked coordinates asynchronously (server geography)
  // and re-renders this flow with an updated `initial` — adopt the new
  // coordinate without discarding any other wizard state (identity, amount).
  const initialLat = initialCoords?.lat
  const initialLng = initialCoords?.lng
  useEffect(() => {
    if (initialLat == null || initialLng == null) return
    setCoords((prev) =>
      prev && prev.lat === initialLat && prev.lng === initialLng
        ? prev
        : { lat: initialLat, lng: initialLng },
    )
  }, [initialLat, initialLng])

  // ---- wizard state --------------------------------------------------------

  const [identity, setIdentity] = useState<IdentityValue>(EMPTY_IDENTITY)
  const [amountCents, setAmountCents] = useState(DEFAULT_AMOUNT_CENTS)
  const [showIdentityErrors, setShowIdentityErrors] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  // Seed claim: adopt the company's coordinate and prefill identity, once.
  // Re-running on every render would stomp on a buyer who edited the prefill.
  const prefilled = useRef(false)
  useEffect(() => {
    const company = companyQuery.data
    if (!company || prefilled.current) return
    prefilled.current = true
    setIdentity((prev) => ({
      ...prev,
      name: prev.name || (company.name ?? '').slice(0, 40),
      url: prev.url || httpsify(company.website),
      tagline: prev.tagline || (company.one_liner ?? '').slice(0, 140),
    }))
    if (typeof company.latitude === 'number' && typeof company.longitude === 'number') {
      setCoords((prev) => prev ?? { lat: company.latitude as number, lng: company.longitude as number })
    }
  }, [companyQuery.data])

  // ---- geography (server-side; client guesses are never trusted) -----------

  const whereQuery = useQuery({
    queryKey: ['world-where', coords?.lat, coords?.lng],
    enabled: coords !== null && !topUp,
    retry: (failureCount, err) => !isOceanError(err) && failureCount < 2,
    queryFn: () => worldApi.getWhere((coords as { lat: number }).lat, (coords as { lng: number }).lng).then((r) => r.data),
  })

  const place: PlaceState = useMemo(() => {
    if (topUp && plot) {
      const where: WhereResponse = {
        country_iso: plot.country_iso,
        country_name: plot.country_name,
        city_id: plot.city_id,
        city_name: plot.city_name,
      }
      return { kind: 'resolved', lat: plot.lat, lng: plot.lng, where }
    }
    if (!coords) return { kind: 'none' }
    if (whereQuery.data) return { kind: 'resolved', ...coords, where: whereQuery.data }
    if (whereQuery.isError) {
      return { kind: isOceanError(whereQuery.error) ? 'ocean' : 'error', ...coords }
    }
    return { kind: 'locating', ...coords }
  }, [topUp, plot, coords, whereQuery.data, whereQuery.isError, whereQuery.error])

  const resolvedWhere = place.kind === 'resolved' ? place.where : null

  // ---- leader stakes ("$X takes #1") ---------------------------------------
  // cents_to_beat comes from the board endpoint; null means unknown, and the
  // AmountPicker says "unknown" rather than guessing — never invent a price.

  const iso = resolvedWhere?.country_iso ?? null
  const cityId = resolvedWhere?.city_id ?? null

  const countryBoard = useQuery({
    queryKey: ['world-board', 'richest', `country:${iso}`],
    enabled: iso !== null,
    staleTime: 30_000,
    queryFn: () => worldApi.getBoard('richest', `country:${iso}`).then((r) => r.data),
  })
  const cityBoard = useQuery({
    queryKey: ['world-board', 'richest', `city:${cityId}`],
    enabled: cityId !== null,
    staleTime: 30_000,
    queryFn: () => worldApi.getBoard('richest', `city:${cityId}`).then((r) => r.data),
  })

  const amountContext: AmountContext = {
    cityName: resolvedWhere?.city_name ?? null,
    cityCentsToBeat: cityBoard.data?.cents_to_beat ?? null,
    countryName: resolvedWhere?.country_name ?? null,
    countryCentsToBeat: countryBoard.data?.cents_to_beat ?? null,
  }

  // ---- steps ---------------------------------------------------------------

  const steps: StepId[] = useMemo(() => {
    const base: StepId[] = topUp ? [] : ['place', 'identity']
    if (!user) base.push('auth')
    base.push('amount')
    return base
  }, [topUp, user])

  const [stepId, setStepId] = useState<StepId>(steps[0])

  // Logging in removes the auth step from under the buyer's feet — walk them
  // forward to the amount rather than leaving them on a step that is gone.
  useEffect(() => {
    if (!steps.includes(stepId)) setStepId('amount')
  }, [steps, stepId])

  const identityErrors = validateIdentity(identity)
  const identityValid = Object.keys(identityErrors).length === 0
  const amountValid = validateAmountCents(amountCents) === null
  const placeOk = place.kind === 'resolved' || place.kind === 'error'

  const canLeave: Record<StepId, boolean> = {
    place: placeOk,
    identity: identityValid,
    auth: !!user,
    amount: amountValid,
  }

  const stepIndex = Math.max(0, steps.indexOf(stepId))
  /** Reachable once every step before it could be left, whichever direction
   *  you are travelling in. */
  const reachable = steps.map((_, index) => steps.slice(0, index).every((id) => canLeave[id]))

  // Move keyboard/screen-reader focus to the step heading on change, so the
  // full keyboard path reads: tab list → step content → footer, every step.
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)
  const mounted = useRef(false)
  useEffect(() => {
    if (mounted.current) stepHeadingRef.current?.focus()
    mounted.current = true
  }, [stepId])

  const goNext = () => {
    if (stepId === 'identity' && !identityValid) {
      setShowIdentityErrors(true)
      return
    }
    if (!canLeave[stepId]) return
    const next = steps[Math.min(stepIndex + 1, steps.length - 1)]
    setStepId(next)
  }

  const goBack = () => setStepId(steps[Math.max(stepIndex - 1, 0)])

  // ---- checkout ------------------------------------------------------------

  const submit = async () => {
    if (!amountValid || !user) return
    if (topUp) {
      if (!plot) return
    } else {
      if (place.kind !== 'resolved' && place.kind !== 'error') return
      if (!identityValid) {
        setShowIdentityErrors(true)
        setStepId('identity')
        return
      }
    }

    setSubmitting(true)
    setCheckoutError(null)

    const payload: WorldCheckoutRequest = topUp
      ? {
          // Text fields are ignored server-side on a top-up; coordinates come
          // from the plot so the request shape stays uniform.
          lat: (plot as NonNullable<typeof plot>).lat,
          lng: (plot as NonNullable<typeof plot>).lng,
          name: '',
          url: '',
          tagline: '',
          plot_id: plotId as string,
          amount_cents: amountCents,
        }
      : {
          lat: (place as { lat: number }).lat,
          lng: (place as { lng: number }).lng,
          name: identity.name.trim(),
          url: identity.url.trim(),
          tagline: identity.tagline.trim(),
          ...(identity.founderName.trim() ? { founder_name: identity.founderName.trim() } : {}),
          ...(identity.founderTitle.trim() ? { founder_title: identity.founderTitle.trim() } : {}),
          ...(identity.founderLink.trim() ? { founder_link: identity.founderLink.trim() } : {}),
          ...(companyId !== null ? { company_id: companyId } : {}),
          amount_cents: amountCents,
        }

    try {
      const { data } = await worldApi.createCheckout(payload)
      if (!data?.checkout_url) throw new Error('Checkout started but returned no payment link.')

      // The checkout API carries no logo — stash it for the post-checkout
      // landing to upload once the plot exists (see logoStash.ts).
      if (!topUp && identity.logoDataUrl) stashPendingLogo(identity.logoDataUrl)

      // Deliberately leaves `submitting` set — the page is on its way out and
      // a button that springs back to life invites a second charge attempt.
      window.location.assign(data.checkout_url)
    } catch (err) {
      setCheckoutError(err instanceof Error && !('response' in err) ? err.message : messageFrom(err))
      setSubmitting(false)
    }
  }

  // ---- guards before the wizard renders ------------------------------------

  if (authLoading || (topUp && plotQuery.isPending) || (companyId !== null && companyQuery.isPending)) {
    return (
      <div className="flex items-center justify-center gap-2.5 p-10" role="status" style={SANS}>
        <Loader2
          aria-hidden="true"
          className="h-5 w-5 animate-spin text-[color:var(--w-accent-text)] motion-reduce:animate-none"
        />
        <span className="text-[0.9375rem] font-semibold text-[color:var(--w-muted)]">Loading…</span>
      </div>
    )
  }

  if (topUp && (plotQuery.isError || (plot && plot.is_mine === false))) {
    return (
      <div className="flex items-start gap-3 p-6" role="alert" style={SANS}>
        <AlertCircle
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--w-accent-text)]"
        />
        <div className="flex flex-col gap-1.5">
          <WorldHeading level={3}>Cannot top up this plot</WorldHeading>
          <p className={HINT}>
            {plotQuery.isError
              ? 'This plot could not be loaded. Try again in a moment.'
              : 'Only the owner of a plot can add to its stake.'}
          </p>
        </div>
      </div>
    )
  }

  // ---- render --------------------------------------------------------------

  const lastStep = stepIndex === steps.length - 1

  return (
    <div className="flex h-full min-h-0 flex-col" style={SANS}>
      <header className="shrink-0 px-5 pb-2.5 pt-4 sm:pb-3 sm:pt-5">
        <WorldHeading level={2}>{topUp ? 'Add to your plot' : 'Claim your plot'}</WorldHeading>
        <p className={cn(HINT, 'mt-1')}>
          {topUp
            ? 'Top up the stake on a plot you already own.'
            : 'A permanent pin at a real coordinate. You finish on Stripe.'}
        </p>
      </header>

      {/* ---- step tabs ------------------------------------------------------
          Pills, not a terminal tab strip. Each one says where you are (filled
          orange), where you have been (a tick) and where you cannot go yet
          (dimmed and genuinely disabled). */}
      {/* Pills size to their own labels. They used to be `flex-1` equal columns,
          which forced every label through `truncate` — in a 26rem panel that
          shipped "3 Acco…" and "4 Amo…", i.e. the two steps that involve money
          were the two nobody could read. At natural width all four fit one line
          down to 375px, and `flex-wrap` catches anything narrower. */}
      <ol className="flex shrink-0 flex-wrap items-stretch gap-1.5 px-5 pb-3 sm:pb-4">
        {steps.map((id, index) => {
          const done = index < stepIndex && canLeave[id]
          const current = id === stepId
          const blocked = !reachable[index]
          return (
            <li key={id} className="min-w-0">
              <button
                type="button"
                disabled={blocked || submitting}
                aria-current={current ? 'step' : undefined}
                onClick={() => setStepId(id)}
                className={cn(
                  PRESSABLE,
                  'flex min-h-[2.5rem] w-full items-center justify-center gap-1.5',
                  // Measured: at the sm size all four pills come to 346px and a
                  // 375px phone leaves 335px inside the sheet, so they wrapped
                  // onto a second row and cost ~50px of the step below. One
                  // notch down on padding and type puts them at 323px.
                  'px-2.5 text-[0.8125rem] sm:px-3 sm:text-[0.875rem]',
                  'rounded-full',
                  'border font-bold',
                  // 0.6 is the same dimming the primitives use for inactive
                  // controls, which SC 1.4.3 exempts.
                  'disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0',
                  current
                    ? 'border-[color:var(--w-accent)] bg-[color:var(--w-accent)] text-[color:var(--w-accent-ink)]'
                    : cn(
                        'border-[color:var(--w-border)] bg-[color:var(--w-card)] text-[color:var(--w-muted)]',
                        !blocked &&
                          'hover:border-[color:var(--w-accent)] hover:text-[color:var(--w-ink)]',
                      ),
                )}
              >
                {done ? (
                  <Check
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-[color:var(--w-accent-text)]"
                  />
                ) : (
                  <span aria-hidden="true" className="world-num shrink-0 text-[0.8125rem]">
                    {index + 1}
                  </span>
                )}
                <span className="truncate">{STEP_LABELS[id]}</span>
                {/* The number is decoration for sighted users; the step's real
                    position is spoken here once, not twice. */}
                <span className="sr-only">
                  {` — step ${index + 1} of ${steps.length}${done ? ', done' : ''}`}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      {/* Enter advances, but never pays: paying is an explicit press of the
          pay button inside ClaimSummary, which is `type="button"`. */}
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault()
          if (!lastStep) goNext()
        }}
      >
        {/* py-4 up to sm: the bottom sheet on a 375x812 phone has about 200px
            for a step, and 8px of it was padding nobody could use. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:py-5">
          {/* One step at a time. mode="wait": two steps overlapping means two
              focusable forms in the tree at once, and a buyer who tabs during
              the transition lands in the step they just left. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={stepId}
              initial={reduced ? false : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 1 } : { opacity: 0, x: -8 }}
              transition={{ duration: reduced ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <h3 ref={stepHeadingRef} tabIndex={-1} className="sr-only">
                {STEP_LABELS[stepId]} — step {stepIndex + 1} of {steps.length}
              </h3>

              {stepId === 'place' ? (
                // No search on a seed claim: the coordinate is the company's
                // and is not the buyer's to move from in here.
                <PlaceSummary
                  place={place}
                  onPickCity={companyId === null ? onChoosePoint : undefined}
                />
              ) : stepId === 'identity' ? (
                <IdentityForm value={identity} onChange={setIdentity} showAllErrors={showIdentityErrors} />
              ) : stepId === 'auth' ? (
                <AuthStep />
              ) : (
                <div className="flex flex-col gap-6">
                  <AmountPicker
                    valueCents={amountCents}
                    onChange={setAmountCents}
                    context={amountContext}
                    existingStakeCents={topUp ? (plot?.total_cents ?? 0) : 0}
                  />
                  <div aria-hidden="true" className="h-px w-full bg-[color:var(--w-border)]" />
                  <ClaimSummary
                    amountCents={amountCents}
                    placeLabel={resolvedWhere ? placeLabel(resolvedWhere) : null}
                    name={identity.name.trim()}
                    hasUrl={identity.url.trim().length > 0}
                    topUp={topUp}
                    onSubmit={submit}
                    submitting={submitting}
                    error={checkoutError}
                    disabled={
                      !amountValid || !user || (!topUp && (!placeOk || !identityValid))
                    }
                  />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ---- footer ------------------------------------------------------- */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[color:var(--w-border)] bg-[color:var(--w-card)] px-5 py-4">
          {stepIndex > 0 ? (
            <WorldButton variant="secondary" size="md" disabled={submitting} onClick={goBack}>
              <ArrowLeft aria-hidden="true" className="h-[1.125rem] w-[1.125rem]" />
              Back
            </WorldButton>
          ) : (
            <span />
          )}

          {!lastStep ? (
            <WorldButton
              type="submit"
              variant="primary"
              size="md"
              disabled={!canLeave[stepId] && stepId !== 'identity'}
              className="min-w-[10rem]"
            >
              <span>Continue</span>
              {/* The price rides on the button from step one: the number that
                  lets somebody opt out early, or relax and keep going. */}
              {stepIndex === 0 && !topUp ? (
                <span className="font-semibold opacity-80">
                  · from <Money cents={MIN_STAKE_CENTS} />
                </span>
              ) : null}
              <ArrowRight aria-hidden="true" className="h-[1.125rem] w-[1.125rem]" />
            </WorldButton>
          ) : (
            /* The amount step has its own pay button in ClaimSummary; the
               footer keeps the chosen place and price on screen together —
               the two numbers that decide the purchase should never be on
               separate screens. */
            <div className="ml-auto flex min-w-0 items-baseline gap-2">
              {resolvedWhere ? (
                <span className="min-w-0 truncate text-[0.8125rem] text-[color:var(--w-muted)]">
                  {placeLabel(resolvedWhere)}
                </span>
              ) : null}
              <Money
                cents={amountCents}
                className="shrink-0 text-[1.0625rem] font-bold text-[color:var(--w-accent-text)]"
              />
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
