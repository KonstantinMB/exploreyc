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
// globe. Picking happens on the globe: the page calls `onNeedPick` handling,
// then re-opens this flow with coordinates. This component renders inline and
// never navigates on its own — the only redirect is `window.location.assign`
// to Stripe.

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'

import { cn } from '../../../lib/utils'
import { apiClient } from '../../../lib/api'
import worldApi, { type WhereResponse, type WorldCheckoutRequest } from '../../../lib/worldApi'
import { MIN_STAKE_CENTS, formatDollars } from '../constants'
import { useDevAuth } from '../../../contexts/DevAuthContext'

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
   * The page owns the globe. When the flow needs a coordinate (or a new one),
   * it calls this; the page enters pick mode and re-opens the flow with
   * `initial: {lat, lng}`.
   */
  onNeedPick?: () => void
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

export default function ClaimFlow({ initial, onNeedPick }: ClaimFlowProps) {
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
      <div className="flex items-center justify-center p-10 font-mono" role="status">
        <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin text-[#FB651E]" />
        <span className="text-sm text-muted-foreground">loading…</span>
      </div>
    )
  }

  if (topUp && (plotQuery.isError || (plot && plot.is_mine === false))) {
    return (
      <div className="flex flex-col gap-2 p-6 font-mono" role="alert">
        <h2 className="text-base font-bold">Cannot top up this plot</h2>
        <p className="text-sm leading-snug text-muted-foreground">
          {plotQuery.isError
            ? 'This plot could not be loaded. Try again in a moment.'
            : 'Only the owner of a plot can add to its stake.'}
        </p>
      </div>
    )
  }

  // ---- render --------------------------------------------------------------

  const lastStep = stepIndex === steps.length - 1

  return (
    <div className="flex h-full min-h-0 flex-col font-mono">
      <header className="shrink-0 border-b border-border px-5 py-4">
        <h2 className="text-lg font-bold">
          {topUp ? 'Add to your plot' : 'Claim your plot'}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {topUp
            ? 'Top up the stake on a plot you already own.'
            : 'A permanent pin at a real coordinate. You finish on Stripe.'}
        </p>
      </header>

      {/* ---- step tabs ------------------------------------------------------ */}
      <ol className="flex shrink-0 items-stretch border-b border-border px-5">
        {steps.map((id, index) => {
          const done = index < stepIndex && canLeave[id]
          const current = id === stepId
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                disabled={!reachable[index] || submitting}
                aria-current={current ? 'step' : undefined}
                onClick={() => setStepId(id)}
                className={cn(
                  'flex w-full items-center justify-center gap-2 border-b-2 py-2.5 text-center transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  'disabled:cursor-default',
                  current
                    ? 'border-b-[#FB651E] text-foreground'
                    : 'border-b-transparent text-muted-foreground enabled:hover:text-foreground',
                )}
              >
                {done ? (
                  <Check aria-hidden="true" className="h-3.5 w-3.5 text-[#FB651E]" />
                ) : (
                  <span className={cn('text-xs tabular-nums', current && 'font-semibold text-[#FB651E]')}>
                    {index + 1}
                  </span>
                )}
                <span className="text-xs uppercase tracking-wider">{STEP_LABELS[id]}</span>
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
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
                <PlaceSummary place={place} onNeedPick={onNeedPick} canChange={companyId === null} />
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
                  <div aria-hidden="true" className="h-px w-full bg-border" />
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
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card px-5 py-4">
          {stepIndex > 0 ? (
            <button
              type="button"
              disabled={submitting}
              onClick={goBack}
              className={cn(
                'inline-flex h-10 items-center gap-1.5 rounded-md border border-input bg-background px-4',
                'font-mono text-sm transition-colors hover:border-[#FB651E]/60 hover:text-[#FB651E]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'ring-offset-background disabled:pointer-events-none disabled:opacity-50',
              )}
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Back
            </button>
          ) : (
            <span />
          )}

          {!lastStep ? (
            <button
              type="submit"
              disabled={!canLeave[stepId] && stepId !== 'identity'}
              className={cn(
                'inline-flex h-10 min-w-[11rem] items-center justify-center gap-2 rounded-md bg-[#FB651E] px-4',
                'font-mono text-sm font-medium text-white transition-colors hover:bg-[#E65C00]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'ring-offset-background disabled:pointer-events-none disabled:opacity-50',
              )}
            >
              <span>Continue</span>
              {/* The price rides on the button from step one: the number that
                  lets somebody opt out early, or relax and keep going. */}
              {stepIndex === 0 && !topUp ? (
                <span className="font-normal opacity-90">· from {formatDollars(MIN_STAKE_CENTS)}</span>
              ) : null}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </button>
          ) : (
            /* The amount step has its own pay button in ClaimSummary; the
               footer keeps the chosen place and price on screen together —
               the two numbers that decide the purchase should never be on
               separate screens. */
            <div className="ml-auto flex min-w-0 items-baseline gap-2">
              {resolvedWhere ? (
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {placeLabel(resolvedWhere)}
                </span>
              ) : null}
              <span className="shrink-0 text-sm font-semibold text-[#FB651E]">
                {formatDollars(amountCents)}
              </span>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
