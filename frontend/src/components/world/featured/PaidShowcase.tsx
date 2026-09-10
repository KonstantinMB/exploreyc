/**
 * The shopfront window: the plots people have actually paid for.
 *
 * This is the section the whole page is built around. The brief was "an ad for
 * businesses", and the most persuasive ad for buying a plot is the plots that
 * have already been bought — real logos, real names, real amounts, at a size
 * you cannot mistake for a table row.
 *
 * WHERE THE DATA COMES FROM, and the two sources this deliberately does NOT
 * use:
 *
 *   - The globe feed's paid pins (`kind === 'plot'`) are the SET. They are
 *     already in hand on /world, so the showcase costs no extra list request,
 *     and they are total: every active plot is in there, with its stake tier
 *     and its promoted flag.
 *   - GET /api/world/plots/{id}, one per card, fills in what a thin pin cannot
 *     carry — the company's mark and the exact amount staked. Bounded by
 *     `limit`, so this is a handful of small cached reads, not a fan-out.
 *   - NOT the founders board. It looks like the right list and is not: its
 *     query filters `founder_name IS NOT NULL AND != ''`, and `founder_name` is
 *     optional at checkout. A paying customer who skipped that field would be
 *     missing from the window they paid to be in.
 *   - NOT /api/world/board at world scope either — that scope ranks COUNTRIES,
 *     and country rows carry no plot and no logo.
 *
 * EMPTY IS THE COMMON CASE and it is designed for, not defaulted through:
 * production has zero paid plots today. An empty shopfront window shows the
 * empty pitches with their price on them, which is the honest version of the
 * same pitch — never a fake company, never a placeholder logo.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { ChevronRight, Plus } from 'lucide-react'
import { cn } from '../../../lib/utils'
import worldApi, { type GlobePin, type WorldPlot } from '../../../lib/worldApi'
import { MIN_STAKE_CENTS } from '../constants'
import {
  Money,
  Rank,
  WorldChip,
  WorldHeading,
  WorldLogo,
  worldButtonClass,
  WORLD_FOCUS_CLASS,
} from '../ui'

/** Detail reads are cheap and the amounts move slowly; 30s is plenty. */
const DETAIL_STALE_MS = 30_000

/** The card is the whole hit target; these are the shared physics. */
const CARD_CLASS =
  'world-tokens world-card flex w-full min-w-0 flex-col gap-3 p-4 transition-transform duration-150 motion-reduce:transition-none'

/**
 * One bought plot.
 *
 * Renders from the pin the moment the globe feed lands — name, promotion,
 * somewhere to click — and fills in the mark and the amount when the detail
 * read resolves. The amount is a skeleton while it is in flight rather than
 * <Money cents={null}>: "unknown" is a claim about the data, and this is a
 * claim about the network.
 */
function PlotCard({ pin, plot }: { pin: GlobePin; plot: WorldPlot | undefined }) {
  const promoted = plot?.promoted ?? pin.promoted
  const rank = plot?.rank_world ?? null
  // The globe feed now carries the mark and the exact amount, so the card is
  // complete on first paint and the detail read only adds the tagline, the
  // place and the world rank. `??` not `||`: a plot really staked at 0 cents
  // must render as $0, not fall through to the detail read.
  const logo = plot?.logo_url ?? pin.logo_url ?? null
  const cents = plot?.total_cents ?? pin.total_cents ?? null
  return (
    <Link
      to={`/world/p/${pin.id}`}
      className={cn(
        CARD_CLASS,
        WORLD_FOCUS_CLASS,
        'group hover:-translate-y-1 hover:border-[var(--w-accent)] motion-reduce:hover:translate-y-0'
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {/* 48px: this is the one place in the World where a company's mark is
            the point of the element rather than an identifier on a row. */}
        <WorldLogo src={logo} name={plot?.name ?? pin.name} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[1.0625rem] font-extrabold leading-tight tracking-[-0.02em] text-[var(--w-ink)]">
            {plot?.name ?? pin.name}
          </p>
          <p className="truncate text-[0.8125rem] text-[var(--w-muted)]">
            {plot?.tagline || plot?.city_name || plot?.country_name || 'On the globe'}
          </p>
        </div>
        {rank != null ? <Rank n={rank} /> : null}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--w-border)] pt-3">
        {cents != null ? (
          <Money cents={cents} score />
        ) : (
          <span
            aria-hidden
            className="h-5 w-16 animate-pulse rounded-[6px] bg-[var(--w-ground)] motion-reduce:animate-none"
          />
        )}
        {promoted ? (
          <WorldChip tone="promoted" />
        ) : (
          <span className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-[var(--w-muted)] transition-colors group-hover:text-[var(--w-accent-text)]">
            Visit
            <ChevronRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
              aria-hidden
            />
          </span>
        )}
      </div>
    </Link>
  )
}

