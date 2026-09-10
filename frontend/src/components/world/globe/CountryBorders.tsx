/*
 * Every three.js object in a react-three-fiber scene is a memoised geometry,
 * material, texture or canvas context that is then written to imperatively —
 * per frame, in the case of uniforms. The objects are GPU resources, not
 * React state.
 */

import { use, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { geoCentroid } from 'd3-geo'
import { feature, mesh } from 'topojson-client'
import { claimFill, claimRampT, type GlobePalette } from './geo'
import { iso2FromNumeric, nameFromIso2 } from './countries'
import { CountryFills, type FillSource } from './CountryFills'

/**
 * Country fills and borders.
 *
 * Both are geometry now, and that is the whole point of this file.
 *
 * - **Borders** always were. `mesh` de-duplicates shared arcs, so a border
 *   between two countries is one polyline rather than two stacked on each
 *   other, and the lot merges into a single `LineSegments`.
 * - **Fills** used to be a 4096x2048 equirectangular canvas sampled on a plain
 *   sphere shell. A texel of that canvas is 9.8 km, so past roughly camera
 *   distance 1.15 the visitor was magnifying pixels while the border lines
 *   beside them stayed razor sharp. They are now triangulated polygons — see
 *   `CountryFills`, which owns the tessellation, the refinement that keeps a
 *   planar triangle from sinking inside the sphere, and the incremental build
 *   that keeps 290 ms of earcut off the first frame.
 *
 * What is left in here is everything that is *not* the mesh: loading the
 * topology at two resolutions, the border lines, and the bucket index that
 * answers "what is under the cursor" without raycasting half a million
 * triangles.
 *
 * The fill is the load-bearing part of the light theme and it changed
 * character, not just colour, when it stopped being an additive wash. Every
 * country is an opaque shape — flat grey when unclaimed, a saturated candy
 * colour when someone owns it — and the borders are the seam between shapes
 * rather than the drawing itself. A country you cannot see the *shape* of is a
 * country nobody feels like claiming.
 */

// ---------------------------------------------------------------------------
// Geometry constants
// ---------------------------------------------------------------------------

/** Border lines sit here, and are drawn after the fill so they win the seam. */
const LINE_RADIUS = 1.001
/**
 * Chord length a border segment is subdivided to, so lines hug the curvature.
 *
 * 0.03 globe radii is ~190 km — invisible from far out, and visibly faceted
 * once the camera is allowed within ~570 km. 0.012 is ~76 km, which reads as
 * a curve at every distance the camera can now reach. Cost is linear in
 * segment count and this geometry is built once and memoised, so it is paid
 * at mount, not per frame.
 */
const LINE_CHORD = 0.012

/**
 * Bucket size for the cursor -> country index, in degrees.
 *
 * The same one degree `UrbanAreas` buckets its footprints at, and for the same
 * reason: it brings the candidate set for any coordinate down to single digits,
 * so a lookup is a handful of point-in-polygon tests rather than 4,253.
 */
const CELL_DEG = 1
const LAT_CELLS = 180 / CELL_DEG
const LNG_CELLS = 360 / CELL_DEG

// ---------------------------------------------------------------------------
// Topology loading
// ---------------------------------------------------------------------------

/**
 * `topojson-specification` and `geojson` are transitive types of
 * `@types/topojson-client` and are not resolvable from application code under
 * pnpm's strict layout, so the two types actually needed are derived from the
 * functions' own signatures instead of pulling in another dependency.
 */
type Topology = Parameters<typeof mesh>[0]
type TopoObject = NonNullable<Parameters<typeof mesh>[1]>

type LonLat = [number, number]

interface CountryFeature {
  id?: string | number
  properties: { name?: string } | null
  geometry: {
    type: string
    coordinates: unknown
  } | null
}

/*
 * Two resolutions, loaded in that order.
 *
 * 110m is 106 kB and 177 countries; 10m is 3.5 MB and 238. The difference is
 * not subtle — at 110m a coastline is a handful of points, Norway has no
 * fjords, and Singapore, Monaco, Malta, Hong Kong and Bahrain do not exist at
 * all. The globe was drawing a coarser world than the one it RESOLVES plots
 * against, which uses 10m: a plot in Singapore resolved to SG and then landed
 * on a country the map did not draw.
 *
 * Loading 10m up front would be the obvious fix and the wrong one — 3.5 MB in
 * front of first paint, on a map that already takes too long to appear. So the
 * coarse set paints immediately and the fine one replaces it once it arrives.
 * Everything downstream is derived from whichever topology is current, so the
 * upgrade is a re-render rather than a special case.
 */
let coarsePromise: Promise<Topology> | null = null
let finePromise: Promise<Topology> | null = null

function loadTopology(): Promise<Topology> {
  coarsePromise ??= import('world-atlas/countries-110m.json').then(
    (m) => m.default as unknown as Topology,
  )
  return coarsePromise
}

function loadFineTopology(): Promise<Topology> {
  finePromise ??= import('world-atlas/countries-10m.json').then(
    (m) => m.default as unknown as Topology,
  )
  return finePromise
}

// ---------------------------------------------------------------------------
// Build (runs exactly once per page load)
// ---------------------------------------------------------------------------

/**
 * One country: its code, and the polygons that are it.
 *
 * The same object feeds `CountryFills`, which triangulates it, and the cursor
 * index below, which point-in-polygons it. One list, one order, one truth about
 * where a country is — the mesh and the cursor cannot disagree.
 */
type CountryOutline = FillSource

interface BorderBuild {
  lines: THREE.BufferGeometry
  outlines: CountryOutline[]
}

function project(
  lng: number,
  lat: number,
  radius: number,
  out: Float32Array,
  at: number,
): void {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  const s = Math.sin(phi)
  // Sign on x mirrors src/lib/geo.ts. Flip it and every border lands mirrored.
  out[at] = -radius * s * Math.cos(theta)
  out[at + 1] = radius * Math.cos(phi)
  out[at + 2] = radius * s * Math.sin(theta)
}

/**
 * Scratch for `chordLength`, hoisted out of it.
 *
 * At 10m this function is called 476,888 times in one go. Allocating a
 * `Float32Array(6)` inside it made half a million garbage objects and was a
 * measurable slice of the topology upgrade's cost, for a buffer that is dead
 * the moment the function returns.
 */
const chordScratch = new Float32Array(6)

/**
 * Chord between two lon/lat points on the unit sphere.
 *
 * A degree of arc is at most 0.01745 chord, so two points within
 * `SHORT_DEGREES` of each other on both axes cannot exceed `LINE_CHORD` and do
 * not need projecting at all. That is the overwhelming majority of 10m
 * segments — the raw data is already finer than the target — and the early
 * return is what keeps the upgrade off the frame budget.
 */
const SHORT_DEGREES = 0.4

function chordLength(a: LonLat, b: LonLat): number {
  if (
    Math.abs(a[0] - b[0]) <= SHORT_DEGREES &&
    Math.abs(a[1] - b[1]) <= SHORT_DEGREES
  ) {
    return 0
  }
  project(a[0], a[1], 1, chordScratch, 0)
  project(b[0], b[1], 1, chordScratch, 3)
  return Math.hypot(
    chordScratch[0] - chordScratch[3],
    chordScratch[1] - chordScratch[4],
    chordScratch[2] - chordScratch[5],
  )
}

/**
 * Keyed by the topology, and that is a fix rather than a detail.
 *
 * This used to be a single nullable slot, which meant the first build won
 * forever: the 10m upgrade arrived, re-rendered, called back in and was handed
 * the 110m build straight back out. The whole progressive-resolution ladder
 * above was dead code, and nobody could see it because a coarse map is still a
 * map. A `WeakMap` keeps the memoisation — the coarse build survives the
 * upgrade, so a failed 10m fetch costs nothing — without the collision.
 */
const buildCache = new WeakMap<Topology, BorderBuild>()

function buildBorders(topology: Topology): BorderBuild {
  const cached = buildCache.get(topology)
  if (cached) return cached

  // --- lines. `mesh` de-duplicates shared arcs, so a border between two
  // countries is one line, not two stacked on each other.
  const countries = topology.objects.countries as TopoObject
  const multiline = mesh(topology, countries)
  const segments: number[] = []
  const scratch = new Float32Array(6)

  for (const line of multiline.coordinates as unknown as LonLat[][]) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i]
      const b = line[i + 1]

      // Natural Earth closes Antarctica and a handful of other rings by walking
      // straight from lng -180 to +180. Those two points are the same place on
      // a sphere; interpolating between them draws a line all the way round the
      // world. Seven of them, and every one is invisible if simply dropped.
      if (Math.abs(b[0] - a[0]) > 180) continue

      const steps = Math.max(1, Math.ceil(chordLength(a, b) / LINE_CHORD))
      for (let s = 0; s < steps; s++) {
        const u0 = s / steps
        const u1 = (s + 1) / steps
        project(a[0] + (b[0] - a[0]) * u0, a[1] + (b[1] - a[1]) * u0, LINE_RADIUS, scratch, 0)
        project(a[0] + (b[0] - a[0]) * u1, a[1] + (b[1] - a[1]) * u1, LINE_RADIUS, scratch, 3)
        segments.push(
          scratch[0], scratch[1], scratch[2],
          scratch[3], scratch[4], scratch[5],
        )
      }
    }
  }

  const lines = new THREE.BufferGeometry()
  lines.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(segments), 3),
  )
  lines.computeBoundingSphere()

  // --- the countries themselves, in feature order.
  const collection = feature(topology, countries) as unknown as {
    features: CountryFeature[]
  }

  const outlines: CountryOutline[] = []
  for (const f of collection.features) {
    if (!f.geometry) continue
    const name = f.properties?.name
    /*
     * The shared 238-row table, not a local one.
     *
     * This used to carry its own packed list covering the 174 countries in the
     * 110m set. At 10m there are 238, so 64 of them — including Singapore,
     * Monaco, Malta, Hong Kong and Bahrain — would have drawn as unclaimable
     * grey shapes with no fill and no hover. The same table already backs
     * server-side country resolution, so sharing it also guarantees the map
     * and the resolver agree about what a country is.
     */
    const iso2 =
      iso2FromNumeric(f.id) ??
      (name === 'Kosovo' ? 'XK' : null)
    outlines.push({ iso2, geometry: f.geometry })
  }

  const built = { lines, outlines }
  buildCache.set(topology, built)
  return built
}

