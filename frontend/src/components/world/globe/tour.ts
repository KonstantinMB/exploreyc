import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GlobePin } from '../../../lib/worldApi'
import { computeHubs, type Hub } from './hubs'
import { CAMERA_MAX_DISTANCE, CAMERA_MIN_DISTANCE } from './labelLayout'

/**
 * The two camera tools the deck.gl map had: jump to a region, and tour the hubs.
 *
 * **Import this module by path, never through `globe/index.ts`.** The barrel
 * pulls `WorldGlobe`, which pulls three.js at module scope; everything in here
 * is arithmetic, React and a type import, so a page can hold the tour state, the
 * region rail and the stats card without any of the engine reaching the main
 * bundle. That separation is the whole reason this is its own file.
 *
 * Neither tool moves a camera itself. Both produce a `GlobeFocusPoint`, which is
 * what `WorldGlobe`'s `focus` prop already accepts — so the page keeps ONE focus
 * state, whoever wrote it last wins, and there is no second code path that can
 * disagree with the first about where the camera is.
 */

/** A coordinate for `WorldGlobe`'s `focus` prop. */
export interface GlobeFocusPoint {
  lat: number
  lng: number
  /** Camera distance from the globe centre on arrival, in globe radii. */
  distance?: number
}

// ---------------------------------------------------------------------------
// Mercator zoom → globe camera distance
// ---------------------------------------------------------------------------

/**
 * The conversion constant, derived rather than tuned.
 *
 * The 2D map framed everything in Web Mercator zoom levels, and those numbers
 * are the only record of how each region was meant to look — so they are kept,
 * and converted, instead of being replaced by fresh guesses.
 *
 * At Mercator zoom `z` the world is `512 * 2^z` px tall, so a 700px viewport
 * shows `700 / (512 * 2^z)` of it — about `492 / 2^z` degrees of latitude at the
 * equator. On the globe, a perspective camera with a 38° vertical field of view
 * at distance `d` (globe radius 1) sees a band roughly `2 * (d - 1) * tan(19°)`
 * radii tall, which is `39.45 * (d - 1)` degrees of arc. Setting the two equal:
 *
 *     d = 1 + (492 / 39.45) / 2^z = 1 + 12.475 / 2^z
 *
 * Two consequences worth knowing before reaching for this function:
 *
 *  - **The globe cannot reach the 2D map's close zooms.** Its floor of 1.09
 *    inverts to about z 7.1, so `DeckMap`'s `LOGO_ZOOM = 9` has no globe
 *    equivalent at all. Logo markers therefore have thresholds chosen for this
 *    camera (see `LogoMarkers`), not converted ones.
 *  - **World view saturates.** The map's z 1.6 inverts to 5.11, past the 4.8
 *    ceiling, so "World" simply means "as far out as this camera goes".
 */
const MERCATOR_ARC_CONSTANT = 12.475

/** Web Mercator zoom → the globe camera distance that frames the same ground. */
export function mercatorZoomToDistance(zoom: number): number {
  if (!Number.isFinite(zoom)) return CAMERA_MAX_DISTANCE
  const d = 1 + MERCATOR_ARC_CONSTANT / Math.pow(2, zoom)
  if (d < CAMERA_MIN_DISTANCE) return CAMERA_MIN_DISTANCE
  if (d > CAMERA_MAX_DISTANCE) return CAMERA_MAX_DISTANCE
  return d
}

export interface GlobeRegion {
  /** Stable key for lists and for a pressed state. */
  id: string
  /** The label as it reads on a button. Sentence case, no glyph. */
  name: string
  /**
   * The flag, kept separate from the name.
   *
   * The 2D map baked it into the string ("🇺🇸 US"), which meant a screen reader
   * announced "flag: United States, US" and the button could not be rendered
   * without it. Separated, the page decides — and an `aria-hidden` span is the
   * obvious way to render it.
   */
  flag: string
  lat: number
  lng: number
  /** The framing this region had on the 2D map, kept for provenance. */
  mercatorZoom: number
  /** …and the same framing as a globe camera distance. */
  distance: number
}

function region(
  id: string,
  name: string,
  flag: string,
  lat: number,
  lng: number,
  mercatorZoom: number,
): GlobeRegion {
  return {
    id,
    name,
    flag,
    lat,
    lng,
    mercatorZoom,
    distance: mercatorZoomToDistance(mercatorZoom),
  }
}

/**
 * The four jumps, ported coordinate-for-coordinate from `WorldMap.tsx`.
 *
 * Same centres, same framings — a visitor who knew the old map lands in the same
 * place. The order is deliberate too: the three regions first, "World" last, so
 * the way back out is where a back control would be.
 */
export const GLOBE_REGIONS: readonly GlobeRegion[] = [
  region('us', 'US', '🇺🇸', 37.09, -95.71, 3.6),
  region('europe', 'Europe', '🇪🇺', 50.0, 10.0, 3.6),
  region('asia', 'Asia', '🌏', 25.0, 95.0, 3.0),
  region('world', 'World', '🌍', 20.0, 0.0, 1.6),
]

