/**
 * Click a country, see the country. This is that view.
 *
 * THE MODEL CHANGE, MADE VISIBLE. The World used to be bid on by coordinate: a
 * buyer hunted for a point, a crosshair pulsed at them, and a country was
 * something they arrived at by accident. The reference the owner handed over
 * bids on COUNTRIES, and this panel is the unit of that — a single card that
 * answers the four questions somebody clicking Kenya actually has:
 *
 *     who owns it        the ranked list, #1 crowned
 *     how contested      "12 bidding"
 *     what #1 costs      "#1 pays $51", and the button says $52
 *     how do I get in    one button, one modal, Stripe
 *
 * Every figure comes from two endpoints that already existed —
 * `GET /api/world/country/{iso}` and `GET /api/world/board?scope=country:XX` —
 * and nothing here is computed optimistically. When the board has no
 * `cents_to_beat` the price renders as the word "unknown" (<Money> enforces
 * that), never as a plausible-looking number.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: own its own open/closed state, navigate, or
 * touch the globe. It is handed an `iso` and hands back two intents — claim,
 * and close. The page owns the rest.
 *
 * ONE NOTE ON THE ROWS. The reference prints a one-line description under every
 * domain. Our country board does not ship one — `_board_row` in backend/world.py
 * carries rank, name, total and logo, and that is all — so the second line
 * shows what we DO have (24h movement, a Promoted disclosure) and is simply
 * absent otherwise. Inventing a tagline to fill a row is the one thing this
 * product does not do.
 */

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Crown } from 'lucide-react'

import { cn } from '../../../lib/utils'
import worldApi from '../../../lib/worldApi'
import { MIN_STAKE_CENTS } from '../constants'
import {
  InfoTip,
  Money,
  Rank,
  WorldButton,
  WorldCard,
  WorldChip,
  WorldLogo,
  WORLD_FOCUS_CLASS,
  WORLD_PANEL_SURFACE,
} from '../ui'
import { isoFlag } from '../boards/format'
import { nameFor } from './names'

export interface CountryPanelProps {
  /** ISO-3166 alpha-2 of the country to show. */
  iso: string
  /** Open the stake modal for this country. */
  onClaim: (context: { iso: string; name: string; centsToBeat: number | null }) => void
  /** Put the panel away. Rendered as a labelled control, never a bare ✕. */
  onClose: () => void
  className?: string
}

/** How many rows fit before the list becomes a link to the full page. */
const ROWS = 8