// ---------------------------------------------------------------------------
// Cursor -> country
// ---------------------------------------------------------------------------

type Ring = ReadonlyArray<readonly number[]>
type PolygonRings = ReadonlyArray<Ring>

interface CountryIndex {
  /** Which country each polygon belongs to, as an index into the outlines. */
  owner: Int32Array
  /** Where each polygon's rings start in `ringStart`, plus a terminator. */
  polygonRingStart: Uint32Array
  /** Where each ring's points start in `lon`/`lat`, plus a terminator. */
  ringStart: Uint32Array
  lon: Float32Array
  lat: Float32Array
  /** minLon, minLat, maxLon, maxLat per polygon, on the unwrapped branch. */
  bounds: Float32Array
  /** Polygon indices whose bounding box touches each one-degree cell. */
  grid: Map<number, number[]>
}

function latCell(lat: number): number {
  const c = Math.floor((lat + 90) / CELL_DEG)
  return c < 0 ? 0 : c >= LAT_CELLS ? LAT_CELLS - 1 : c
}

function lngCell(lng: number): number {
  return ((Math.floor((lng + 180) / CELL_DEG) % LNG_CELLS) + LNG_CELLS) % LNG_CELLS
}

/**
 * Even-odd ray cast against one ring.
 *
 * Even-odd rather than winding, because Natural Earth does not wind its holes
 * consistently and the fill this has to agree with is triangulated the same
 * way. Lifted from `UrbanAreas`, which makes the same choice for the same data.
 */
