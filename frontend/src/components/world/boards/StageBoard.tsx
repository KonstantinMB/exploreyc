/**
 * The leaderboard, ABOVE THE FOLD.
 *
 * WHY THIS EXISTS. The owner's report was three words long and unanswerable:
 * "i don't see leaderboard or anything". He was right. The full <WorldBoards>
 * lived at WorldPage.tsx:538 — under the globe stage, under the pulse strip,
 * under the country picker and under the paid showcase, roughly 2,400px down a
 * 900px viewport. The only ranked thing on the first screen was <GlobePodium>,
 * and it renders NOTHING until three separate countries have a plot in them,
 * which on a young board means it renders nothing at all. So the page that is
 * entirely about a competition opened with no competition on it.
 *
 * This is the fix, and it is deliberately not the podium:
 *
 *   - It ALWAYS renders. A board with two countries on it shows two; a board
 *     with none shows the price of being first. An empty state is information,
 *     and "nothing here yet, $5 takes #1" is the best sales line this product
 *     has.
 *   - It is a LIST, not a plinth. Five ranked rows in the height a three-column
 *     podium needs, so the visitor sees a standings table rather than a trophy.
 *   - It never navigates on its own. A row selects its country on the globe
 *     behind it — the same gesture as clicking the territory — and the footer
 *     link goes to the full board further down the same page.
 *
 * Every figure is the world-scope richest board, the same request (and the same
 * react-query cache entry) the picker, the stats pill and the full board use.
 * Nothing is computed optimistically and no number is invented: a country with
 * no rank is simply not on the list.
 */

import { useQuery } from '@tanstack/react-query'
import { Trophy } from 'lucide-react'

import { cn } from '../../../lib/utils'
import worldApi from '../../../lib/worldApi'
import { MIN_STAKE_CENTS } from '../constants'
import {
  Money,
  Rank,
  WorldCard,
  WORLD_FOCUS_CLASS,
  WORLD_OVERLAY_SURFACE,
} from '../ui'
import { countryDisplayName, isoFlag } from './format'

/** Same cadence the full board polls at. */
const POLL_MS = 15_000

/** How many rows fit the stage without the card outgrowing the globe beside it. */
const ROWS = 5

export interface StageBoardProps {
  /** A country was chosen — the page opens its panel and flies the globe. */
  onSelectCountry: (iso: string) => void
  className?: string
}

export function StageBoard({ onSelectCountry, className }: StageBoardProps) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['world', 'board', 'richest', 'world'],
    queryFn: () => worldApi.getBoard('richest', 'world').then((r) => r.data),
    refetchInterval: POLL_MS,
  })

  const rows = (data?.rows ?? []).slice(0, ROWS)

  return (
    <WorldCard
      as="section"
      aria-label="Top countries by total staked"
      flat
      className={cn('flex-col overflow-hidden', WORLD_OVERLAY_SURFACE, className)}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2">
        <h2 className="inline-flex items-center gap-1.5 font-mono text-xs font-bold">
          <Trophy className="h-3.5 w-3.5 text-[#FB651E]" aria-hidden />
          Who is winning the world
        </h2>
        {/* A real in-page anchor: it moves keyboard FOCUS to the full board as
            well as the viewport. */}
        <a
          href="#board"
          className={`${WORLD_FOCUS_CLASS} rounded-sm font-mono text-[10px] uppercase tracking-wide text-muted-foreground transition-colors hover:text-[#FB651E] motion-reduce:transition-none`}
        >
          Full board
        </a>
      </div>

      {isPending ? (
        <p role="status" className="px-3.5 py-4 text-xs text-muted-foreground">
          Counting the money…
        </p>
      ) : isError ? (
        <p role="alert" className="px-3.5 py-4 text-xs text-muted-foreground">
          Board unavailable — retrying.
        </p>
      ) : rows.length === 0 ? (
        // Invite, don't report. The price is the real floor the server
        // enforces, not a rounded promise.
        <p className="px-3.5 py-4 text-xs leading-snug text-foreground">
          Nobody has staked a cent anywhere yet.{' '}
          <Money cents={MIN_STAKE_CENTS} className="text-[#FB651E]" /> takes #1 in any country on
          Earth.
        </p>
      ) : (
        <ol className="flex flex-col">
          {rows.map((row, index) => {
            const iso = (row.iso ?? '').toUpperCase()
            const joint = index > 0 && rows[index - 1].rank === row.rank
            return (
              <li key={row.plot_id ?? iso}>
                <button
                  type="button"
                  onClick={() => iso.length === 2 && onSelectCountry(iso)}
                  className={cn(
                    WORLD_FOCUS_CLASS,
                    'group flex w-full cursor-pointer items-center gap-2.5 border-b border-border/50 px-3.5 py-1.5',
                    'text-left transition-colors duration-150 last:border-b-0',
                    'hover:bg-[#FB651E]/[0.05] motion-reduce:transition-none',
                  )}
                >
                  <Rank
                    n={row.rank}
                    joint={joint}
                    className="h-6 min-w-6 text-[11px] sm:h-6 sm:min-w-6 sm:text-[11px]"
                  />
                  <span aria-hidden className="shrink-0 text-base leading-none">
                    {isoFlag(iso)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold transition-colors group-hover:text-[#FB651E]">
                    {countryDisplayName(row.iso, row.name)}
                  </span>
                  <Money cents={row.total_cents} score className="shrink-0 text-sm sm:text-sm" />
                </button>
              </li>
            )
          })}
        </ol>
      )}

      {/* The conversion figure, where the standings are — never a second
          sentence about what a stake is. `cents_to_beat` is null when the API
          has no leader figure, and <Money cents={null}> prints "unknown"
          rather than a number nobody stands behind. */}
      {rows.length > 0 ? (
        <p className="border-t border-border px-3.5 py-1.5 font-mono text-[11px] text-muted-foreground">
          {data?.cents_to_beat != null ? (
            <>
              <Money cents={data.cents_to_beat} className="text-[#FB651E]" /> takes #1 in the world
            </>
          ) : (
            <>
              Price to take #1 in the world: <Money cents={null} />
            </>
          )}
        </p>
      ) : null}
    </WorldCard>
  )
}

export default StageBoard
