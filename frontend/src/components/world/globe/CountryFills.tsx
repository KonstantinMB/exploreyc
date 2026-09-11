/* eslint-disable react-hooks/immutability -- three.js/DOM resources are
   GPU-adjacent objects written imperatively per frame; there is no pure-React
   formulation of that. Same deliberate call as the donor codebase. */
/*
 * Everything held here is a GPU resource — buffer attributes, a data texture,
 * shader uniforms — written imperatively. There is no pure-React formulation
 * of "re-upload this index buffer".
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Earcut } from 'three/src/extras/Earcut.js'
import { GLOBE_PALETTE_LIGHT } from './geo'

/**
 * Country fills, as geometry.
 *
 * These used to be a 4096x2048 equirectangular canvas sampled on a sphere
 * shell. A texel of that canvas is 9.8 km at the equator, so past roughly
 * camera distance 1.15 the visitor was magnifying pixels: the Mongolia/Russia
 * border went soft while the border *lines* — which have always been geometry —
 * stayed razor sharp, and the mismatch read worse than either would alone.
 *
 * The objection recorded when this was first attempted was that a planar
 * triangle spanning a thousand kilometres sinks *inside* a sphere of radius 1,
 * so the fills have to be subdivided, and that the whole build was 580 ms. Both
 * halves are true and neither is a reason to stop:
 *
 * - **Sag** is solved by a conforming refinement (see `subdivide`) that costs
 *   8% more triangles than the raw earcut and puts the deepest point of the
 *   whole world's mesh at radius **1.00115** — clear of both the true sphere
 *   and the globe body's own faceting, which dips to 0.9997.
 * - **Build time** is a one-time cost that must not block first paint, which is
 *   exactly the problem the topology loader already solved. 110m is 26,957
 *   triangles and builds in ~17 ms, so it goes up synchronously with the first
 *   frame. 10m is 574,528 triangles and ~290 ms, so it is built in ~8 ms slices
 *   on idle callbacks while the coarse mesh stays on screen.
 *
 * The result is 575k triangles in at most two draw calls, which is fewer than
 * four times what `UrbanAreas` already ships in the same scene, and the borders
 * are vector edges at every zoom the camera can reach.
 *
 * ---------------------------------------------------------------------------
 * What the texture used to do that this has to keep doing
 *
 * - **Per-country colour.** Was a `fillStyle` per `Path2D`; is now a 1-texel
 *   lookup per fragment into a `DataTexture` of one RGBA texel per country,
 *   indexed by a per-vertex country id. A standings change re-uploads 238
 *   texels instead of repainting 8.4 megapixels.
 * - **Hover.** Was a second, coarser canvas encoding a country id per texel,
 *   sampled in the fragment shader. The id is now an attribute, so the test is
 *   exact at the polygon edge rather than at 39 km resolution — the *cursor*
 *   still resolves through the id map in `CountryBorders`, because a raycast
 *   against 575k triangles is not something to do on every pointer move.
 * - **The claimed-country stroke.** Was `ctx.stroke` in a darker step of the
 *   country's own fill, so two claimed neighbours never merged into one shape.
 *   It is now a `LineSegments` over the polygon rings, sharing the fill's
 *   vertex buffer, with a draw range covering only the claimed countries — so
 *   it costs nothing at all until somebody buys something.
 * - **The limb falloff.** Unchanged, and still the reason the sphere reads as
 *   round rather than as a flat sticker.
 */

// ---------------------------------------------------------------------------
// Geometry constants
// ---------------------------------------------------------------------------

/**
 * Fill shell radius. Unchanged from the texture shell it replaces, so nothing
 * else in the render order had to move.
 *
 * The budget it has to buy is the gap down to the globe body, whose 128x72
 * sphere dips to 0.9997 between facets. `MAX_CHORD` is chosen against it.
 */
export const FILL_RADIUS = 1.0015

/**
 * Longest edge a fill triangle is allowed to keep, in globe radii.
 *
 * 0.05 is ~320 km. A planar triangle with edges no longer than that dips at
 * most ~0.166 * 0.05^2 = 4.2e-4 below the shell it is inscribed in, which
 * leaves the mesh at 1.00115 at its very deepest — measured over every triangle
 * of the 10m world, worst case Australia. The margin to the globe body is then
 * 1.15e-3, roughly four times the body's own facet dip.
 *
 * Tightening it does almost nothing: at 0.04 the count moves from 574,528 to
 * 609,580 for a clearance that is already an order of magnitude more than the
 * depth buffer needs.
 */
const MAX_CHORD = 0.05

/**
 * Refinement passes before the loop gives up.
 *
 * Midpoints are taken on the *sphere* rather than in lon/lat (see `subdivide`),
 * so every pass exactly halves the edges it splits and the whole world
 * converges in six. Twelve is a guard against a pathological polygon, not a
 * tuning parameter — nothing in Natural Earth reaches it.
 */
const MAX_PASSES = 12

/** Matches the shell the texture fill used, so `UrbanAreas` still sits above. */
const FILL_RENDER_ORDER = 2
/**
 * Between the fill and the urban footprints at 2.5. A claimed country's own
 * outline belongs to the country, so it is drawn with it.
 */
