/**
 * "112 countries live · $1,920 in bids" — the reference's top-right corner.
 *
 * Both figures are read off ONE request, the world-scope richest board, which
 * the podium and the country picker are already using: its rows are exactly the
 * countries that have at least one active plot in them, and each carries that
 * country's total. So "countries live" is a row count and "in bids" is a sum,
 * and neither is a number this component made up.
 *
 * ONE HONEST WRINKLE, handled rather than hidden. `get_world_country_board`
 * takes a `limit` of 100. If the board ever fills, the row count and the sum
 * are both floors rather than totals — so at exactly 100 rows both figures
 * render with a "+". A number that might be short is labelled as such; it is
 * not quietly presented as the whole truth.
 */

import { useQuery } from '@tanstack/react-query'
import { Globe2 } from 'lucide-react'

import { cn } from '../../../lib/utils'
import worldApi from '../../../lib/worldApi'
import { formatDollars } from '../constants'
import { InfoTip, WORLD_OVERLAY_PILL } from '../ui'

/** The server's own page size for the country board (backend/database.py). */
const BOARD_LIMIT = 100

export function WorldStats({ className }: { className?: string }) {
  const { data } = useQuery({
    queryKey: ['world', 'board', 'richest', 'world'],
    queryFn: () => worldApi.getBoard('richest', 'world').then((r) => r.data),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const rows = data?.rows ?? []
  // Nothing to boast about yet, and a strip reading "0 countries · $0" over an
  // empty globe is worse than no strip at all.
  if (rows.length === 0) return null

  const capped = rows.length >= BOARD_LIMIT
  const total = rows.reduce((sum, row) => sum + (row.total_cents ?? 0), 0)
  const plus = capped ? '+' : ''

  return (
    // One of the overlay pills — same height, padding, radius and skin as the
    // region rail above it and the Layers trigger opposite. See
    // WORLD_OVERLAY_PILL in ../ui.
    <div aria-label="World totals" className={cn(WORLD_OVERLAY_PILL, className)}>
      <Globe2 aria-hidden className="h-3.5 w-3.5 shrink-0 text-[#FB651E]" />
      <p className="font-mono text-[11px] leading-tight">
        <span className="world-num font-bold text-foreground">
          {rows.length.toLocaleString('en-US')}
          {plus}
        </span>{' '}
        <span className="text-muted-foreground">countries live</span>
        <span aria-hidden className="mx-1.5 text-muted-foreground">
          ·
        </span>
        <span className="world-num font-bold text-[#FB651E]">
          {formatDollars(total)}
          {plus}
        </span>{' '}
        <span className="text-muted-foreground">in bids</span>
      </p>
      <InfoTip label="Where these numbers come from" align="end">
        Countries with at least one plot in them, and everything staked across
        {capped ? ' the top 100 of them' : ' all of them'}. Updated every minute.
      </InfoTip>
    </div>
  )
}

export default WorldStats
