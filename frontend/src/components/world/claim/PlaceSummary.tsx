// Step one of the claim wizard: where the plot goes.
//
// THIS IS THE ONLY SPOT-PICKING SURFACE. It used to be one of two: the page
// floated a card over the top-left of the globe carrying its own heading, its
// own "nothing chosen yet" readout, its own instruction AND its own city search
// field, while this step showed the same heading, the same readout, the same
// instruction and a big orange button whose entire job was to move focus back
// into that other field. Two panels for one decision, and the loudest control
// on the screen was a button competing with the input it pointed at.
//
// So the picking lives here now, in the wizard, because that is step 1 of the
// flow and where the eye already is:
//
//   - the city search INLINE (the field itself, not a button that reveals one)
//   - the chosen-spot readout, in words
//
// The globe keeps exactly one thing: a small, non-interactive hint saying it
// can be clicked. That is the only other sentence about choosing anywhere on
// the page.
//
// The search is not a convenience. You cannot click a WebGL sphere with a
// keyboard, so this combobox is the only keyboard route into the whole claim
// flow — it keeps its full ARIA 1.2 behaviour (arrow keys, Enter, Escape).
//
// The label is always resolved through the server's own /api/world/where, so it
// previews what will actually be stored rather than offering a browser's second
// opinion. Never a bare coordinate: "22.80°, 79.53°" tells a buyer nothing.

import { AlertCircle, Loader2, MapPin } from 'lucide-react'

import { cn } from '../../../lib/utils'
import type { WhereResponse } from '../../../lib/worldApi'
import { WorldCard, WorldHeading } from '../ui'
import { HINT, SANS } from './styles'
import { CitySearch } from './CitySearch'
import type { City } from './cityIndex'

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
  /**
   * A city was chosen from the search. The page owns the globe and the
   * coordinate, so it hears about it here and treats it exactly like a globe
   * click — same geography check, same flight, same readout.
   *
   * Omitted for seed claims, where the coordinate is the company's and fixed;
   * the search is then not rendered at all rather than rendered inert.
   */
  onPickCity?: (point: { lat: number; lng: number }) => void
}

const ICON_WELL =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-[#FB651E]/30 bg-[#FB651E]/[0.08] text-[#FB651E]'

export function PlaceSummary({ place, onPickCity }: PlaceSummaryProps) {
  return (
    <div className="flex flex-col gap-4" style={SANS}>
      <WorldHeading level={3}>Choose your spot</WorldHeading>

      {onPickCity ? (
        <CitySearch
          label="Search for a city"
          resultsPlacement="inline"
          onSelect={(city: City) => onPickCity({ lat: city.lat, lng: city.lng })}
        />
      ) : null}

      {/* The readout. State only — no instruction lives in here, because the
          field above and the hint on the globe have already said everything
          there is to say about how to choose.

          Nothing chosen yet is a LINE, not a card. An empty state has no
          business being the biggest object on the step, and on a 375px phone
          the 78px card was what pushed this step past the bottom sheet and got
          itself sliced in half by the footer. It grows into the card the moment
          there is something to put in it. */}
      {place.kind === 'none' ? (
        <p
          aria-live="polite"
          className="flex items-center gap-2.5 text-sm font-semibold text-muted-foreground"
        >
          <MapPin aria-hidden="true" className="h-[1.125rem] w-[1.125rem] shrink-0" />
          No spot chosen yet
        </p>
      ) : (
      <WorldCard flat className="flex items-start gap-3.5 p-4" aria-live="polite">
        <span className={ICON_WELL} aria-hidden="true">
          {place.kind === 'locating' ? (
            <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />
          ) : place.kind === 'ocean' ? (
            <AlertCircle className="h-5 w-5" />
          ) : (
            <MapPin className="h-5 w-5" />
          )}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {place.kind === 'locating' ? (
            <span
              role="status"
              className="text-base font-bold leading-tight text-foreground"
            >
              Checking that spot…
            </span>
          ) : place.kind === 'ocean' ? (
            <>
              <span className="text-base font-bold leading-tight text-foreground">
                That is open water
              </span>
              <span className={cn(HINT, 'font-semibold text-[#FB651E]')}>
                Plots only go on land — try again inside a country.
              </span>
            </>
          ) : place.kind === 'error' ? (
            <>
              <span className="text-base font-bold leading-tight text-foreground">
                A point on Earth
              </span>
              <span className={HINT}>
                We could not name this point right now. Its country is settled at checkout
                either way.
              </span>
            </>
          ) : (
            <>
              <span className="truncate text-xl font-bold leading-tight text-foreground">
                {placeLabel(place.where)}
              </span>
              {/* Whether the pin is close enough to a city to compete on a
                  city board — the cheapest #1 in the product, and the whole
                  reason the 50 km snap radius exists. */}
              <span className={HINT}>
                {place.where.city_name
                  ? 'Close enough to compete on this city’s board.'
                  : 'No city within range — this one scores for its country.'}
              </span>
            </>
          )}
        </div>
      </WorldCard>
      )}
    </div>
  )
}