const STROKE_RENDER_ORDER = 2.1

/**
 * How far a claimed country's own outline is darkened from its fill.
 *
 * Carried over verbatim from the canvas painter, where it was
 * `Math.round(fill * 0.72)`, and applied here as a multiply in the shader so
 * there is exactly one colour per country to keep in step. `#C4CAD2` — the
 * shared land stroke — is correct
 * against grey land and invisible against a saturated pink, so two claimed
 * neighbours merged into a single shape. A stroke derived from the fill
 * separates any pair at any saturation without introducing a colour that is not
 * already on the map.
 */
const STROKE_TINT = 0.72

/** Strength of the limb falloff, matching the shell material it replaces. */
const SHADE = 0.9

/**
 * Fallback hover wash, used only when no palette wash is passed.
 *
 * The real values live in `geo.ts` (`GlobePalette.hover`) because the right
 * answer is theme-dependent: the light map's land is a near-white with nowhere
 * to go toward white, so its hover *deepens* into a warm tone, while the dark
 * map's land lifts. A single "mix toward white by 0.28" was legible on the old
 * near-black terrain and almost invisible on this one.
 */
const HOVER_FALLBACK = { tint: '#E88B3F', amount: 0.38 }

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/** A GeoJSON geometry, narrowed to the two cases Natural Earth actually uses. */
type Ring = ReadonlyArray<readonly [number, number] | readonly number[]>
type PolygonRings = ReadonlyArray<Ring>

export interface FillSource {
  iso2: string | null
  geometry: { type: string; coordinates: unknown } | null
}

// ---------------------------------------------------------------------------
// Growable typed buffers
// ---------------------------------------------------------------------------

/**
 * Plain arrays would work — `UrbanAreas` uses them — but this build is four
 * times the size and runs inside idle callbacks, where a 35 MB churn of boxed
 * numbers is exactly the kind of thing that turns an 8 ms slice into a garbage
 * collection the user sees.
 */
class FloatBuffer {
  data = new Float32Array(4096)
  length = 0

  private room(extra: number) {
    if (this.length + extra <= this.data.length) return
    let size = this.data.length * 2
    while (size < this.length + extra) size *= 2
    const next = new Float32Array(size)
    next.set(this.data.subarray(0, this.length))
    this.data = next
  }

  push(a: number) {
    this.room(1)
    this.data[this.length++] = a
  }

  push3(a: number, b: number, c: number) {
    this.room(3)
    this.data[this.length++] = a
    this.data[this.length++] = b
    this.data[this.length++] = c
  }

  toArray(): Float32Array {
    return this.data.slice(0, this.length)
  }
}

class IndexBuffer {
  data = new Uint32Array(4096)
  length = 0

  private room(extra: number) {
    if (this.length + extra <= this.data.length) return
    let size = this.data.length * 2
    while (size < this.length + extra) size *= 2
    const next = new Uint32Array(size)
    next.set(this.data.subarray(0, this.length))
    this.data = next
  }

  push2(a: number, b: number) {
    this.room(2)
    this.data[this.length++] = a
    this.data[this.length++] = b
  }

  push3(a: number, b: number, c: number) {
    this.room(3)
    this.data[this.length++] = a
    this.data[this.length++] = b
    this.data[this.length++] = c
  }

  toArray(): Uint32Array {
    return this.data.slice(0, this.length)
  }
}

// ---------------------------------------------------------------------------
// Tessellation
// ---------------------------------------------------------------------------

export interface FillMesh {
  /**
   * The countries this mesh was built from, and the only list its ids mean
   * anything against.
   *
   * Carried on the mesh rather than read from the prop because the two go out
   * of step for as long as the 10m upgrade takes to tessellate: `sources`
   * becomes the 238-country fine list the moment the topology lands, while the
   * mesh on screen is still the 177-country coarse one. Every id, colour and
   * ring range below is resolved against this, so the coarse mesh keeps its own
   * colouring until the fine one is ready to replace it whole.
   */
  sources: readonly FillSource[]
  /** Sphere positions at `FILL_RADIUS`, xyz-interleaved. */
  positions: Float32Array
  /** Country index per vertex. Constant across every triangle. */
  ids: Float32Array
  /** Triangles, into `positions`. */
  triangles: Uint32Array
  /** Ring segments, into the same `positions`, grouped by country. */
  ringEdges: Uint32Array
  /** Where each country's ring segments start in `ringEdges`, plus a terminator. */
  edgeStart: Uint32Array
  countryCount: number
}

/**
 * Longitude, made continuous.
 *
 * A ring that crosses the antimeridian arrives as ... 179.4, -179.8 ... and
 * triangulating that in the lon/lat plane draws the polygon the long way round
 * the world. Unwrapping — keep adding or subtracting 360 until each point is
 * within half a turn of the one before it — puts the ring back on one branch.
 *
 * Nothing downstream has to undo it: `project` feeds longitude through sin and
 * cos, which are periodic, so a point at 190 degrees lands exactly where
 * -170 does.
 */
