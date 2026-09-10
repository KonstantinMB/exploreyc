import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { CITY_SNAP_RADIUS_KM } from '../constants'
import type { GlobePin } from '../../../lib/worldApi'
import { haversineKm, latLngToVector3 } from './geo'

/**
 * The city gazetteer, and the pin→city snap that two layers now share.
 *
 * All of this used to live inside `CityLabels.tsx`, which was fine while the
 * only consumer was the name layer. The density view is the second consumer —
 * it draws one disc per city, sized by how many pins snapped to it — and two
 * copies of a 7,328-row typed-array build, a 360 kB fetch and a bucket-grid
 * search is exactly the kind of duplication that drifts. So the data moved and
 * the layers stayed.
 *
 * Nothing about the algorithms changed in the move: same tuple/record tolerance,
 * same one-fetch-per-page-load cache, same 2° bucket grid with a wrapping
 * longitude index, same `CITY_SNAP_RADIUS_KM` the database itself snaps with.
 */

export interface CityIndex {
  count: number
  names: string[]
  iso2: string[]
  /** Label ids, built once. Building them per frame is 7,328 strings a frame. */
  ids: string[]
  /** Unit surface directions, xyz-interleaved. */
  dirs: Float32Array
  lat: Float32Array
  lng: Float32Array
  population: Float32Array
  /** `log10(population + 1)`, which is the quantity every threshold uses. */
  logPopulation: Float32Array
}

/** Tuple row exactly as the donor shipped it. */
type CityTuple = [number, string, string, number, number, number]

/** Object row, in case the ExploreYC backend serialises cities as records. */
interface CityRecord {
  id: number
  name: string
  country_iso: string
  lat: number
  lng: number
  population: number
}

interface CitiesPayload {
  cities: Array<CityTuple | CityRecord>
}

let cached: CityIndex | null = null
let inflight: Promise<CityIndex | null> | null = null

function toTuple(row: CityTuple | CityRecord): CityTuple {
  if (Array.isArray(row)) return row
  return [row.id, row.name, row.country_iso, row.lat, row.lng, row.population]
}

function build(payload: CitiesPayload): CityIndex {
  const rows = payload.cities.map(toTuple)
  const count = rows.length

  const index: CityIndex = {
    count,
    names: new Array<string>(count),
    iso2: new Array<string>(count),
    ids: new Array<string>(count),
    dirs: new Float32Array(count * 3),
    lat: new Float32Array(count),
    lng: new Float32Array(count),
    population: new Float32Array(count),
    logPopulation: new Float32Array(count),
  }

  const v = new THREE.Vector3()
  for (let i = 0; i < count; i += 1) {
    const row = rows[i]
    index.names[i] = row[1]
    index.iso2[i] = row[2]
    index.ids[i] = `c${row[0]}`
    index.lat[i] = row[3]
    index.lng[i] = row[4]
    index.population[i] = row[5]
    index.logPopulation[i] = Math.log10(row[5] + 1)

    v.copy(latLngToVector3(row[3], row[4], 1))
    index.dirs[i * 3] = v.x
    index.dirs[i * 3 + 1] = v.y
    index.dirs[i * 3 + 2] = v.z
  }

  return index
}

/**
 * One fetch per page load, shared by every mount.
 *
 * `force-cache` on top of the route's year-long `immutable` header: a soft
 * reload, a route change back to the globe, or a second globe on the page all
 * read from the HTTP cache rather than the network. The set does not change at
 * runtime, so there is nothing to revalidate.
 */
export function loadCities(): Promise<CityIndex | null> {
  if (cached) return Promise.resolve(cached)
  if (inflight) return inflight

  inflight = fetch('/api/world/cities', { cache: 'force-cache' })
    .then((response) => {
      if (!response.ok) throw new Error(`cities ${response.status}`)
      return response.json() as Promise<CitiesPayload>
    })
    .then((payload) => {
      cached = build(payload)
      return cached
    })
    .catch((error: unknown) => {
      // A globe with no city names is a globe. Log it, let the retry happen on
      // the next mount, and do not break the scene over a label layer.
      console.warn('[globe] city index unavailable', error)
      inflight = null
      return null
    })

  return inflight
}

/**
 * Loads the city index after first paint, never before.
 *
 * 360kB of JSON and a 7,328-row typed-array build are not allowed anywhere
 * near the frames that decide whether this page feels fast. `requestIdleCallback`
 * puts both in the first gap after the globe is up; the timeout is the promise
 * that "idle" cannot mean "never".
 */
export function useCityIndex(enabled: boolean): CityIndex | null {
  const [index, setIndex] = useState<CityIndex | null>(cached)

  useEffect(() => {
    if (!enabled || index) return undefined

    let alive = true
    const start = () => {
      void loadCities().then((loaded) => {
        if (alive && loaded) setIndex(loaded)
      })
    }

    const idle =
      typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback(start, { timeout: 1500 })
        : null

    if (idle === null) {
      const timer = window.setTimeout(start, 250)
      return () => {
        alive = false
        window.clearTimeout(timer)
      }
    }

    return () => {
      alive = false
      window.cancelIdleCallback?.(idle)
    }
  }, [enabled, index])

  return index
}

// ---------------------------------------------------------------------------
// Pins per city
// ---------------------------------------------------------------------------