/**
 * A region as a focus point — **a fresh object every call, on purpose**.
 *
 * `GlobeScene` re-arms its flight from the identity of the `focus` prop, so
 * pressing "US" twice has to hand it two different objects or the second press
 * does nothing. That is the single easiest thing to get wrong when wiring this
 * up, which is why the helper exists instead of a shared constant to spread.
 */
export function focusRegion(r: GlobeRegion): GlobeFocusPoint {
  return { lat: r.lat, lng: r.lng, distance: r.distance }
}

// ---------------------------------------------------------------------------
// Hub tour
// ---------------------------------------------------------------------------

/**
 * Camera distance a hub is framed at.
 *
 * ~2,200 km of visible arc: the metro plus enough of the country around it to
 * know where on Earth you are. Closer and a tour of eight cities is eight
 * identical views of a pin cluster; further and it is eight views of a continent.
 */
export const HUB_TOUR_DISTANCE = 1.5

/** Dwell on each hub, in milliseconds. The 2D map's `TOUR_STEP_MS`. */
export const HUB_TOUR_STEP_MS = 4000

export interface HubTourOptions {
  /**
   * Called once per jump with a fresh focus point. The page feeds this straight
   * into its own `focus` state, which is also where region jumps and the claim
   * flow's city search write — one state, one source of truth for the camera.
   */
  onJump?: (focus: GlobeFocusPoint) => void
  stepMs?: number
  distance?: number
  /** How many hubs the tour visits. `computeHubs`' own default is 8. */
  topN?: number
}

export interface HubTour {
  active: boolean
  /** Every hub the tour would visit, ranked. Useful for a "8 stops" readout. */
  hubs: Hub[]
  /** The hub currently on screen, or null when the tour is not running. */
  hub: Hub | null
  /** Its position in `hubs`, or -1. */
  index: number
  start(): void
  stop(): void
  toggle(): void
  /** Skip ahead. Resets the dwell timer, as a manual advance should. */
  next(): void
}

/**
 * Fly the camera around the places companies actually cluster.
 *
 * The schedule lives here; the camera does not. Each jump is one call to
 * `onJump` with a NEW focus object — identity is what re-arms the flight — and
 * the dwell timer is re-armed per stop rather than run as a free-standing
 * interval, so a manual `next()` gets a full dwell rather than whatever was left
 * of the previous one.
 *
 * **Feed it unjittered pins.** `computeHubs` averages coordinates to place a
 * hub and names it from the most frequent `location` string in the cell; the
 * ~7 km seed jitter is a rendering trick and averaging it in would drift a hub
 * off the city it is named after. The page's query result is exactly the right
 * input — paid plots are never jittered at all.
 */
export function useHubTour(
  pins: readonly GlobePin[],
  options: HubTourOptions = {},
): HubTour {
  const {
    onJump,
    stepMs = HUB_TOUR_STEP_MS,
    distance = HUB_TOUR_DISTANCE,
    topN = 8,
  } = options

  const hubs = useMemo(() => computeHubs(pins, topN), [pins, topN])
  const [index, setIndex] = useState<number | null>(null)

  // Read through a ref so a page that passes an inline arrow does not restart
  // the tour's timer on every render. Mirrored in an effect with no dependency
  // array rather than assigned during render — this effect runs before the one
  // below it, so a jump always calls the newest handler.
  const jumpRef = useRef(onJump)
  useEffect(() => {
    jumpRef.current = onJump
  })

  useEffect(() => {
    // Nothing to tour — a globe with no pins, or a filter that emptied it. The
    // tour holds rather than cancels: `hubs` is a dependency, so if a filter
    // puts companies back on the map it picks up where it left off. (Cancelling
    // would also mean a setState inside an effect body, which is a cascading
    // render for a state the caller can already see through `active`.)
    if (index === null || hubs.length === 0) return undefined

    const hub = hubs[index % hubs.length]
    jumpRef.current?.({
      lat: hub.latitude,
      lng: hub.longitude,
      distance,
    })

    const timer = window.setTimeout(() => {
      setIndex((current) =>
        current === null ? null : (current + 1) % hubs.length,
      )
    }, stepMs)
    return () => window.clearTimeout(timer)
  }, [index, hubs, distance, stepMs])

  const start = useCallback(() => setIndex(0), [])
  const stop = useCallback(() => setIndex(null), [])
  const toggle = useCallback(
    () => setIndex((current) => (current === null ? 0 : null)),
    [],
  )
  const next = useCallback(
    () => setIndex((current) => (current === null ? 0 : current + 1)),
    [],
  )

  const active = index !== null && hubs.length > 0
  return {
    active,
    hubs,
    hub: active ? hubs[(index as number) % hubs.length] : null,
    index: active ? (index as number) % hubs.length : -1,
    start,
    stop,
    toggle,
    next,
  }
}