function unwrap(ring: Ring, into: number[]): void {
  let prev: number | null = null
  for (let i = 0; i < ring.length; i += 1) {
    let x = ring[i][0]
    if (prev !== null) {
      while (x - prev > 180) x -= 360
      while (x - prev < -180) x += 360
    }
    prev = x
    into.push(x)
  }
}

/**
 * One polygon: earcut in lon/lat, refine on the sphere, append to the world.
 *
 * The triangulation itself is planar and has to be — earcut has no spherical
 * mode and a robust one is a research project — but the *refinement* is not,
 * and that is what makes the planar step safe. Every midpoint is normalised
 * back onto the shell, so the mesh converges toward the geodesic triangle
 * rather than toward the equirectangular one.
 */
function tessellatePolygon(
  rings: PolygonRings,
  countryIndex: number,
  positions: FloatBuffer,
  ids: FloatBuffer,
  triangles: IndexBuffer,
  ringEdges: IndexBuffer,
): void {
  if (rings.length === 0) return

  const base = positions.length / 3
  const flat: number[] = []
  const holes: number[] = []
  const lons: number[] = []

  // Local sphere positions, so refinement can measure real chords rather than
  // degrees — a degree of longitude is 111 km at the equator and nothing at the
  // pole, and Antarctica is the polygon that punishes anyone who forgets.
  const px: number[] = []
  const py: number[] = []
  const pz: number[] = []

  let outerRef = 0
  for (let r = 0; r < rings.length; r += 1) {
    const ring = rings[r]
    if (ring.length < 3) continue
    if (flat.length > 0 && r > 0) holes.push(flat.length / 2)

    lons.length = 0
    unwrap(ring, lons)

    if (r === 0) {
      outerRef = lons[0]
    } else {
      // A hole unwrapped on its own may land a full turn away from the shell it
      // punches through. Shift it onto the outer ring's branch or earcut sees a
      // hole that is nowhere near the polygon and silently drops it.
      let shift = 0
      while (lons[0] + shift - outerRef > 180) shift -= 360
      while (lons[0] + shift - outerRef < -180) shift += 360
      if (shift !== 0) for (let i = 0; i < lons.length; i += 1) lons[i] += shift
    }

    for (let i = 0; i < ring.length; i += 1) {
      const lon = lons[i]
      const lat = ring[i][1]
      flat.push(lon, lat)
      const phi = (90 - lat) * (Math.PI / 180)
      const theta = (lon + 180) * (Math.PI / 180)
      const s = Math.sin(phi)
      // Sign on x mirrors `latLngToVector3`. Flip it and every country lands
      // mirrored across the prime meridian.
      px.push(-FILL_RADIUS * s * Math.cos(theta))
      py.push(FILL_RADIUS * Math.cos(phi))
      pz.push(FILL_RADIUS * s * Math.sin(theta))
    }
  }

  if (flat.length < 6) return

  let current = Earcut.triangulate(flat, holes, 2) as number[]
  if (current.length === 0) return

  current = subdivide(current, px, py, pz)

  // --- append. The rings are emitted from the ORIGINAL point count, because a
  // refinement midpoint is interior to the polygon and is not part of its
  // outline.
  for (let i = 0; i < px.length; i += 1) {
    positions.push3(px[i], py[i], pz[i])
    ids.push(countryIndex)
  }
  for (let i = 0; i < current.length; i += 3) {
    triangles.push3(
      base + current[i],
      base + current[i + 1],
      base + current[i + 2],
    )
  }

  // Closed rings, from the untouched input points: every point joins the next,
  // and the last joins the first.
  let at = 0
  for (let r = 0; r < rings.length; r += 1) {
    const ring = rings[r]
    if (ring.length < 3) continue
    const from = at
    const to = at + ring.length
    for (let i = from; i < to; i += 1) {
      ringEdges.push2(base + i, i + 1 < to ? base + i + 1 : base + from)
    }
    at = to
  }
}

/**
 * Conforming refinement: split every edge longer than `MAX_CHORD`, at its
 * midpoint *on the sphere*.
 *
 * The property that matters is that the decision is a function of the edge and
 * nothing else. Two triangles either side of an edge therefore always agree
 * about whether it splits and about where the midpoint goes, so the mesh never
 * develops a T-junction — and neither do two *different countries* sharing a
 * border, because TopoJSON hands both of them the identical arc and the
 * identical arc produces identical floats.
 *
 * That is also why the midpoint is spherical and not taken in lon/lat. A
 * lon/lat midpoint of two points either side of a pole is nowhere near between
 * them, and Antarctica — whose outer ring spans a full turn of longitude at
 * latitude -90 — refused to converge in twenty-five passes and still left the
 * mesh 6.6e-3 *inside* the sphere. Normalising the 3D midpoint halves the chord
 * exactly, and the whole world converges in six.
 */
