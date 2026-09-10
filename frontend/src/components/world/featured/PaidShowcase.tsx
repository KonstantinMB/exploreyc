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
 *
 * ONE of these renders, and only ever beside plots that HAVE sold: see the
 * zero-plot branch below, which does not use this card at all.
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

/**
 * DAY ONE. The state every Product Hunt visitor sees.
 *
 * This used to be two grey dashed "Your logo here" ghosts with a small claim
 * card beside them, and it read exactly like an unfinished grid — three empty
 * boxes where the product's proof is supposed to be. Nothing was dishonest
 * about it; it just made the launch look like a page that had failed to load
 * its data.
 *
 * So the zero-plot case stops pretending to be a grid of cards it does not
 * have. One deliberate panel: the fact, the offer, the three things that
 * actually happen when you take it, and the price. It is the same pitch, told
 * as an invitation rather than as three absences — and the honesty is
 * unchanged, because nothing here invents a company, a logo or an amount. The
 * `$5` is <Money cents={MIN_STAKE_CENTS}>, the same constant the server
 * enforces, not a typed number.
 */
const FIRST_PLOT_STEPS: readonly [string, string][] = [
  ['Pick a coordinate', 'Anywhere on Earth. Real lat/lng, named, yours.'],
  ['Plant your logo', 'It draws on the globe and on your plot page.'],
  ['Hold it', 'Anyone who wants your spot has to outstake you for it.'],
]

function FirstPlotPanel() {
  return (
    <div
      className={cn(
        WORLD_CARD_CLASS,
        'border-[#FB651E]/40 bg-[#FB651E]/[0.04] p-5 hover:border-[#FB651E]/40',
        'hover:shadow-none sm:p-7'
      )}
    >
      <div className="min-w-0">
        <WorldChip tone="accent" className="mb-3">
          The planet is empty
        </WorldChip>
        <p className="text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl">
          Nobody has taken a plot yet.
        </p>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Every coordinate on Earth is still open. The first plot on the board is
          #1 on the board, and it stays there until somebody outstakes it.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
          <Link to="/world/claim" className={worldButtonClass('primary', 'lg')}>
            Claim the first plot
            <ChevronRight className="h-[1.125rem] w-[1.125rem]" aria-hidden />
          </Link>
          <p className="text-sm text-muted-foreground">
            <Money cents={MIN_STAKE_CENTS} className="text-[#FB651E]" /> claims it.
          </p>
        </div>
      </div>

      {/* The three steps, as a numbered list rather than as prose: this is the
          one place on the page that says what buying actually DOES, and a
          visitor who is deciding reads a list. Across the panel's full width
          from `sm` — a column of three parked in the right quarter left a hole
          in the middle of the panel at wide viewports, which is the same
          "composition that stops at 1440" problem the stage had. */}
      <ol className="m-0 mt-6 grid list-none gap-4 border-t border-[#FB651E]/25 p-0 pt-5 sm:grid-cols-3 sm:gap-6">
        {FIRST_PLOT_STEPS.map(([title, body], i) => (
          <li key={title} className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden
              className="world-num grid h-6 w-6 shrink-0 place-items-center rounded-sm border border-[#FB651E]/40 bg-background/60 text-xs font-bold text-[#FB651E]"
            >
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold leading-tight text-foreground">
                {title}
              </span>
              <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                {body}
              </span>
            </span>
          </li>
        ))}
      </ol>
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
          {/* The line under the heading changes on the empty case, and the
              second CTA goes away: "Every one of these is a real company that
              paid" printed over nothing is a sentence about nothing, and a
              button here is noise beside a panel that is itself one big CTA.
              No count is quoted — the number of imported companies is a fact
              the globe's own legend already carries, from the live feed. */}
          <WorldHeading level={2}>On the globe right now</WorldHeading>
          <p className="mt-1 text-sm text-muted-foreground">
            {paid.length === 0
              ? 'Nobody has claimed a coordinate yet. The whole planet is still open.'
              : 'Every one of these is a real company that paid for its coordinates.'}
          </p>
        </div>
        {paid.length === 0 ? null : (
          <Link to="/world/claim" className={worldButtonClass('primary', 'md')}>
            Claim your plot — from $5
            <ChevronRight className="h-[1.125rem] w-[1.125rem]" aria-hidden />
          </Link>
        )}
      </div>

      {paid.length === 0 ? (
        <FirstPlotPanel />
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
