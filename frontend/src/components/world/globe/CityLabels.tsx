/* eslint-disable react-hooks/immutability -- three.js/DOM resources are
   GPU-adjacent objects written imperatively per frame; there is no pure-React
   formulation of that. Same deliberate call as the donor codebase. */
/*
 * Three.js resources and DOM nodes here are written imperatively, per frame;
 * there is no pure-React formulation of that.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { CITY_SNAP_RADIUS_KM } from '../constants'
import type { GlobePin } from '../../../lib/worldApi'
import { haversineKm, latLngToVector3 } from './geo'
import { LOD_TIER_MIN, POP_FADE_DECADES } from './labelLayout'
import {
  LABEL_GAP,
  LABEL_HEIGHT,
  LABEL_LEADER,
  LABEL_PAD_X,
  createBoxPool,
  createLabelPool,
  useLabelLayer,
  useLabelSurface,
  type LabelPool,
} from './useLevelOfDetail'

/**
 * City names, and only names.
 *
 * There used to be a second layer here: a 7,328-instance dot field, one mark
 * for every populated place the camera could see. It was cheap — one draw call,
 * two uniforms per frame — and it was wrong. It speckled every continent with
 * grey confetti that competed with the country fills for attention and, worse,
 * pointed at the wrong noun. This map is about *countries*; a visitor claims a
 * country, hovers a country, buys a country. Seven thousand dots said "look at
 * the cities" over and over on a map where cities are not for sale.
 *
 * What is left is the curated layer: capped, collision-resolved, drawn as HTML,
 * and held back until the camera is close enough that a name is orientation
 * rather than decoration. There is no point drawing more than about a hundred;
 * past that it is not information, it is a hatch pattern made of type.
 *
 * A city holding plots is named earlier than its population alone would earn,
 * and carries its plot count. That is the bridge between the map and the
 * product — a city with plots is a contested city.
 */

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

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
function loadCities(): Promise<CityIndex | null> {
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
function useCityIndex(enabled: boolean): CityIndex | null {
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
// Plots per city
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

/**
 * How many plots each city holds, using the same snap radius the database uses.
 *
 * Brute force is 7,328 × the plot count, which is 88 million distance
 * calculations at the harness's 12,000 plots — about a second of the main
 * thread, on the wrong thread, at the wrong time. A 2° bucket grid with a 3×3
 * neighbourhood search brings it to a few hundred thousand. The longitude index
 * wraps, or every plot in the Pacific quietly loses its city.
 */
function countPlotsPerCity(index: CityIndex, plots: readonly GlobePin[]): Uint16Array {
  const counts = new Uint16Array(index.count)
  if (plots.length === 0) return counts

  const buckets = new Map<number, number[]>()
  for (let i = 0; i < index.count; i += 1) {
    const key = cellOf(index.lat[i], index.lng[i])
    const bucket = buckets.get(key)
    if (bucket === undefined) buckets.set(key, [i])
    else bucket.push(i)
  }

  for (let p = 0; p < plots.length; p += 1) {
    const plot = plots[p]
    const a = Math.min(
      LAT_CELLS - 1,
      Math.max(0, Math.floor((plot.lat + 90) / CELL_DEG)),
    )
    const b = Math.floor((plot.lng + 180) / CELL_DEG)

    let best = CITY_SNAP_RADIUS_KM
    let bestIndex = -1

    for (let da = -1; da <= 1; da += 1) {
      const aa = a + da
      if (aa < 0 || aa >= LAT_CELLS) continue
      for (let db = -1; db <= 1; db += 1) {
        const bb = ((b + db) % LNG_CELLS + LNG_CELLS) % LNG_CELLS
        const bucket = buckets.get(aa * LNG_CELLS + bb)
        if (bucket === undefined) continue
        for (let k = 0; k < bucket.length; k += 1) {
          const c = bucket[k]
          const km = haversineKm(plot.lat, plot.lng, index.lat[c], index.lng[c])
          if (km < best) {
            best = km
            bestIndex = c
          }
        }
      }
    }

    if (bestIndex >= 0 && counts[bestIndex] < 65535) counts[bestIndex] += 1
  }

  return counts
}

/**
 * Effective population, and the importance order that falls out of it.
 *
 * A contested city is promoted — up to four times its own size — so that the
 * place someone actually planted in appears before the anonymous million-person
 * city next door. Bounded at four, because unbounded promotion would put a
 * hamlet with nine plots above Tokyo, and a map that lies about which places
 * are big is not a map.
 *
 * The order array is what lets the per-frame scan break early: cities are
 * walked most-important-first, and the first one under the population floor
 * ends the loop.
 */
function buildOrder(index: CityIndex, counts: Uint16Array) {
  const logEffective = new Float32Array(index.count)
  for (let i = 0; i < index.count; i += 1) {
    const boost = counts[i] > 0 ? Math.min(1 + counts[i] * 0.5, 4) : 1
    logEffective[i] = Math.log10(index.population[i] * boost + 1)
  }

  const order = new Uint32Array(index.count)
  const scratch = new Array<number>(index.count)
  for (let i = 0; i < index.count; i += 1) scratch[i] = i
  scratch.sort((a, b) => logEffective[b] - logEffective[a])
  for (let i = 0; i < index.count; i += 1) order[i] = scratch[i]

  return { logEffective, order }
}

/**
 * Where a name's leader line starts, in globe radii.
 *
 * The dots that used to sit at this radius are gone, but the anchor is not:
 * a city name is still pinned to its place on the surface, and it still has to
 * clear the border lines (1.001) and the country fill (1.0015) so the leader
 * does not begin underneath the ground it points at.
 */
const CITY_ANCHOR_RADIUS = 1.003

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Most city labels offered to the layout in one frame. */
const CITY_CANDIDATES = 320
/** DOM nodes kept for city names. The global cap is 120, so this is all of it. */
const CITY_POOL = 120
/** Skip measuring text for anything this far outside the canvas. */
const OFFSCREEN_SLACK = 80
/** Camera distance, in globe radii, above which no city is named at all. */
const CITY_NAME_DISTANCE = LOD_TIER_MIN.far

export interface CityLabelsProps {
  /** PAID pins only — a seed is not a stake, so it never makes a city
   *  "contested". The caller filters; this layer just counts. */
  plots: readonly GlobePin[]
  enabled?: boolean
}

export function CityLabels({ plots, enabled = true }: CityLabelsProps) {
  const index = useCityIndex(enabled)
  const surface = useLabelSurface()

  const counts = useMemo(
    () => (index ? countPlotsPerCity(index, plots) : null),
    [index, plots],
  )

  const ranking = useMemo(
    () => (index && counts ? buildOrder(index, counts) : null),
    [index, counts],
  )

  // ---- label pool ---------------------------------------------------------

  const poolRef = useRef<LabelPool | null>(null)

  useLayoutEffect(() => {
    if (!surface) return undefined
    const pool = createLabelPool(surface, CITY_POOL, 'city')
    poolRef.current = pool
    return () => {
      poolRef.current = null
      pool.dispose()
    }
  }, [surface])

  /** Which city each slot currently shows, so text is written only on change. */
  const slotCity = useMemo(() => new Int32Array(CITY_POOL).fill(-1), [])
  const slotCount = useMemo(() => new Int32Array(CITY_POOL).fill(-1), [])

  const scratch = useMemo(
    () => ({
      boxes: createBoxPool(),
      idx: [] as number[],
      alpha: [] as number[],
      x: [] as number[],
      y: [] as number[],
    }),
    [],
  )

  useLabelLayer({
    collect(out, frame) {
      const s = scratch
      s.boxes.reset()
      s.idx.length = 0
      s.alpha.length = 0
      s.x.length = 0
      s.y.length = 0

      if (!enabled || !index || !counts || !ranking || !poolRef.current) return

      /*
       * Names are a close-range layer now.
       *
       * With the dot field gone, a handful of city names floating over an empty
       * ocean at world view is the only thing on the globe pointing at cities,
       * and it reads as a mistake rather than as detail. `CITY_NAME_DISTANCE`
       * is the top of the `mid` tier — the same rung at which the urban layer
       * starts to fade in — so names arrive with the ground they belong to.
       */
      if (frame.distance > CITY_NAME_DISTANCE) return

      const { order, logEffective } = ranking
      const { dirs, names, ids } = index
      const logFloor = frame.logPopFloor
      if (!Number.isFinite(logFloor)) return

      const { camX, camY, camZ, horizon, horizonTop, width, height } = frame
      const invBand = 1 / Math.max(horizonTop - horizon, 1e-4)
      const pillH = LABEL_HEIGHT.city
      const halfH = pillH / 2

      let taken = 0
      for (let k = 0; k < order.length; k += 1) {
        if (taken >= CITY_CANDIDATES) break
        const i = order[k]

        // Sorted by effective population, so the first city under the floor is
        // the last city worth looking at.
        const above = logEffective[i] - logFloor
        if (above <= 0) break

        const o = i * 3
        const dx = dirs[o]
        const dy = dirs[o + 1]
        const dz = dirs[o + 2]

        const facing = dx * camX + dy * camY + dz * camZ
        if (facing <= horizon) continue

        const t = facing >= horizonTop ? 1 : (facing - horizon) * invBand
        const limb = t * t * (3 - 2 * t)
        const lod = above >= POP_FADE_DECADES ? 1 : above / POP_FADE_DECADES
        const alpha = lod * limb
        if (alpha < 0.02) continue

        if (!frame.project(dx, dy, dz, CITY_ANCHOR_RADIUS)) continue
        const px = frame.px
        const py = frame.py
        if (
          px < -OFFSCREEN_SLACK ||
          px > width + OFFSCREEN_SLACK ||
          py < -OFFSCREEN_SLACK ||
          py > height + OFFSCREEN_SLACK
        ) {
          continue
        }

        const held = counts[i]
        const nameWidth = frame.measure(names[i], 'name')
        const metaWidth =
          held > 0 ? frame.measure(plotCountText(held), 'meta') + LABEL_GAP : 0
        const pillWidth = LABEL_PAD_X * 2 + nameWidth + metaWidth

        // The box covers the dot as well as the pill: a name whose leader line
        // runs straight through a neighbouring city's dot reads as belonging to
        // the wrong place.
        out.push(
          s.boxes.take(
            ids[i],
            px - 5,
            py - halfH,
            pillWidth + LABEL_LEADER + 5,
            pillH,
            cityPriority(index.population[i], held),
          ),
        )
        s.idx.push(i)
        s.alpha.push(alpha)
        s.x.push(px)
        s.y.push(py)
        taken += 1
      }
    },

    commit(placed, frame) {
      const pool = poolRef.current
      if (!pool) return

      pool.begin()

      if (index && counts) {
        const s = scratch
        const halfH = LABEL_HEIGHT.city / 2
        for (let k = 0; k < s.idx.length; k += 1) {
          const i = s.idx[k]
          if (!placed.has(index.ids[i])) continue

          const slot = pool.show(
            index.ids[i],
            s.x[k] + LABEL_LEADER,
            s.y[k] - halfH,
            s.alpha[k],
          )
          if (slot < 0) continue

          const held = counts[i]
          if (slotCity[slot] !== i || slotCount[slot] !== held) {
            slotCity[slot] = i
            slotCount[slot] = held
            pool.names[slot].textContent = index.names[i]
            const meta = pool.metas[slot]
            if (held > 0) {
              meta.textContent = plotCountText(held)
              meta.style.display = ''
            } else {
              meta.style.display = 'none'
            }
          }
        }
      }

      pool.end(frame.dt, frame.reducedMotion)
    },
  })

  // Nothing in the scene graph: this layer is HTML, positioned from `commit`.
  return null
}

/**
 * Label importance.
 *
 * Contested cities are lifted above every uncontested city smaller than two
 * million, which is all but about fifty places on Earth. Plot count then orders
 * them among themselves. The result is that when Plovdiv and a nameless
 * Chinese prefecture of the same size collide, the one with someone's money in
 * it wins — which is the whole argument the map is making.
 */
function cityPriority(population: number, plots: number): number {
  return population + (plots > 0 ? 2_000_000 + plots * 500_000 : 0)
}

function plotCountText(n: number): string {
  return n === 1 ? '1 plot' : `${n} plots`
}