function subdivide(
  triangles: number[],
  px: number[],
  py: number[],
  pz: number[],
): number[] {
  const limitSq = MAX_CHORD * MAX_CHORD
  let current = triangles

  const tooLong = (a: number, b: number): boolean => {
    const dx = px[a] - px[b]
    const dy = py[a] - py[b]
    const dz = pz[a] - pz[b]
    return dx * dx + dy * dy + dz * dz > limitSq
  }

  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const midpoints = new Map<number, number>()
    const next: number[] = []
    let split = false

    const midOf = (a: number, b: number): number => {
      // Order-independent key, so the two triangles either side of an edge get
      // the same vertex rather than two coincident ones.
      const key = a < b ? a * 4194304 + b : b * 4194304 + a
      const found = midpoints.get(key)
      if (found !== undefined) return found

      let x = (px[a] + px[b]) / 2
      let y = (py[a] + py[b]) / 2
      let z = (pz[a] + pz[b]) / 2
      const len = Math.hypot(x, y, z)
      // Zero only for an antipodal pair, which cannot occur inside one polygon.
      const k = len > 1e-12 ? FILL_RADIUS / len : 1
      x *= k
      y *= k
      z *= k

      const m = px.length
      px.push(x)
      py.push(y)
      pz.push(z)
      midpoints.set(key, m)
      return m
    }

    for (let i = 0; i < current.length; i += 3) {
      const a = current[i]
      const b = current[i + 1]
      const c = current[i + 2]
      const ab = tooLong(a, b)
      const bc = tooLong(b, c)
      const ca = tooLong(c, a)
      const count = (ab ? 1 : 0) + (bc ? 1 : 0) + (ca ? 1 : 0)

      if (count === 0) {
        next.push(a, b, c)
        continue
      }
      split = true

      if (count === 3) {
        const m0 = midOf(a, b)
        const m1 = midOf(b, c)
        const m2 = midOf(c, a)
        next.push(a, m0, m2, m0, b, m1, m2, m1, c, m0, m1, m2)
      } else if (count === 1) {
        if (ab) {
          const m = midOf(a, b)
          next.push(a, m, c, m, b, c)
        } else if (bc) {
          const m = midOf(b, c)
          next.push(b, m, a, m, c, a)
        } else {
          const m = midOf(c, a)
          next.push(c, m, b, m, a, b)
        }
      } else if (!ca) {
        const m0 = midOf(a, b)
        const m1 = midOf(b, c)
        next.push(a, m0, m1, m0, b, m1, a, m1, c)
      } else if (!ab) {
        const m1 = midOf(b, c)
        const m2 = midOf(c, a)
        next.push(b, m1, m2, m1, c, m2, b, m2, a)
      } else {
        const m2 = midOf(c, a)
        const m0 = midOf(a, b)
        next.push(c, m2, m0, m2, a, m0, c, m0, b)
      }
    }

    current = next
    if (!split) break
  }

  return current
}

/**
 * The world, one polygon at a time.
 *
 * Held as an object rather than written as a loop because the 10m build is ~290
 * ms and has to be spread across idle callbacks: `step` runs until its budget
 * is gone and reports whether there is more to do.
 */
class MeshBuilder {
  private positions = new FloatBuffer()
  private ids = new FloatBuffer()
  private triangles = new IndexBuffer()
  private ringEdges = new IndexBuffer()
  private edgeStart: number[] = [0]
  private at = 0
  // Not a parameter property: `erasableSyntaxOnly` forbids that sugar.
  private readonly sources: readonly FillSource[]

  constructor(sources: readonly FillSource[]) {
    this.sources = sources
  }

  get done(): boolean {
    return this.at >= this.sources.length
  }

  /** Returns true when the whole world is tessellated. */
  step(budgetMs: number): boolean {
    const deadline = performance.now() + budgetMs
    while (this.at < this.sources.length) {
      const source = this.sources[this.at]
      const geometry = source.geometry
      if (geometry) {
        const polygons =
          geometry.type === 'Polygon'
            ? [geometry.coordinates as PolygonRings]
            : geometry.type === 'MultiPolygon'
              ? (geometry.coordinates as PolygonRings[])
              : []
        for (const rings of polygons) {
          tessellatePolygon(
            rings,
            this.at,
            this.positions,
            this.ids,
            this.triangles,
            this.ringEdges,
          )
        }
      }
      this.at += 1
      this.edgeStart.push(this.ringEdges.length)
      // Checked per country rather than per polygon: the check is cheap but not
      // free, and no single country is more than a few milliseconds.
      if (performance.now() >= deadline) break
    }
    return this.done
  }

  finish(): FillMesh {
    return {
      sources: this.sources,
      positions: this.positions.toArray(),
      ids: this.ids.toArray(),
      triangles: this.triangles.toArray(),
      ringEdges: this.ringEdges.toArray(),
      edgeStart: new Uint32Array(this.edgeStart),
      countryCount: this.sources.length,
    }
  }
}

// ---------------------------------------------------------------------------
// Building, without blocking the frame that matters
// ---------------------------------------------------------------------------

const IDLE_BUDGET_MS = 8