/** Grid cell for the plot→city search, in degrees. */
const CELL_DEG = 2
const LAT_CELLS = Math.ceil(180 / CELL_DEG)
const LNG_CELLS = Math.ceil(360 / CELL_DEG)

function cellOf(lat: number, lng: number): number {
  const a = Math.min(LAT_CELLS - 1, Math.max(0, Math.floor((lat + 90) / CELL_DEG)))
  const b = ((Math.floor((lng + 180) / CELL_DEG) % LNG_CELLS) + LNG_CELLS) % LNG_CELLS
  return a * LNG_CELLS + b
}

/** The 2° bucket grid, built once per index and reused by every snap. */
function bucketCities(index: CityIndex): Map<number, number[]> {
  const buckets = new Map<number, number[]>()
  for (let i = 0; i < index.count; i += 1) {
    const key = cellOf(index.lat[i], index.lng[i])
    const bucket = buckets.get(key)
    if (bucket === undefined) buckets.set(key, [i])
    else bucket.push(i)
  }
  return buckets
}

/**
 * Nearest city to (lat, lng) within `CITY_SNAP_RADIUS_KM`, or -1.
 *
 * Brute force is 7,328 × the pin count, which at 5,579 pins is 41 million
 * distance calculations — about a second of the main thread, on the wrong
 * thread, at the wrong time. A 2° bucket grid with a 3×3 neighbourhood search
 * brings it to a few hundred thousand. The longitude index wraps, or every pin
 * in the Pacific quietly loses its city.
 */
function snapToCity(
  index: CityIndex,
  buckets: Map<number, number[]>,
  lat: number,
  lng: number,
): number {
  const a = Math.min(LAT_CELLS - 1, Math.max(0, Math.floor((lat + 90) / CELL_DEG)))
  const b = Math.floor((lng + 180) / CELL_DEG)

  let best = CITY_SNAP_RADIUS_KM
  let bestIndex = -1

  for (let da = -1; da <= 1; da += 1) {
    const aa = a + da
    if (aa < 0 || aa >= LAT_CELLS) continue
    for (let db = -1; db <= 1; db += 1) {
      const bb = (((b + db) % LNG_CELLS) + LNG_CELLS) % LNG_CELLS
      const bucket = buckets.get(aa * LNG_CELLS + bb)
      if (bucket === undefined) continue
      for (let k = 0; k < bucket.length; k += 1) {
        const c = bucket[k]
        const km = haversineKm(lat, lng, index.lat[c], index.lng[c])
        if (km < best) {
          best = km
          bestIndex = c
        }
      }
    }
  }

  return bestIndex
}

/**
 * How many plots each city holds, using the same snap radius the database uses.
 *
 * Unchanged in behaviour from the version that lived in `CityLabels.tsx`: hand
 * it PAID pins and it returns the contested-city counts the name layer boosts
 * and labels with. Hand it everything and it counts everything — which is what
 * the density layer wants, and why `countPinsPerCity` below exists rather than
 * two calls to this.
 */
export function countPlotsPerCity(
  index: CityIndex,
  plots: readonly GlobePin[],
): Uint16Array {
  const counts = new Uint16Array(index.count)
  if (plots.length === 0) return counts

  const buckets = bucketCities(index)
  for (let p = 0; p < plots.length; p += 1) {
    const plot = plots[p]
    const c = snapToCity(index, buckets, plot.lat, plot.lng)
    if (c >= 0 && counts[c] < 65535) counts[c] += 1
  }

  return counts
}

/** Both counts a city can carry, from one pass over the pins. */
export interface CityPinCounts {
  /** Every pin that snapped to the city, paid and imported alike. */
  total: Uint16Array
  /** …of which somebody paid for these. */
  paid: Uint16Array
  /** Largest `total` on the board, so a caller can scale without a second pass. */
  max: number
  /** Cities with at least one pin. The density layer only draws these. */
  occupied: number[]
}

/**
 * Total and paid pin counts per city, in one pass.
 *
 * The split is the whole point of the density layer: a city with money in it is
 * drawn in the accent and a city with only imported listings is drawn in slate,
 * so a glance at the aggregate still answers "where has anyone actually paid".
 * Two calls to `countPlotsPerCity` would rebuild the 7,328-entry bucket grid
 * twice and walk the pins twice for an answer one pass already has.
 */
export function countPinsPerCity(
  index: CityIndex,
  pins: readonly GlobePin[],
): CityPinCounts {
  const total = new Uint16Array(index.count)
  const paid = new Uint16Array(index.count)
  if (pins.length === 0) return { total, paid, max: 0, occupied: [] }

  const buckets = bucketCities(index)
  for (let p = 0; p < pins.length; p += 1) {
    const pin = pins[p]
    const c = snapToCity(index, buckets, pin.lat, pin.lng)
    if (c < 0) continue
    if (total[c] < 65535) total[c] += 1
    if (pin.kind === 'plot' && paid[c] < 65535) paid[c] += 1
  }

  let max = 0
  const occupied: number[] = []
  for (let i = 0; i < index.count; i += 1) {
    if (total[i] === 0) continue
    occupied.push(i)
    if (total[i] > max) max = total[i]
  }

  return { total, paid, max, occupied }
}
