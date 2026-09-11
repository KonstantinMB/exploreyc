/**
 * The country panel's other half: what the rail shows when nothing is selected,
 * and the keyboard route into the whole feature.
 *
 * WHY IT EXISTS. The primary gesture is now "click a country on the globe",
 * and a WebGL canvas is not a gesture everybody has. A visitor on a keyboard, a
 * visitor on a phone who would rather not spin a sphere to find Estonia, and a
 * screen-reader user all need a list — so the rail's resting state IS that
 * list, rather than an empty card waiting for a click it may never get.
 *
 * TAUGHT WITH DATA, NOT WITH COPY. With no query typed this shows the countries
 * that actually have money in them, ranked, with their totals — which doubles
 * as the answer to "what is this, then?" far better than a sentence would. Type
 * anything and it searches all 238 countries the globe can draw, claimed or
 * not, because an unclaimed country is the most interesting thing on the board
 * for the person about to claim it.
 */

import { useMemo, useState, type Ref } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'

import { cn } from '../../../lib/utils'
import worldApi, { type BoardRow } from '../../../lib/worldApi'
import { InfoTip, Money, WorldCard, WORLD_FOCUS_CLASS, WORLD_PANEL_SURFACE } from '../ui'
import { countryDisplayName, isoFlag } from '../boards/format'
import { INPUT } from '../claim/styles'
import { matchCountries, nameFor } from './names'

export interface CountryPickerProps {
  /** A country was chosen — the page opens its panel and flies the globe. */
  onSelect: (iso: string) => void
  /** Focus target for the page's "claim a spot" call to action. */
  inputRef?: Ref<HTMLInputElement>
  className?: string
}

/** Rows shown before anybody types. Enough to read as a board, not a directory. */
const RESTING_ROWS = 6

/** Stable empty board, so the two memos below do not churn on every render. */
const NO_ROWS: BoardRow[] = []

export function CountryPicker({ onSelect, inputRef, className }: CountryPickerProps) {
  const [query, setQuery] = useState('')

  // The same query key the podium and the stats strip use, so all three share
  // one request and one cache entry.
  const boardQuery = useQuery({
    queryKey: ['world', 'board', 'richest', 'world'],
    queryFn: () => worldApi.getBoard('richest', 'world').then((r) => r.data),
    staleTime: 30_000,
  })

  const claimed = boardQuery.data?.rows ?? NO_ROWS
  const totalsByIso = useMemo(() => {
    const map = new Map<string, { rank: number; cents: number }>()
    for (const row of claimed) {
      if (row.iso) map.set(row.iso.toUpperCase(), { rank: row.rank, cents: row.total_cents })
    }
    return map
  }, [claimed])

  const results = useMemo(() => {
    if (query.trim() === '') {
      return claimed.slice(0, RESTING_ROWS).map((row) => ({
        iso: (row.iso ?? '').toUpperCase(),
        name: countryDisplayName(row.iso, row.name),
      }))
    }
    return matchCountries(query, RESTING_ROWS).shown.map((c) => ({ iso: c.iso, name: c.name }))
  }, [query, claimed])

  const searching = query.trim() !== ''

  return (
    <WorldCard
      as="section"
      aria-label="Pick a country"
      flat
      className={cn('flex min-h-0 flex-col overflow-hidden', WORLD_PANEL_SURFACE, className)}
    >
      <div className="border-b border-border px-3.5 py-3">
        <p className="mb-2 flex items-center justify-between gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Pick a country
          <InfoTip label="How claiming works" align="end">
            Click a country on the globe or pick one here, then stake on it. Whoever has the most
            staked in a country is #1 there.
          </InfoTip>
        </p>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            // A real country, not the word "Search". The placeholder is the
            // example; there is no instructional sentence under this field.
            placeholder="kenya"
            aria-label="Search countries"
            className={cn(INPUT, 'min-h-[2.25rem] py-1.5 pl-8 text-xs')}
          />
        </div>
      </div>

      <div className="world-scroll-list min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {results.length === 0 ? (
          <p className="px-3.5 py-4 text-xs leading-snug text-muted-foreground">
            {searching ? (
              <>No country called “{query.trim()}”. Try “kenya”.</>
            ) : boardQuery.isPending ? (
              <span role="status">Loading the board…</span>
            ) : (
              // A genuinely empty planet. Say so, and point at the search that
              // still works — never an empty box with no way out of it.
              <>Nothing claimed anywhere yet. Search for a country and take the first one.</>
            )}
          </p>
        ) : (
          <ul className="flex flex-col">
            {results.map((row) => {
              const standing = totalsByIso.get(row.iso) ?? null
              return (
                <li key={row.iso}>
                  <button
                    type="button"
                    onClick={() => onSelect(row.iso)}
                    className={cn(
                      WORLD_FOCUS_CLASS,
                      'group flex w-full cursor-pointer items-center gap-2.5 border-b border-border/50 px-3.5 py-2',
                      'text-left transition-colors duration-150 last:border-b-0',
                      'hover:bg-[#FB651E]/[0.05] motion-reduce:transition-none',
                    )}
                  >
                    <span aria-hidden className="shrink-0 text-base leading-none">
                      {isoFlag(row.iso)}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold transition-colors group-hover:text-[#FB651E]">
                      {row.name || nameFor(row.iso)}
                    </span>
                    {standing ? (
                      <span className="flex shrink-0 items-baseline gap-1.5">
                        <span className="world-num text-[11px] text-muted-foreground">
                          #{standing.rank}
                        </span>
                        <Money cents={standing.cents} score className="text-xs sm:text-xs" />
                      </span>
                    ) : (
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                        unclaimed
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </WorldCard>
  )
}

export default CountryPicker
