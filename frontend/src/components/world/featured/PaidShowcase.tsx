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
  WORLD_CARD_CLASS,
} from '../ui'

/** Detail reads are cheap and the amounts move slowly; 30s is plenty. */
const DETAIL_STALE_MS = 30_000

/**
 * The card is the whole hit target; these are the shared physics. Same skin as
 * <WorldCard> / the platform's HackerCard — hairline border, small radius,
 * translucent card ground — so a showcase tile and a leaderboard panel are
 * demonstrably the same object.
 */
const CARD_CLASS = cn(
  WORLD_CARD_CLASS,
  'flex w-full min-w-0 flex-col gap-3 p-4 hover:shadow-none'
)

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
        'group hover:border-[#FB651E]/60 hover:shadow-[0_0_20px_rgba(251,101,30,0.15)]'
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {/* 48px: this is the one place in the World where a company's mark is
            the point of the element rather than an identifier on a row. */}
        <WorldLogo src={logo} name={plot?.name ?? pin.name} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold leading-tight tracking-tight text-foreground">
            {plot?.name ?? pin.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {plot?.tagline || plot?.city_name || plot?.country_name || 'On the globe'}
          </p>
        </div>
        {rank != null ? <Rank n={rank} /> : null}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
        {cents != null ? (
          <Money cents={cents} score />
        ) : (
          <span
            aria-hidden
            className="h-5 w-16 animate-pulse rounded-sm bg-background motion-reduce:animate-none"
          />
        )}
        {promoted ? (
          <WorldChip tone="promoted" />
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors group-hover:text-[#FB651E]">
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
          className="grid h-12 w-12 shrink-0 place-items-center rounded-sm border-2 border-dashed border-border text-muted-foreground"
        >
          <Plus className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-bold leading-tight tracking-tight text-foreground">
            Your logo here
          </p>
          <p className="truncate text-xs text-muted-foreground">Any coordinate on Earth</p>
        </div>
      </div>
      <p className="mt-auto border-t border-border pt-3 text-sm text-muted-foreground">
        <Money cents={MIN_STAKE_CENTS} className="text-[#FB651E]" /> claims it.
      </p>
    </div>
  )
}

/** The card that ends an empty grid on an action rather than on a shrug. */
function ClaimCard() {
  return (
    <div className={cn(CARD_CLASS, 'border-[#FB651E]/40 bg-[#FB651E]/[0.05]')}>
      <p className="text-base font-bold leading-snug tracking-tight text-foreground">
        Nobody has taken a plot yet.
      </p>
      <p className="text-sm text-muted-foreground">
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
          <p className="mt-1 text-sm text-muted-foreground">
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