type IdleWindow = typeof window & {
  requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

/**
 * The mesh for the current topology, replaced rather than blanked.
 *
 * The first build is synchronous on purpose: it is the 110m set, 26,957
 * triangles and ~17 ms, and a globe whose land arrives one frame after its
 * ocean looks broken in a way a 17 ms hitch does not. Every build after that —
 * which in practice means the 10m upgrade — runs in `IDLE_BUDGET_MS` slices
 * with the previous mesh still on screen, so the swap is invisible.
 */
function useFillMesh(sources: readonly FillSource[]): FillMesh | null {
  const [mesh, setMesh] = useState<FillMesh | null>(null)
  // Read inside the effect only, so a new mesh does not restart the build.
  const hasMesh = useRef(false)

  useEffect(() => {
    if (sources.length === 0) return undefined

    const builder = new MeshBuilder(sources)
    let cancelled = false

    if (!hasMesh.current) {
      builder.step(Number.POSITIVE_INFINITY)
      hasMesh.current = true
      // Deliberately synchronous: the 110m set is ~17 ms, and a globe whose
      // land arrives one frame after its ocean looks broken in a way a 17 ms
      // hitch does not. The cascading render is the point, once, at mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMesh(builder.finish())
      return undefined
    }

    const idleWindow = window as IdleWindow
    let handle: number | null = null
    let timer: number | null = null

    const pump = () => {
      if (cancelled) return
      if (builder.step(IDLE_BUDGET_MS)) {
        setMesh(builder.finish())
        return
      }
      schedule()
    }

    const schedule = () => {
      if (idleWindow.requestIdleCallback) {
        handle = idleWindow.requestIdleCallback(pump, { timeout: 500 })
      } else {
        timer = window.setTimeout(pump, 16)
      }
    }

    schedule()

    return () => {
      cancelled = true
      if (handle !== null) idleWindow.cancelIdleCallback?.(handle)
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [sources])

  return mesh
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const FILL_VERT = /* glsl */ `
  attribute float aId;
  varying float vId;
  varying vec3 vDir;
  varying vec3 vPos;

  void main() {
    vId = aId;
    vDir = normalize(position);
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/*
 * No `<colorspace_fragment>` here, deliberately — the same reasoning the
 * texture fill gave, and for the same reason. `uColors` holds bytes written
 * from the design tokens' own hex; they are already sRGB. Encoding them again
 * would lift `#E4E7EB` toward white and the land would go milky.
 *
 * `uTint` is 1 for the fill and `STROKE_TINT` for an outlined country's ring;
 * `uStrokePass` is 0 and 1 respectively. Those two floats are the whole
 * difference between the materials — a second shader for a multiply and a
 * branch is a second shader to keep in step.
 */
const FILL_FRAG = /* glsl */ `
  uniform sampler2D uColors;
  uniform float uCount;
  uniform float uHoverId;
  /** Warm wash the hovered country's own fill is mixed toward, and how far.
   *  Theme-dependent — see GlobePalette.hover. */
  uniform vec3 uHoverTint;
  uniform float uHoverAmount;
  /** Index of the SELECTED country, or -1. Distinct from hover: hover is where
   *  the cursor is, selection is what the panel is showing. */
  uniform float uSelectedId;
  /** 0 = nothing selected, 1 = fully selected. Eased on the CPU over ~180ms so
   *  the world does not snap its entire colour in one frame. */
  uniform float uSelectMix;
  /** The tone every UNSELECTED country drains toward: this theme's own
   *  unclaimed land. Handed down rather than hard-coded, because a light grey
   *  is the right answer in one theme and a bleach in the other. */
  uniform vec3 uRecede;
  /** 1 on the outline pass. A selected country's ring is drawn in the accent
   *  shade instead of a darker step of its own fill. */
  uniform float uStrokePass;
  uniform vec3 uSelectStroke;
  uniform float uShade;
  uniform float uTint;

  varying float vId;
  varying vec3 vDir;
  varying vec3 vPos;

  void main() {
    vec3 col = texture2D(uColors, vec2((vId + 0.5) / uCount, 0.5)).rgb * uTint;

    // The same limb falloff the ocean gets, at about half strength. Without it
    // the land is a flat sticker on a shaded ball and the sphere stops reading
    // as round the moment a continent crosses the terminator.
    vec3 n = normalize(vDir);
    vec3 view = normalize(cameraPosition - vPos);
    float facing = max(dot(n, view), 0.0);
    float shade = mix(uShade, 1.0, pow(facing, 0.55));
    col *= shade;

    /*
     * Selection — a territory lighting up, and nothing else happening.
     *
     * This block used to be a two-phase ceremony: a decaying white bloom over
     * the chosen country, then a sine breath that never stopped. That is the
     * class of animation the owner rejected by name. A country you have
     * ALREADY clicked does not need to keep asking for attention — the panel
     * beside it is the thing to read, and a surface that pulses under it is
     * just noise you cannot turn off.
     *
     * So the state is now carried entirely by contrast, which costs no motion
     * at all: everything that is NOT the selection drains toward this theme's
     * own unclaimed land and gives up most of its colour, and the selection
     * keeps all of its own plus a crisp accent ring (the outline pass below).
     * The only thing that moves is uSelectMix, eased over ~180ms on the CPU
     * so the planet does not change colour between two frames — and under
     * reduced motion even that is snapped. Pick a country and it is simply,
     * immediately, the only lit thing on the sphere.
     */
    if (uSelectMix > 0.001) {
      if (abs(vId - uSelectedId) < 0.5) {
        if (uStrokePass > 0.5) {
          // The ring. A selected country's outline leaves the claim ramp and
          // becomes the accent shade outright, so the border reads as a hard
          // edge around the territory rather than as a darker step of its fill
          // — and so an UNCLAIMED country, which has no claim colour to darken,
          // gets exactly the same border treatment as a claimed one.
          col = mix(col, uSelectStroke * shade, uSelectMix);
        } else {
          // The fill barely moves: a few degrees warmer, enough to separate it
          // from the drained world without pretending a stake was placed.
          col = mix(col, col * vec3(1.10, 1.02, 0.88), uSelectMix);
        }
      } else {
        // Everything else recedes. Desaturated toward its own luminance first,
        // so the drain reads as colour leaving rather than as a grey wash laid
        // over the top, then mixed toward the theme's land and pulled slightly
        // darker — shaded by the same limb falloff as the fill it replaces, or
        // the far side of the planet would brighten as the near side dimmed.
        float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
        vec3 receded = mix(vec3(lum), uRecede * shade, 0.55) * 0.94;
        col = mix(col, receded, uSelectMix * 0.68);
      }
    }

    /*
     * Hover, applied LAST — after the recede, not before it.
     *
     * This used to sit above the selection block, which meant that once a
     * country was selected the drain ate 68% of every hover wash on the map:
     * the one gesture a visitor needs while a panel is open — "what about THAT
     * country?" — was the one the map had stopped answering. Moved down here,
     * the country under the cursor lights up on a drained world exactly as it
     * does on a full one, so switching countries stays a two-step of hover then
     * click rather than a click into the dark.
     *
     * Skipped on the selected country itself. Hover there would only overwrite
     * the louder state with a quieter one, and "your cursor is here" is not
     * news about the country the panel is already about.
     *
     * The wash lights the whole country, because the id is per vertex and
     * constant across every triangle the country owns. It is warm and only
     * partial, so hover reads as a cursor rather than as a colour change — and
     * specifically not as the faintest rung of the claim ramp, which is the one
     * thing this state must never impersonate.
     */
    if (abs(vId - uHoverId) < 0.5 && abs(vId - uSelectedId) >= 0.5) {
      col = mix(col, uHoverTint, uHoverAmount);
    }

    gl_FragColor = vec4(col, 1.0);
  }
`

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

/** `#RRGGBB` or `rgb(r,g,b)` to three bytes. Both forms come from `fills`. */
function parseColor(value: string, out: Uint8Array, at: number): void {
  if (value.charCodeAt(0) === 35 /* # */) {
    const n = parseInt(value.slice(1), 16)
    out[at] = (n >> 16) & 0xff
    out[at + 1] = (n >> 8) & 0xff
    out[at + 2] = n & 0xff
    return
  }
  const open = value.indexOf('(')
  const parts = value.slice(open + 1, value.indexOf(')')).split(',')
  out[at] = Number(parts[0]) | 0
  out[at + 1] = Number(parts[1]) | 0
  out[at + 2] = Number(parts[2]) | 0
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Stable identity, so the memos below do not churn before the mesh exists. */
const EMPTY_SOURCES: readonly FillSource[] = []

export interface CountryFillsProps {
  /** One entry per country, in the order the ids refer to. */
  sources: readonly FillSource[]
  /** ISO-3166 alpha-2 -> the colour that country is painted, when claimed. */
  fills: ReadonlyMap<string, string>
  /** Colour of unclaimed land. Theme-dependent, so it is passed in. */
  landColor?: string
  /**
   * ISO-3166 alpha-2 of the country to light, or null.
   *
   * An ISO code rather than an index, because an index is only meaningful
   * against the list the *mesh* was built from, and during a resolution upgrade
   * that is not the list the caller is holding. Resolved below.
   */
  hoveredIso2?: string | null
  /** ISO-3166 alpha-2 of the selected country, or null. */
  selectedIso2?: string | null
  /** Outline colour for the selected country. See `GlobePalette.select`. */
  selectStroke?: string
  /**
   * Skip the ~180ms recede ease and switch the world in one frame.
   *
   * Selection is a state, not an animation: under `prefers-reduced-motion` it
   * still arrives in full, it simply arrives at once.
   */
  reducedMotion?: boolean
  /** Theme's hover wash. See `GlobePalette.hover`. */
  hoverTint?: string
  hoverAmount?: number
}

export function CountryFills({
  sources,
  fills,
  landColor = GLOBE_PALETTE_LIGHT.land,
  hoveredIso2 = null,
  selectedIso2 = null,
  selectStroke = GLOBE_PALETTE_LIGHT.select,
  reducedMotion = false,
  hoverTint = HOVER_FALLBACK.tint,
  hoverAmount = HOVER_FALLBACK.amount,
}: CountryFillsProps) {
  const mesh = useFillMesh(sources)
  // Everything below is keyed off the mesh's own country list. See `FillMesh`.
  const countries = mesh?.sources ?? EMPTY_SOURCES

  // --- geometry ------------------------------------------------------------

  const buffers = useMemo(() => {
    if (!mesh) return null

    const position = new THREE.BufferAttribute(mesh.positions, 3)
    const aId = new THREE.BufferAttribute(mesh.ids, 1)
    // Nothing raycasts these and both meshes opt out of frustum culling, so the
    // bound is stated rather than computed over half a million vertices.
    const bounds = new THREE.Sphere(new THREE.Vector3(0, 0, 0), FILL_RADIUS)

    const fill = new THREE.BufferGeometry()
    fill.setAttribute('position', position)
    fill.setAttribute('aId', aId)
    fill.setIndex(new THREE.BufferAttribute(mesh.triangles, 1))
    fill.boundingSphere = bounds

    // Same vertices, different primitive — one upload of 6.8 MB of positions
    // rather than two. The index is a scratch buffer rewritten whenever the
    // standings change; see the effect below.
    const stroke = new THREE.BufferGeometry()
    stroke.setAttribute('position', position)
    stroke.setAttribute('aId', aId)
    const strokeIndex = new THREE.BufferAttribute(
      new Uint32Array(mesh.ringEdges.length),
      1,
    )
    strokeIndex.setUsage(THREE.DynamicDrawUsage)
    stroke.setIndex(strokeIndex)
    stroke.setDrawRange(0, 0)
    stroke.boundingSphere = bounds

    return { fill, stroke, strokeIndex }
  }, [mesh])

  useEffect(
    () => () => {
      buffers?.fill.dispose()
      buffers?.stroke.dispose()
    },
    [buffers],
  )

  // --- colour --------------------------------------------------------------

  /**
   * One RGBA texel per country, `NearestFilter`, never interpolated.
   *
   * This is the whole of what the 8.4-megapixel fill canvas used to be. A
   * standings change now rewrites 238 texels — under a microsecond — instead of
   * repainting 238 `Path2D` objects and re-uploading 33 MB.
   */
  const colorTexture = useMemo(() => {
    const count = Math.max(countries.length, 1)
    const data = new Uint8Array(count * 4)
    const texture = new THREE.DataTexture(data, count, 1, THREE.RGBAFormat)
    texture.minFilter = THREE.NearestFilter
    texture.magFilter = THREE.NearestFilter
    texture.generateMipmaps = false
    // Bytes straight from the design tokens — no decode in, no encode out.
    texture.colorSpace = THREE.NoColorSpace
    texture.needsUpdate = true
    return texture
  }, [countries])

  useEffect(() => () => colorTexture.dispose(), [colorTexture])

  useEffect(() => {
    const data = colorTexture.image.data as Uint8Array
    for (let i = 0; i < countries.length; i += 1) {
      const iso2 = countries[i].iso2
      const paint = iso2 ? fills.get(iso2) : undefined
      parseColor(paint ?? landColor, data, i * 4)
      data[i * 4 + 3] = 255
    }
    colorTexture.needsUpdate = true
  }, [colorTexture, countries, fills, landColor])

  /**
   * Selected ISO -> the index the shader compares against, and the one the
   * outline draw range below has to know about.
   *
   * Resolved here rather than passed as a number, because the index is an
   * implementation detail of the order this mesh happened to be built in, and
   * nothing outside should have to know it — least of all during the frames
   * where the caller's list and the mesh's list are different lengths.
   */
  const selectedId = useMemo(() => {
    if (!selectedIso2) return -1
    const code = selectedIso2.toUpperCase()
    return countries.findIndex((entry) => entry.iso2 === code)
  }, [selectedIso2, countries])

  /**
   * The outlined countries' ring segments, compacted into a draw range.
   *
   * Two countries earn an outline: every CLAIMED one, whose ring is a darker
   * step of its own fill and is what still separates two claimed neighbours
   * now that they share a hue — and the SELECTED one, whose ring is the accent
   * shade. The selected country is included whether or not anybody owns it,
   * because an empty country is exactly the one a visitor is most likely to be
   * inspecting, and "we are showing you this territory" has to be drawable
   * without a stake behind it.
   *
   * Compacting into the front of one index buffer means a single draw call
   * whose length is proportional to what is actually outlined — zero on an
   * empty board with nothing selected, and never the whole world's half a
   * million segments just to ring four countries.
   */
  useEffect(() => {
    if (!mesh || !buffers) return
    const target = buffers.strokeIndex.array as Uint32Array
    const { edgeStart, ringEdges } = mesh
    let at = 0
    for (let i = 0; i < countries.length; i += 1) {
      const iso2 = countries[i].iso2
      if (i !== selectedId && (!iso2 || !fills.has(iso2))) continue
      const from = edgeStart[i]
      const to = edgeStart[i + 1]
      if (to <= from) continue
      target.set(ringEdges.subarray(from, to), at)
      at += to - from
    }
    buffers.stroke.setDrawRange(0, at)
    buffers.strokeIndex.needsUpdate = true
  }, [mesh, buffers, countries, fills, selectedId])

  // --- materials -----------------------------------------------------------

  const materials = useMemo(() => {
    const shared = {
      uColors: { value: colorTexture },
      uCount: { value: Math.max(countries.length, 1) },
      uHoverId: { value: -1 },
      // Seeded from the fallback and written by the effect below on every
      // palette change — a uniform write, never a shader rebuild, so flipping
      // the theme cannot cost a recompile hitch.
      uHoverTint: { value: new THREE.Color(HOVER_FALLBACK.tint) },
      uHoverAmount: { value: HOVER_FALLBACK.amount },
      uSelectedId: { value: -1 },
      uSelectMix: { value: 0 },
      uRecede: { value: new THREE.Color(GLOBE_PALETTE_LIGHT.land) },
      uSelectStroke: { value: new THREE.Color(GLOBE_PALETTE_LIGHT.select) },
      uShade: { value: SHADE },
    }

    const fill = new THREE.ShaderMaterial({
      vertexShader: FILL_VERT,
      fragmentShader: FILL_FRAG,
      uniforms: {
        ...shared,
        uTint: { value: 1 },
        uStrokePass: { value: 0 },
      },
      // Opaque wherever there is land — the ocean is simply not tessellated, so
      // the sphere's own gradient shows through instead of being covered by a
      // second, flatter copy of it. `transparent` is still on so `renderOrder`
      // sorts this against the urban footprints above it.
      transparent: true,
      depthTest: true,
      // Off, so the far hemisphere's fills do not occlude the near one's — the
      // opaque globe body is what hides them, exactly as before.
      depthWrite: false,
      // Natural Earth does not wind its rings consistently and earcut does not
      // impose one, so half the triangles would be backfaces under culling.
      side: THREE.DoubleSide,
      toneMapped: false,
    })

    const stroke = new THREE.ShaderMaterial({
      vertexShader: FILL_VERT,
      fragmentShader: FILL_FRAG,
      uniforms: {
        uColors: shared.uColors,
        uCount: shared.uCount,
        uHoverId: shared.uHoverId,
        uHoverTint: shared.uHoverTint,
        uHoverAmount: shared.uHoverAmount,
        uSelectedId: shared.uSelectedId,
        uSelectMix: shared.uSelectMix,
        uRecede: shared.uRecede,
        uSelectStroke: shared.uSelectStroke,
        uShade: shared.uShade,
        uTint: { value: STROKE_TINT },
        uStrokePass: { value: 1 },
      },
      transparent: true,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    })

    return { fill, stroke, shared }
  }, [colorTexture, countries])

  useEffect(
    () => () => {
      materials.fill.dispose()
      materials.stroke.dispose()
    },
    [materials],
  )

  /**
   * Hovered ISO -> the index the shader compares against.
   *
   * Resolved here rather than passed as a number, because the index is an
   * implementation detail of the order this mesh happened to be built in, and
   * nothing outside should have to know it — least of all during the frames
   * where the caller's list and the mesh's list are different lengths.
   */
  const hoverId = useMemo(() => {
    if (!hoveredIso2) return -1
    const code = hoveredIso2.toUpperCase()
    return countries.findIndex((entry) => entry.iso2 === code)
  }, [hoveredIso2, countries])

  useEffect(() => {
    materials.shared.uHoverId.value = hoverId
  }, [materials, hoverId])

  useEffect(() => {
    materials.shared.uHoverTint.value.set(hoverTint)
    materials.shared.uHoverAmount.value = hoverAmount
  }, [materials, hoverTint, hoverAmount])

  useEffect(() => {
    materials.shared.uRecede.value.set(landColor)
    materials.shared.uSelectStroke.value.set(selectStroke)
  }, [materials, landColor, selectStroke])

  useEffect(() => {
    materials.shared.uSelectedId.value = selectedId
  }, [materials, selectedId])

  /**
   * How far the world has receded, 0 to 1.
   *
   * The uniform cannot simply be `selectedId >= 0 ? 1 : 0` on a full-motion
   * display: that repaints every country on the planet between two frames,
   * which lands as a flash rather than as a focus change. ~180ms of
   * exponential approach is enough to read as the map yielding and short
   * enough that the selection is effectively instant — this is a highlight,
   * not a transition, and nothing waits on it.
   *
   * Held in a ref and written straight to the uniform: it changes every frame
   * for a sixth of a second and React never needs to know.
   */
  const selectMix = useRef(0)

  useFrame((_, delta) => {
    const target = selectedId < 0 ? 0 : 1

    if (reducedMotion) {
      if (selectMix.current !== target) {
        selectMix.current = target
        materials.shared.uSelectMix.value = target
      }
      return
    }

    if (selectMix.current === target) return
    // Clamped so a backgrounded tab does not resume with a several-second jump.
    const step = Math.min(delta, 0.05)
    const rate = 1 - Math.exp(-step * 22)
    selectMix.current += (target - selectMix.current) * rate
    if (Math.abs(target - selectMix.current) < 0.002) selectMix.current = target
    materials.shared.uSelectMix.value = selectMix.current
  })

  if (!buffers) return null

  return (
    <group>
      <mesh
        geometry={buffers.fill}
        material={materials.fill}
        renderOrder={FILL_RENDER_ORDER}
        frustumCulled={false}
      />
      <lineSegments
        geometry={buffers.stroke}
        material={materials.stroke}
        renderOrder={STROKE_RENDER_ORDER}
        frustumCulled={false}
      />
    </group>
  )
}