function inRing(
  lon: Float32Array,
  lat: Float32Array,
  from: number,
  to: number,
  x: number,
  y: number,
): boolean {
  let inside = false
  for (let i = from, j = to - 1; i < to; j = i++) {
    const xi = lon[i]
    const yi = lat[i]
    const xj = lon[j]
    const yj = lat[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Flatten every country's rings into one coordinate pair of arrays, with a
 * one-degree bucket grid over the bounding boxes.
 *
 * Longitude is unwrapped exactly as `CountryFills` unwraps it, so a ring that
 * crosses the antimeridian is continuous and its bounding box is honest. The
 * query then tries the point on each neighbouring branch — see `lookup`.
 */
function indexCountries(outlines: readonly CountryOutline[]): CountryIndex {
  const owner: number[] = []
  const polygonRingStart: number[] = [0]
  const ringStart: number[] = [0]
  const lon: number[] = []
  const lat: number[] = []
  const bounds: number[] = []

  for (let c = 0; c < outlines.length; c += 1) {
    const geometry = outlines[c].geometry
    if (!geometry || !outlines[c].iso2) continue
    const polygons =
      geometry.type === 'Polygon'
        ? [geometry.coordinates as PolygonRings]
        : geometry.type === 'MultiPolygon'
          ? (geometry.coordinates as PolygonRings[])
          : []

    for (const rings of polygons) {
      if (rings.length === 0) continue
      const ringsBefore = ringStart.length - 1
      let minLon = Number.POSITIVE_INFINITY
      let minLat = Number.POSITIVE_INFINITY
      let maxLon = Number.NEGATIVE_INFINITY
      let maxLat = Number.NEGATIVE_INFINITY
      let outerRef = 0

      for (let r = 0; r < rings.length; r += 1) {
        const ring = rings[r]
        if (ring.length < 3) continue

        let prev: number | null = null
        let first = 0
        for (let i = 0; i < ring.length; i += 1) {
          let x = ring[i][0]
          if (prev !== null) {
            while (x - prev > 180) x -= 360
            while (x - prev < -180) x += 360
          } else {
            first = x
          }
          prev = x
          lon.push(x)
          lat.push(ring[i][1])
        }

        if (r === 0) {
          outerRef = first
        } else {
          // A hole unwrapped on its own can land a whole turn from the shell it
          // punches through. Shift it onto the outer ring's branch.
          let shift = 0
          while (first + shift - outerRef > 180) shift -= 360
          while (first + shift - outerRef < -180) shift += 360
          if (shift !== 0) {
            for (let i = ringStart[ringStart.length - 1]; i < lon.length; i += 1) {
              lon[i] += shift
            }
          }
        }

        for (let i = ringStart[ringStart.length - 1]; i < lon.length; i += 1) {
          if (lon[i] < minLon) minLon = lon[i]
          if (lon[i] > maxLon) maxLon = lon[i]
          if (lat[i] < minLat) minLat = lat[i]
          if (lat[i] > maxLat) maxLat = lat[i]
        }
        ringStart.push(lon.length)
      }

      // Every ring was degenerate, so there is no polygon here to index.
      if (ringStart.length - 1 === ringsBefore) continue
      owner.push(c)
      polygonRingStart.push(ringStart.length - 1)
      bounds.push(minLon, minLat, maxLon, maxLat)
    }
  }

  const lonArray = new Float32Array(lon)
  const latArray = new Float32Array(lat)
  const boundsArray = new Float32Array(bounds)

  const grid = new Map<number, number[]>()
  for (let p = 0; p < owner.length; p += 1) {
    const a = latCell(boundsArray[p * 4 + 1])
    const b = latCell(boundsArray[p * 4 + 3])
    const c = lngCell(boundsArray[p * 4])
    const d = lngCell(boundsArray[p * 4 + 2])
    const span =
      boundsArray[p * 4 + 2] - boundsArray[p * 4] >= 360
        ? LNG_CELLS - 1
        : d >= c
          ? d - c
          : d + LNG_CELLS - c
    for (let ai = a; ai <= b; ai += 1) {
      for (let s = 0; s <= span; s += 1) {
        const key = ai * LNG_CELLS + ((c + s) % LNG_CELLS)
        const bucket = grid.get(key)
        if (bucket === undefined) grid.set(key, [p])
        else bucket.push(p)
      }
    }
  }

  return {
    owner: new Int32Array(owner),
    polygonRingStart: new Uint32Array(polygonRingStart),
    ringStart: new Uint32Array(ringStart),
    lon: lonArray,
    lat: latArray,
    bounds: boundsArray,
    grid,
  }
}

/**
 * The lookup handed up to `GlobeScene`, built lazily on the first call.
 *
 * Lazy for the same reason the readback it replaces was lazy: nothing needs it
 * until the cursor moves, and the frames before that are the ones the map is
 * trying to first appear in.
 */
function buildCountryLookup(
  outlines: readonly CountryOutline[],
): (lat: number, lng: number) => string | null {
  let index: CountryIndex | null = null

  return (lat: number, lng: number): string | null => {
    index ??= indexCountries(outlines)
    const { owner, polygonRingStart, ringStart, lon, lat: latArray, bounds, grid } =
      index

    const a = latCell(lat)
    const b = lngCell(lng)
    // Neighbouring cells as well as the exact one: a bounding box that only
    // clips the corner of a cell still owns the coordinate inside it.
    for (let da = -1; da <= 1; da += 1) {
      const ai = a + da
      if (ai < 0 || ai >= LAT_CELLS) continue
      for (let db = -1; db <= 1; db += 1) {
        const bi = (((b + db) % LNG_CELLS) + LNG_CELLS) % LNG_CELLS
        const bucket = grid.get(ai * LNG_CELLS + bi)
        if (bucket === undefined) continue

        for (let n = 0; n < bucket.length; n += 1) {
          const p = bucket[n]
          const minLon = bounds[p * 4]
          const maxLon = bounds[p * 4 + 2]
          if (lat < bounds[p * 4 + 1] || lat > bounds[p * 4 + 3]) continue

          // The polygon lives on an unwrapped longitude branch, which for
          // anything crossing the antimeridian is not the one the cursor is on.
          let x = lng
          if (x < minLon) {
            while (x < minLon) x += 360
          } else if (x > maxLon) {
            while (x > maxLon) x -= 360
          }
          if (x < minLon || x > maxLon) continue

          const ringFrom = polygonRingStart[p]
          const ringTo = polygonRingStart[p + 1]
          let inside = inRing(
            lon,
            latArray,
            ringStart[ringFrom],
            ringStart[ringFrom + 1],
            x,
            lat,
          )
          for (let r = ringFrom + 1; r < ringTo && inside; r += 1) {
            if (inRing(lon, latArray, ringStart[r], ringStart[r + 1], x, lat)) {
              inside = false
            }
          }
          if (inside) return outlines[owner[p]].iso2
        }
      }
    }

    return null
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * One country as the label layer wants it: code, display name, centroid, and a
 * size proxy for prioritising unclaimed countries. Handed up on build so the
 * scene can resolve `focus: {iso}` and feed `CountryLabels` without loading
 * the topology twice.
 */
export interface CountryInfo {
  iso2: string
  name: string
  lat: number
  lng: number
  /** Rough size proxy (outline vertex count). Bigger country, bigger number. */
  weight: number
}

export interface CountryBordersProps {
  /**
   * iso2 → claim weight. Any positive number marks the country as claimed and
   * places it on the claim ramp; the donor fed cents here, ExploreYC feeds a
   * tier-weighted pin count where 1 is a single pin at the $5 floor. Only
   * relative magnitude is ever read.
   */
  claims: ReadonlyMap<string, number>
  /** Ground palette for the active theme. Owned by the caller. */
  palette: GlobePalette
  /**
   * Colour of the seam between two countries. Defaults to the theme's own
   * `landStroke`, so the dark map gets a dark seam without being told.
   */
  lineColor?: string
  lineOpacity?: number
  /** ISO-3166 alpha-2 of the country to light, or null. */
  hoveredIso2?: string | null
  /** ISO-3166 alpha-2 of the selected country, or null. */
  selectedIso2?: string | null
  /**
   * Handed back on mount: converts a coordinate to the country under it.
   *
   * The polygons that answer this live in here, and the raycast that needs the
   * answer lives in `GlobeScene`. Passing the function up is cheaper than
   * moving four megabytes of coordinates down, or than indexing them twice.
   */
  onLookupReady?: (lookup: (lat: number, lng: number) => string | null) => void
  /** Handed the country list (names + centroids) whenever the topology moves. */
  onCountriesReady?: (countries: CountryInfo[]) => void
}

export function CountryBorders({
  claims,
  palette,
  lineColor,
  lineOpacity = 0.95,
  hoveredIso2 = null,
  selectedIso2 = null,
  onLookupReady,
  onCountriesReady,
}: CountryBordersProps) {
  const coarse = use(loadTopology())

  /**
   * Swap in the detailed topology once it has downloaded.
   *
   * Kicked off after mount rather than during render, so the 3.5 MB fetch
   * never sits between the user and a first frame. `fine` starts null, the
   * coarse set paints, and the state change re-derives borders, the fill
   * texture and the ID texture from the better data.
   */
  const [fine, setFine] = useState<Topology | null>(null)

  useEffect(() => {
    let cancelled = false
    const start = () => {
      loadFineTopology()
        .then((t) => {
          if (!cancelled) setFine(t)
        })
        .catch(() => {
          // A failed upgrade is not a failure. The coarse map is a real map,
          // and every derived layer already works against it.
        })
    }

    // Idle time if the browser offers it, a timeout if not — either way after
    // the first paint has had its chance.
    const idle = (
      window as typeof window & {
        requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
      }
    ).requestIdleCallback
    const handle = idle
      ? idle(start, { timeout: 3000 })
      : window.setTimeout(start, 1200)

    return () => {
      cancelled = true
      if (!idle) window.clearTimeout(handle as number)
    }
  }, [])

  const topology = fine ?? coarse
  const { lines, outlines } = useMemo(() => buildBorders(topology), [topology])

  /**
   * lat/lng -> the country under it, built on the first pointer move.
   *
   * This used to be a 1024x512 canvas: the same shapes painted a second time in
   * a colour that encoded their index, then read back with `getImageData` into
   * a `Uint16Array`. It answered in 39 km texels and it cost 206 ms of `geoPath`
   * to produce the SVG that painted it — on the 10m topology, in one
   * synchronous frame, which is a third of a second of stall to buy a lookup
   * table coarser than the border it approximates.
   *
   * So the cursor now asks the polygons directly. A one-degree bucket grid over
   * the polygons' bounding boxes — the same structure `UrbanAreas` uses to
   * decide which footprints hold plots — brings the candidate set for any
   * coordinate down to single digits, and an even-odd ray cast against those
   * few is exact rather than rounded to 39 km. It is also the last thing in
   * here that needed d3-geo.
   */
  const lookupCountry = useMemo(() => buildCountryLookup(outlines), [outlines])

  // Hand the lookup up as soon as it exists. `GlobeScene` owns the raycast;
  // this component owns the map that answers it.
  useEffect(() => {
    onLookupReady?.(lookupCountry)
  }, [lookupCountry, onLookupReady])

  /**
   * ISO code → the CSS colour that country is painted.
   *
   * One hue — the theme's claim ramp, derived from YC orange — and rank is the
   * only thing that moves along it. A country's colour is therefore a statement
   * about the *board* rather than about the country, which is the trade this
   * layer deliberately makes: the alternative was a per-country hue hashed off
   * the ISO code, and twelve accent colours is eleven more than this product
   * has.
   *
   * The rank scale is logarithmic and anchored at the $5 floor — see
   * `claimRampT`. Linear would make one whale country vivid and leave every
   * other claimed country indistinguishable from the next, which defeats the
   * point of colouring them at all: the board is supposed to be legible from
   * the globe.
   */
  const fills = useMemo(() => {
    const m = new Map<string, string>()
    let max = 0
    for (const w of claims.values()) if (w > max) max = w
    if (max <= 0) return m

    for (const [code, claimWeight] of claims) {
      if (claimWeight <= 0) continue

      /*
       * Only the fill is stated here. Each claimed country also carries its own
       * outline, a darker step of this same colour — see `STROKE_TINT` in
       * `CountryFills`, which derives it in the shader from the one value this
       * map holds, rather than shipping a second colour that could drift from
       * it. That outline is what still separates two claimed neighbours now
       * that they share a hue.
       */
      m.set(
        code.toUpperCase(),
        claimFill(palette.claim, claimRampT(claimWeight, max)),
      )
    }
    return m
  }, [claims, palette])

  /**
   * Names and centroids for every country in the current topology.
   *
   * `geoCentroid` is spherical, so Fiji and Russia get honest centres despite
   * the antimeridian, and the weight (raw outline vertex count) is a crude but
   * monotonic size proxy for prioritising unclaimed countries on the label
   * layer. Rebuilt only when the topology upgrades; handed up in an effect.
   */
  const countryInfo = useMemo<CountryInfo[]>(() => {
    const list: CountryInfo[] = []
    for (const outline of outlines) {
      const { iso2, geometry } = outline
      if (!iso2 || !geometry) continue
      const centroid = geoCentroid(
        geometry as unknown as Parameters<typeof geoCentroid>[0],
      )
      if (!Number.isFinite(centroid[0]) || !Number.isFinite(centroid[1])) {
        continue
      }
      let weight = 0
      const polygons =
        geometry.type === 'Polygon'
          ? [geometry.coordinates as unknown[][]]
          : geometry.type === 'MultiPolygon'
            ? (geometry.coordinates as unknown[][][])
            : []
      for (const rings of polygons) {
        for (const ring of rings) weight += (ring as unknown[]).length
      }
      list.push({
        iso2,
        name: nameFromIso2(iso2),
        lat: centroid[1],
        lng: centroid[0],
        weight,
      })
    }
    return list
  }, [outlines])

  useEffect(() => {
    onCountriesReady?.(countryInfo)
  }, [countryInfo, onCountriesReady])

  const lineMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(lineColor ?? palette.landStroke),
        transparent: true,
        opacity: lineOpacity,
        depthWrite: false,
        toneMapped: false,
      }),
    [lineColor, lineOpacity, palette],
  )

  const linesRef = useRef<THREE.LineSegments>(null)

  useEffect(
    () => () => {
      lineMaterial.dispose()
    },
    [lineMaterial],
  )

  return (
    <group>
      <CountryFills
        sources={outlines}
        fills={fills}
        landColor={palette.land}
        hoveredIso2={hoveredIso2}
        selectedIso2={selectedIso2}
        hoverTint={palette.hover.tint}
        hoverAmount={palette.hover.amount}
      />
      <lineSegments
        ref={linesRef}
        geometry={lines}
        material={lineMaterial}
        renderOrder={3}
        frustumCulled={false}
      />
    </group>
  )
}
