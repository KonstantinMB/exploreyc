/**
 * The two camera tools the retiring deck.gl map had, as page furniture.
 *
 * `tour.ts` built both mechanisms — `GLOBE_REGIONS` / `focusRegion` for the
 * jumps, `useHubTour` for the flight around the places companies cluster — and
 * left the controls to whoever owned the page, because a rail of buttons has no
 * business importing three.js. This is that rail. It renders in the page's own
 * chunk: everything below comes from `globe/tour` and `globe/hubs`, which are
 * deliberately three-free, and nothing here reaches through `globe/index.ts`.
 *
 * WHY IT SITS TOP-RIGHT AND STAYS SMALL. The brief for the merged globe is an
 * advertisement, and exploration tools are not the advertisement — the plots
 * people bought are. So the corner opposite the headline gets one row of
 * region chips and one tour button, in the same pill vocabulary as the rest of
 * the World, and neither of them ever grows into a panel. The hub card that
 * replaces the button during a tour is the only thing here that is bigger than
 * a chip, and it exists because a camera that flies somewhere without saying
 * where it went is a glitch rather than a tour.
 *
 * ONE FOCUS STATE. Every control writes a fresh `GlobeFocusPoint` through the
 * same `onFocus` the page owns; the globe re-arms its flight from the object's
 * identity. Nothing here holds a camera position of its own, so there is no
 * second source of truth to disagree with the first.
 */

import { WorldButton, WorldCard, WorldChip, WORLD_FOCUS_CLASS } from '../ui'
import { cn } from '../../../lib/utils'
import { GLOBE_REGIONS, focusRegion, type GlobeFocusPoint, type HubTour } from './tour'

export interface GlobeControlsProps {
  /** Where the camera should go next. Always a fresh object. */
  onFocus: (focus: GlobeFocusPoint) => void
  /** The tour the page owns, from `useHubTour`. */
  tour: HubTour
  className?: string
}

/** Tabular integer, so the counts in the hub card do not jitter between stops. */
function Count({ n }: { n: number }) {
  return <span className="world-num">{n.toLocaleString('en-US')}</span>
}

export function GlobeControls({ onFocus, tour, className }: GlobeControlsProps) {
  return (
    <div className={cn('flex flex-col items-end gap-2', className)}>
      <div
        role="group"
        aria-label="Jump to a region"
        className="flex items-center gap-0.5 rounded-sm border border-border/80 bg-card/80 p-1 backdrop-blur-sm dark:border-white/10"
      >
        {GLOBE_REGIONS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => {
              // A manual camera move ends the tour, exactly as a drag does —
              // otherwise the next dwell yanks the visitor back off the region
              // they just asked for.
              tour.stop()
              onFocus(focusRegion(r))
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5',
              'text-xs font-semibold text-foreground',
              'transition-colors hover:bg-[#FB651E]/[0.05] motion-reduce:transition-none',
              WORLD_FOCUS_CLASS
            )}
          >
            <span aria-hidden>{r.flag}</span>
            {r.name}
          </button>
        ))}
      </div>

      {tour.hubs.length === 0 ? null : tour.active && tour.hub ? (
        <WorldCard
          className="w-[15.5rem] px-3 py-2.5"
          aria-live="polite"
          aria-atomic="true"
        >
          <WorldChip tone="accent" className="mb-1.5">
            Stop {tour.index + 1} of {tour.hubs.length}
          </WorldChip>
          <p className="truncate text-sm font-bold leading-tight tracking-tight text-foreground">
            {tour.hub.name}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            <Count n={tour.hub.count} /> companies · <Count n={tour.hub.hiringCount} /> hiring
            {tour.hub.topIndustry === '—' ? null : <> · mostly {tour.hub.topIndustry}</>}
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <WorldButton variant="secondary" size="sm" onClick={tour.stop}>
              Stop tour
            </WorldButton>
            <WorldButton variant="ghost" size="sm" onClick={tour.next}>
              Next
            </WorldButton>
          </div>
        </WorldCard>
      ) : (
        <WorldButton variant="secondary" size="sm" onClick={tour.start}>
          Tour the hubs
        </WorldButton>
      )}
    </div>
  )
}

export default GlobeControls