/**
 * An unsold pitch.
 *
 * Says exactly what it is — available space with a price — and never dresses
 * itself up as a company that has not bought anything.
 */
function VacantCard() {
  return (
    <div className={cn(CARD_CLASS, 'border-dashed bg-transparent shadow-none')}>
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="grid h-12 w-12 shrink-0 place-items-center rounded-[8px] border-2 border-dashed border-[var(--w-border)] text-[var(--w-muted)]"
        >
          <Plus className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[1.0625rem] font-extrabold leading-tight tracking-[-0.02em] text-[var(--w-ink)]">
            Your logo here
          </p>
          <p className="truncate text-[0.8125rem] text-[var(--w-muted)]">Any coordinate on Earth</p>
        </div>
      </div>
      <p className="mt-auto border-t border-[var(--w-border)] pt-3 text-[0.9375rem] text-[var(--w-muted)]">
        <Money cents={MIN_STAKE_CENTS} className="text-[var(--w-accent-text)]" /> claims it.
      </p>
    </div>
  )
}

/** The card that ends an empty grid on an action rather than on a shrug. */
function ClaimCard() {
  return (
    <div className={cn(CARD_CLASS, 'border-[var(--w-accent)] bg-[var(--w-tint)]')}>
      <p className="text-[1.0625rem] font-extrabold leading-snug tracking-[-0.02em] text-[var(--w-ink)]">
        Nobody has taken a plot yet.
      </p>
      <p className="text-[0.9375rem] text-[var(--w-muted)]">
        First one in gets the pick of the planet — and #1 on the board with it.
      </p>
      <Link
        to="/world/claim"
        className={worldButtonClass('primary', 'md', { block: true, className: 'mt-auto' })}
      >
        Claim the first plot
        <ChevronRight className="h-[1.125rem] w-[1.125rem]" aria-hidden />
      </Link>
    </div>
  )
}

export interface PaidShowcaseProps {
  /** The decoded globe feed. Paid plots are picked out of it here. */
  pins: GlobePin[]
  /** How many paid plots to put in the window. */
  limit?: number
  className?: string
}

/**
 * Paid plots, biggest stake first, as a grid of cards.
 *
 * Order comes from the exact stake the feed carries, falling back to the tier
 * bucket for a payload that predates `total_cents`, with promoted plots ahead
 * of their equals and names as the final tiebreak — so the order is stable
 * between renders instead of shuffling on every poll.
 */
export function PaidShowcase({ pins, limit = 6, className }: PaidShowcaseProps) {
  const paid = useMemo(
    () =>
      pins
        .filter((p) => p.kind === 'plot')
        .sort(
          (a, b) =>
            (b.total_cents ?? 0) - (a.total_cents ?? 0) ||
            b.tier - a.tier ||
            Number(b.promoted) - Number(a.promoted) ||
            a.name.localeCompare(b.name)
        )
        .slice(0, limit),
    [pins, limit]
  )

  const details = useQueries({
    queries: paid.map((pin) => ({
      queryKey: ['world', 'plot', pin.id],
      queryFn: () => worldApi.getPlot(pin.id).then((r) => r.data),
      staleTime: DETAIL_STALE_MS,
    })),
  })

  return (
    <section aria-label="Plots on the globe" className={cn('min-w-0', className)}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <WorldHeading level={2}>On the globe right now</WorldHeading>
          <p className="mt-1 text-[0.9375rem] text-[var(--w-muted)]">
            Every one of these is a real company that paid for its coordinates.
          </p>
        </div>
        <Link to="/world/claim" className={worldButtonClass('primary', 'md')}>
          Claim your plot — from $5
          <ChevronRight className="h-[1.125rem] w-[1.125rem]" aria-hidden />
        </Link>
      </div>

      {paid.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <VacantCard />
          <VacantCard />
          <ClaimCard />
        </div>
      ) : (
        <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {paid.map((pin, i) => (
            <li key={pin.id} className="flex min-w-0">
              <PlotCard pin={pin} plot={details[i]?.data} />
            </li>
          ))}
          {/* The window is never full: one empty pitch stays in the grid, at
              the end, so the price sits next to what people paid. */}
          {paid.length < limit ? (
            <li className="flex min-w-0">
              <VacantCard />
            </li>
          ) : null}
        </ul>
      )}
    </section>
  )
}

export default PaidShowcase