export function CountryPanel({ iso, onClaim, onClose, className }: CountryPanelProps) {
  const code = iso.trim().toUpperCase()

  const countryQuery = useQuery({
    queryKey: ['world', 'country', code],
    queryFn: () => worldApi.getCountry(code).then((r) => r.data),
    enabled: code.length === 2,
    staleTime: 30_000,
  })

  // The country-scoped richest board is the only place `cents_to_beat` lives —
  // the country record carries totals, not the price of the top spot.
  const boardQuery = useQuery({
    queryKey: ['world', 'board', 'richest', `country:${code}`],
    queryFn: () => worldApi.getBoard('richest', `country:${code}`).then((r) => r.data),
    enabled: code.length === 2,
    staleTime: 30_000,
  })

  const country = countryQuery.data ?? null
  const name = country?.name ?? nameFor(code)
  const plots = country?.plots ?? []
  const leaderCents = plots.length > 0 ? plots[0].total_cents : null

  /**
   * Two different absences, two different sentences. A country with NO plots
   * has a real price — the $5 floor takes an empty board, which the server
   * itself returns. A country whose leader figure never arrived is unknown, and
   * <Money cents={null}> is what prints that word.
   */
  const toBeat = boardQuery.data?.cents_to_beat ?? null
  const priceCents = plots.length === 0 ? MIN_STAKE_CENTS : toBeat

  const header = (
    <div className="flex items-start justify-between gap-2 border-b border-border px-3.5 py-3">
      <div className="min-w-0">
        {/* `justify-between` is not decoration: it parks the tip at the right
            edge of this column, which is the one x position where an `end`
            aligned bubble is guaranteed to open inside the panel rather than
            over the edge of it. */}
        <p className="flex items-center justify-between gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {plots.length > 0 ? 'Claimed territory' : 'Unclaimed territory'}
          <InfoTip label="What a territory is" align="end">
            Every stake in a country counts toward that country&apos;s total. The plot with the
            most staked on it is #1 here.
          </InfoTip>
        </p>
        {/* WRAPS, never truncates. "United States of Ame…" is the name of
            nowhere; the reference gives the same string two lines and so does
            this. `items-baseline` keeps the flag on the first line when the
            name takes two. */}
        <h2 className="mt-0.5 flex min-w-0 items-baseline gap-2 font-mono text-lg font-bold leading-tight">
          <span aria-hidden className="shrink-0 text-xl leading-none">
            {isoFlag(code)}
          </span>
          <span className="min-w-0 break-words">{name}</span>
        </h2>
        {/* "12 bidding · #1 pays $51" — the reference's own line, and both
            halves of it are read straight off the board. */}
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
          {plots.length === 0 ? (
            <>Nobody is bidding yet</>
          ) : (
            <>
              <span className="world-num text-foreground">{country?.plots_count ?? plots.length}</span>{' '}
              bidding · #1 pays <Money cents={leaderCents} className="text-[#FB651E]" />
            </>
          )}
        </p>
      </div>
      {/* A word, not a glyph: a bare ✕ over a globe is a guess about what it
          closes. Escape does the same thing from the page. */}
      <WorldButton variant="ghost" size="sm" className="-mr-1.5 shrink-0" onClick={onClose}>
        Close
      </WorldButton>
    </div>
  )

  return (
    <WorldCard
      as="section"
      // The landmark's name tracks the eyebrow: a country nobody has staked in
      // is not "claimed territory", and a screen reader should hear the same
      // fact the heading above the list is showing.
      aria-label={`${name} — ${plots.length > 0 ? 'claimed territory' : 'unclaimed territory'}`}
      flat
      className={cn('flex min-h-0 flex-col overflow-hidden', WORLD_PANEL_SURFACE, className)}
    >
      {header}

      <div className="world-scroll-list min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {countryQuery.isPending ? (
          <p role="status" className="px-3.5 py-6 text-sm text-muted-foreground">
            Loading {name}…
          </p>
        ) : countryQuery.isError ? (
          <p role="alert" className="px-3.5 py-6 text-sm text-muted-foreground">
            {name} could not be loaded right now. The spot is still claimable.
          </p>
        ) : plots.length === 0 ? (
          <EmptyBoard name={name} />
        ) : (
          <ul className="flex flex-col">
            {plots.slice(0, ROWS).map((plot, index, list) => (
              <li key={plot.id}>
                <PlotRow
                  plot={plot}
                  joint={index > 0 && list[index - 1].rank === plot.rank}
                />
              </li>
            ))}
            {plots.length > ROWS ? (
              <li className="px-3.5 py-2.5">
                <Link
                  to={`/world/c/${code}`}
                  className={`${WORLD_FOCUS_CLASS} world-link inline-flex items-center gap-1 text-xs`}
                >
                  All {country?.plots_count ?? plots.length} in {name}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </li>
            ) : null}
          </ul>
        )}
      </div>

      {/* ---- the ask ------------------------------------------------------- */}
      <div className="shrink-0 border-t border-border px-3.5 py-3">
        <WorldButton
          variant="primary"
          size="lg"
          block
          onClick={() => onClaim({ iso: code, name, centsToBeat: priceCents })}
        >
          {priceCents == null ? (
            // No leader figure means no price, and the button says so rather
            // than quoting a number nobody stands behind.
            <>Claim a spot in {name}</>
          ) : (
            <>
              Claim a spot — for <Money cents={priceCents} className="text-white" />
            </>
          )}
        </WorldButton>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] leading-tight text-muted-foreground">
          No prize, no payout, no refund.
          <InfoTip label="What you get for the money" align="end">
            A named plot on the globe with your logo on it, and a rank in {name} for as long as
            nobody outstakes you. It is an ad buy, not a bet.
          </InfoTip>
        </p>
      </div>
    </WorldCard>
  )
}

