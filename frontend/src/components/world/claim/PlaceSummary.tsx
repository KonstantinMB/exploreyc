// Step one of the claim wizard: where the plot goes — as a SUMMARY.
//
// Ported from startupworld's claim/PlacePicker.tsx, minus the typeahead: in
// ExploreYC the actual picking happens on the globe page, which re-opens the
// flow with coordinates. This component's job is to echo the chosen point back
// IN WORDS (never a bare coordinate — "22.80°, 79.53°" tells a buyer nothing)
// via the server's own `/api/world/where` resolver, so the label is a preview
// of what will be stored rather than a browser's second opinion about it.

import { Loader2, MapPin, Pencil } from 'lucide-react'

import { cn } from '../../../lib/utils'
import type { WhereResponse } from '../../../lib/worldApi'

export type PlaceState =
  | { kind: 'none' }
  | { kind: 'locating'; lat: number; lng: number }
  | { kind: 'ocean'; lat: number; lng: number }
  | { kind: 'error'; lat: number; lng: number }
  | { kind: 'resolved'; lat: number; lng: number; where: WhereResponse }

/** A point, in words. */
export function placeLabel(where: WhereResponse): string {
  if (where.city_name) return `${where.city_name}, ${where.country_name}`
  return where.country_name
}

export interface PlaceSummaryProps {
  place: PlaceState
  /** The page owns the globe; this asks it to enter pick mode. */
  onNeedPick?: () => void
  /** Hidden for seed claims, where the point is the company's and fixed. */
  canChange?: boolean
}

const CARD =
  'flex items-start gap-3 rounded-sm border border-border/80 bg-card/50 p-3 font-mono'

export function PlaceSummary({ place, onNeedPick, canChange = true }: PlaceSummaryProps) {
  const changeButton =
    canChange && onNeedPick ? (
      <button
        type="button"
        onClick={onNeedPick}
        className={cn(
          'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-3',
          'font-mono text-xs transition-colors hover:border-[#FB651E]/60 hover:text-[#FB651E]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'ring-offset-background',
        )}
      >
        <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
        Change
      </button>
    ) : null

  if (place.kind === 'none') {
    return (
      <div className="flex flex-col gap-2 font-mono">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Where</span>
        <div className={cn(CARD, 'flex-col items-stretch gap-3')}>
          <p className="text-sm leading-snug text-muted-foreground">
            No point chosen yet. Pick one by clicking anywhere on the globe.
          </p>
          {onNeedPick ? (
            <button
              type="button"
              onClick={onNeedPick}
              className={cn(
                'inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#FB651E] px-4',
                'font-mono text-sm font-medium text-white transition-colors hover:bg-[#E65C00]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'ring-offset-background',
              )}
            >
              <MapPin aria-hidden="true" className="h-4 w-4" />
              Pick a point on the globe
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 font-mono">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">Your plot</span>

      <div className={CARD}>
        <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#FB651E]" />

        <div className="flex min-w-0 flex-1 flex-col gap-1" aria-live="polite">
          {place.kind === 'locating' ? (
            <span role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              Locating…
            </span>
          ) : place.kind === 'ocean' ? (
            <>
              <span className="text-sm font-medium text-foreground">Open water</span>
              <span className="text-xs leading-snug text-red-500">
                That point is at sea, and plots only go on land. Pick a point inside a country.
              </span>
            </>
          ) : place.kind === 'error' ? (
            <>
              <span className="text-sm font-medium text-foreground">A point on Earth</span>
              <span className="text-xs leading-snug text-muted-foreground">
                We could not name this point right now. Its country is settled at checkout either
                way.
              </span>
            </>
          ) : (
            <>
              <span className="truncate text-sm font-medium text-foreground">
                {placeLabel(place.where)}
              </span>
              {/* Whether the pin is close enough to a city to compete on a
                  city board — the cheapest #1 in the product, and the whole
                  reason the 50 km snap radius exists. */}
              <span className="text-xs leading-snug text-muted-foreground">
                {place.where.city_name
                  ? 'Close enough to compete on this city’s board.'
                  : 'No city within range — this one scores for the country.'}
              </span>
            </>
          )}
        </div>

        {changeButton}
      </div>
    </div>
  )
}