/** One ranked plot. #1 is crowned, tinted and edged — three signals, not one colour. */
function PlotRow({
  plot,
  joint,
}: {
  plot: {
    id: number
    rank: number
    name: string
    total_cents: number
    delta_cents: number | null
    promoted: boolean
    logo_url?: string | null
    tagline?: string | null
  }
  joint: boolean
}) {
  // The owner's own words, or the linked YC company's one-liner — whichever
  // the API resolved. Never generated here: a plot whose owner wrote nothing
  // shows the movement line instead, or no second line at all.
  const tagline = plot.tagline?.trim() || null
  const movement = plot.delta_cents != null && plot.delta_cents > 0
  const first = plot.rank === 1
  return (
    <Link
      to={`/world/p/${plot.id}`}
      className={cn(
        'group relative flex w-full items-center gap-2.5 border-b border-border/50 px-3.5 py-2.5',
        'transition-colors duration-150 last:border-b-0 motion-reduce:transition-none',
        'cursor-pointer hover:bg-[#FB651E]/[0.05] focus-visible:bg-[#FB651E]/[0.06]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FB651E]',
        first && 'bg-[#FB651E]/[0.06] shadow-[inset_3px_0_0_#FB651E]',
      )}
    >
      {first ? (
        <Crown aria-hidden className="h-4 w-4 shrink-0 text-[#FB651E]" />
      ) : (
        // Medals stay on for 2 and 3 — the same silver and bronze the founders
        // podium and the full boards wear, so the three leaderboards in this
        // product keep looking like one product. Only the box shrinks.
        <Rank
          n={plot.rank}
          joint={joint}
          className="h-7 min-w-7 text-[11px] sm:h-7 sm:min-w-7 sm:text-[11px]"
        />
      )}
      {first ? <span className="sr-only">Rank 1</span> : null}
      <WorldLogo src={plot.logo_url} name={plot.name} size={24} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-sm font-semibold transition-colors group-hover:text-[#FB651E]">
          {plot.name}
        </span>
        {/* WHO THEY ARE, under WHAT THEY PAID — the line that turns a column of
            amounts into a directory of startups, and the thing the reference
            does on every single row. One line, clipped with an ellipsis: the
            full sentence lives on the plot page this row links to. */}
        {tagline ? (
          <span className="block truncate text-[11px] leading-snug text-muted-foreground">
            {tagline}
          </span>
        ) : null}
        {/* Disclosure and movement sit below the words, never instead of them.
            Still absent entirely when there is neither. */}
        {plot.promoted || movement ? (
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {plot.promoted ? <WorldChip tone="promoted" /> : null}
            {movement ? (
              <>
                <Money cents={plot.delta_cents} plus className="text-muted-foreground" /> in 24h
              </>
            ) : null}
          </span>
        ) : null}
      </span>
      <Money cents={plot.total_cents} score className="shrink-0" />
    </Link>
  )
}

/**
 * The empty board, taught with an example instead of a paragraph.
 *
 * The owner's instruction for empty states was literal: "make example, mocked
 * data, or placeholders to serve as example for the user and for them to not
 * just look at a bunch of text". So this is the shape of a real row, dimmed,
 * carrying the word "Example" where the Promoted chip would be — nobody can
 * mistake it for somebody else's claim, and everybody can see what buying one
 * produces.
 */
function EmptyBoard({ name }: { name: string }) {
  return (
    <div className="px-3.5 py-4">
      <p className="mb-3 text-sm leading-snug text-foreground">
        Nobody has staked in {name}. <Money cents={MIN_STAKE_CENTS} className="text-[#FB651E]" />{' '}
        takes #1.
      </p>
      <div
        className="flex items-center gap-2.5 rounded-sm border border-dashed border-border px-3 py-2.5 opacity-70"
        // The whole tile is decorative: the sentence above already says what it
        // demonstrates, and a screen reader hearing a fake board row would have
        // to work out it was not real.
        aria-hidden="true"
      >
        <Crown className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="grid h-6 w-6 flex-none place-items-center rounded-sm border border-border bg-muted/50 font-mono text-[10px] font-bold text-muted-foreground">
          Y
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-sm font-semibold">yourstartup.com</span>
          {/* The demo row carries a demo one-liner, because the real rows
              carry a real one — an example that omits the shape it is
              teaching is not an example. */}
          <span className="block truncate text-[11px] leading-snug text-muted-foreground">
            What your startup does, in one line.
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            Example
          </span>
        </span>
        <span className="world-num text-sm font-bold text-muted-foreground">$5</span>
      </div>
    </div>
  )
}

export default CountryPanel
