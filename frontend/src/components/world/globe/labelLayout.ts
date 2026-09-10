/**
 * The level-of-detail ladder and screen-space label placement.
 *
 * Pure arithmetic. No three.js, no DOM, no React — everything in here is a
 * function of numbers, which is the only reason it can be unit-tested, and
 * unit-testing it is the point: collision resolution is the one part of the
 * label system with real edge cases (boxes that touch but do not overlap,
 * boxes wider than a hash cell, ties in importance, a viewport of zero size),
 * and every one of those is a visible glitch on screen rather than a crash.
 *
 * The rest of the label system — projection, DOM writes, fades — is a thin
 * imperative shell around this file.
 */

// ---------------------------------------------------------------------------
// Small maths
// ---------------------------------------------------------------------------

export function clamp01(x: number): number {
  if (!(x > 0)) return 0 // also catches NaN
  return x > 1 ? 1 : x
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (!(edge1 > edge0)) return x < edge0 ? 0 : 1
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

// ---------------------------------------------------------------------------
// The ladder
// ---------------------------------------------------------------------------

export type LodTier = 'far' | 'mid' | 'near' | 'veryNear'

/**
 * Tier boundaries, in camera distance from the globe centre (globe radius 1).
 *
 * The camera envelope is 1.34 → 4.8, so this is a 3.6× range and the four
 * bands below split it roughly evenly in *visible ground area*, which is what
 * the eye actually reads, rather than evenly in distance.
 *
 * `far` starts at 3.15 rather than at some rounder number because that is
 * exactly where `populationFloor` climbs past Tokyo — above it there is no
 * city on Earth large enough to draw, so a separate "cities off" threshold
 * would only be a second place for the same fact to live.
 */
export const LOD_TIER_MIN = {
  far: 3.15,
  mid: 2.3,
  near: 1.72,
  veryNear: 0,
} as const

export function tierForDistance(distance: number): LodTier {
  if (!Number.isFinite(distance)) return 'far'
  if (distance >= LOD_TIER_MIN.far) return 'far'
  if (distance >= LOD_TIER_MIN.mid) return 'mid'
  if (distance >= LOD_TIER_MIN.near) return 'near'
  return 'veryNear'
}

/**
 * Population a city must clear to be a label candidate, by camera distance.
 *
 * Piecewise, interpolated on log10(population) rather than on population, so
 * the ramp is even to the eye: the step from 100k to 1M has to feel like the
 * step from 1M to 10M, and linear interpolation would spend nine tenths of the
 * zoom range crossing the top decade.
 *
 * The stops are chosen so the brief's ladder falls out in the middle of each
 * band — ~3M through `mid`, ~500k through `near`, everything by the floor of
 * the envelope — instead of switching on the boundary, where a threshold is a
 * cliff a user can feel.
 */
const POP_FLOOR_STOPS: ReadonlyArray<readonly [distance: number, population: number]> = [
  [4.8, 1e12],
  [3.3, 1e9],
  [3.05, 4.0e6],
  [2.3, 1.2e6],
  [1.72, 2.5e5],
  // The bottom of the envelope. Kept equal to `CAMERA_MIN_DISTANCE` — written
  // out rather than referenced because that constant is declared further down
  // — so the ramp finishes exactly as the camera runs out of room.
  [1.09, 0],
]

export function populationFloor(distance: number): number {
  if (!Number.isFinite(distance)) return POP_FLOOR_STOPS[0][1]
  if (distance >= POP_FLOOR_STOPS[0][0]) return POP_FLOOR_STOPS[0][1]

  const last = POP_FLOOR_STOPS[POP_FLOOR_STOPS.length - 1]
  if (distance <= last[0]) return last[1]

  for (let i = 0; i < POP_FLOOR_STOPS.length - 1; i += 1) {
    const [dHi, pHi] = POP_FLOOR_STOPS[i]
    const [dLo, pLo] = POP_FLOOR_STOPS[i + 1]
    if (distance <= dHi && distance >= dLo) {
      const t = (distance - dLo) / (dHi - dLo)
      const a = Math.log10(pLo + 1)
      const b = Math.log10(pHi + 1)
      return 10 ** (a + (b - a) * t) - 1
    }
  }

  return last[1]
}

/**
 * How many decades of population a city fades in over.
 *
 * This is what stops labels popping. The floor sweeps down continuously as the
 * camera approaches, and a city's opacity is how far past the floor it already
 * is — so a city does not appear, it resolves, over roughly 0.45 decades
 * (a factor of ~2.8 in population, which at the ramp above is a good half
 * second of unhurried zooming).
 */
export const POP_FADE_DECADES = 0.45

/** Opacity for a city of `population` against a floor of `floor`. */
export function popFade(
  population: number,
  floor: number,
  decades = POP_FADE_DECADES,
): number {
  if (!Number.isFinite(floor)) return 0
  const a = Math.log10(Math.max(population, 0) + 1)
  const b = Math.log10(Math.max(floor, 0) + 1)
  return clamp01((a - b) / decades)
}

/**
 * `dot(surfaceNormal, cameraDirection)` at the horizon, for a unit sphere seen
 * from `distance`.
 *
 * Exact rather than a tuned constant: the visible cap genuinely shrinks as the
 * camera pulls back, and a fixed threshold either leaks labels round the limb
 * when close or clips a third of the visible hemisphere when far.
 */
export function horizonDot(distance: number): number {
  if (!(distance > 1)) return 1
  return 1 / distance
}

/** Extra margin past the mathematical horizon before a label is fully on. */
export const LIMB_INSET = 0.015
/** Width of the dissolve band, in units of the same dot product. */
export const LIMB_BAND = 0.085

/**
 * Opacity from the backface test.
 *
 * Fades rather than clips. A label that vanishes the instant it crosses the
 * limb reads as a bug — the eye sees a blink, not an occlusion — where a
 * dissolve over the last few degrees reads as the planet curving away.
 */
export function limbFade(
  facing: number,
  distance: number,
  inset = LIMB_INSET,
  band = LIMB_BAND,
): number {
  const h = horizonDot(distance) + inset
  return smoothstep(h, h + band, facing)
}

/**
 * Opacity of the plot-label layer.
 *
 * Plot names are the densest thing on the map and the only labels that can sit
 * on top of each other three deep in a city, so they arrive last: nothing until
 * the camera is well inside `near`, full by `veryNear`.
 */
export function plotLabelFade(distance: number): number {
  return 1 - smoothstep(LOD_TIER_MIN.near, 2.0, distance)
}

/**
 * Opacity of the urban-footprint layer.
 *
 * The footprints are the `near` tier's terrain: they begin to arrive exactly as
 * the camera crosses out of `mid`, and are fully on well before the tier ends.
 *
 * The two stops are chosen from how much ground a footprint covers on screen
 * rather than from where the tier boundaries happen to sit. At 2.3 the camera
 * sees a 5,700 km band, so a 20 km city is three pixels — nothing on its own,
 * but the Randstad, the Ruhr, the Nile and the Boston-Washington corridor all
 * resolve as continuous built-up ground, which is the first moment the layer
 * says anything true. By 1.8 a single city is a shape with a size, and from
 * there down it is the thing the map is about.
 *
 * Above 2.3 the layer is not merely transparent, it is switched off — see
 * `UrbanAreas`. 158,638 triangles that cannot be seen are still 182,394 vertex
 * shader invocations a frame.
 */
export const URBAN_FADE_START = 2.3
export const URBAN_FADE_FULL = 1.8

export function urbanFade(distance: number): number {
  if (!Number.isFinite(distance)) return 0
  return 1 - smoothstep(URBAN_FADE_FULL, URBAN_FADE_START, distance)
}

/**
 * Fastest the urban layer is allowed to change opacity, in opacity per second.
 *
 * The ladder's contract is that nothing on this globe pops: the largest single
 * frame opacity step anywhere in the label system measures 0.228. `urbanFade`
 * alone cannot guarantee that — it is a function of camera distance, and a
 * wheel flick or a `flyTo` can cross the whole 2.3 → 1.8 band inside two
 * frames, which would hand a quarter of a million triangles their full opacity
 * in one.
 *
 * So the target is approached at a bounded rate instead. At the 0.1 s frame
 * cap this module already uses for fades, 2.2/s is a step of 0.22 — inside the
 * ladder's measured worst case, with room to spare — and a full fade takes
 * 0.45 s, which is the same unhurried half-second a city name takes to resolve.
 */
export const URBAN_FADE_RATE = 2.2

/**
 * Move `current` toward `target` by at most `maxStep`.
 *
 * Linear rather than exponential, and that is the point: an exponential ease
 * has no bound on its first step, so it cannot be used to make a promise about
 * the largest change a single frame may contain. This can.
 */
export function rampToward(
  current: number,
  target: number,
  maxStep: number,
): number {
  if (!Number.isFinite(current)) return target
  const delta = target - current
  if (!(maxStep > 0)) return target
  if (delta > maxStep) return current + maxStep
  if (delta < -maxStep) return current - maxStep
  return target
}

/**
 * How many country labels the camera is allowed to ask for, at `distance`.
 *
 * This used to take a `LodTier` and return 6 / 14 / 24 — a three-way switch, so
 * crossing 3.15 put eight country names on screen in one frame and crossing 2.3
 * put ten more. The pool fades each new label in, but ten simultaneous fades is
 * a wipe, not a resolve, and it is exactly the "hard switch" the merged globe is
 * moving away from: the deck.gl map derived every layer's strength from one
 * continuous zoom number and quantized it, so its layers cross-faded instead of
 * flipping.
 *
 * Same three anchors, interpolated between. Smoothstepped rather than linear so
 * the count does not accelerate into a tier boundary, and rounded — a budget is
 * a count — which is what makes the labels arrive ONE at a time, each with its
 * own 150 ms fade, all the way down the envelope.
 */
export function countryLabelBudgetAt(distance: number): number {
  if (!Number.isFinite(distance)) return 6
  // far end (>= 3.15) → 6; mid (2.3) → 14; near and below → 24.
  if (distance >= LOD_TIER_MIN.far) return 6
  // `smoothstep` requires ascending edges and returns 0/1 flat when handed
  // descending ones — so the ramps are written low-to-high and inverted, the
  // same way `urbanFade` and `plotLabelFade` above do it. Written the other way
  // round this function silently degrades back into the three-way switch it
  // replaced, which is exactly what it did until a harness measured it.
  if (distance >= LOD_TIER_MIN.mid) {
    return Math.round(
      6 + 8 * (1 - smoothstep(LOD_TIER_MIN.mid, LOD_TIER_MIN.far, distance)),
    )
  }
  return Math.round(
    14 + 10 * (1 - smoothstep(LOD_TIER_MIN.near, LOD_TIER_MIN.mid, distance)),
  )
}

/**
 * How many CITY names may be drawn at `distance`.
 *
 * The city layer had no ceiling — only a population floor that fell as the
 * camera came in — and on the merged globe that turned out to be a road atlas
 * wearing the product's clothes: flying to San Francisco drew forty white pills
 * reading Yakima, Roseburg, Medford, Redding, Bakersfield, and one 42px tile
 * belonging to the company that had paid the most money on the platform. Every
 * pill was the same shape, the same colour and the same weight as the paid
 * one, so the thing being sold was outnumbered forty to one by scenery.
 *
 * A city name is orientation, and orientation needs about a dozen of them —
 * past that it is a hatch pattern made of type, which the layer's own header
 * already said. So: a hard budget on the same smoothstepped ramp as the country
 * one. Cities holding paid plots are ranked far above their population (see
 * `cityPriority`), so a tighter budget spends itself on the contested cities
 * first — the budget makes the product MORE visible, not less.
 */
export function cityLabelBudgetAt(distance: number): number {
  if (!Number.isFinite(distance)) return 0
  // Above `far` the layer does not draw at all; mid (2.3) → 8; near and
  // below → 16.
  if (distance >= LOD_TIER_MIN.far) return 0
  if (distance >= LOD_TIER_MIN.mid) {
    return Math.round(
      8 * (1 - smoothstep(LOD_TIER_MIN.mid, LOD_TIER_MIN.far, distance)),
    )
  }
  return Math.round(
    8 + 8 * (1 - smoothstep(LOD_TIER_MIN.near, LOD_TIER_MIN.mid, distance)),
  )
}

/**
 * …of which at most this many may be countries nobody has bought into.
 *
 * WHY THIS EXISTS. `countryLabelBudgetAt` ranks claimed countries above every
 * unclaimed one, but a budget of six on a planet with three customers still
 * spends the other three slots on whichever empty landmasses have the most
 * coastline — and the first thing a visitor read on the merged globe was
 * "Greenland unclaimed / Canada unclaimed / Mexico unclaimed / Brazil unclaimed
 * / Chile unclaimed" with one paid pill among them. That is an atlas of
 * emptiness, and this page is an advertisement: the loudest labels have to be
 * the places somebody paid for.
 *
 * So the empty ones get their own, much tighter ceiling, on the same
 * smoothstepped ramp as the budget itself — a whisper at orbit, opening up as
 * the camera comes in and there is room to say more. The invitation is not
 * deleted, it is stopped from being the headline.
 *
 * The caller applies this ONLY when something has actually been claimed; a
 * globe with nothing sold has no advertisers to protect and falls back to the
 * full budget, so a cold-start planet still names the places on it.
 */
export function unclaimedCountryBudgetAt(distance: number): number {
  if (!Number.isFinite(distance)) return 2
  // far end (>= 3.15) → 2; mid (2.3) → 6; near and below → 14.
  if (distance >= LOD_TIER_MIN.far) return 2
  if (distance >= LOD_TIER_MIN.mid) {
    return Math.round(
      2 + 4 * (1 - smoothstep(LOD_TIER_MIN.mid, LOD_TIER_MIN.far, distance)),
    )
  }
  return Math.round(
    6 + 8 * (1 - smoothstep(LOD_TIER_MIN.near, LOD_TIER_MIN.mid, distance)),
  )
}

// ---------------------------------------------------------------------------
// Continuous zoom ramps
// ---------------------------------------------------------------------------

/**
 * Snap a 0..1 strength to `steps` rungs.
 *
 * Ported in spirit from `DeckMap.quantize` (which used twentieths). The point is
 * not the arithmetic, it is what the arithmetic buys: a value derived from
 * camera distance changes on every frame of every wheel flick, and anything
 * expensive keyed on it — an instance buffer, a memoised layer array — would be
 * rebuilt sixty times a second for changes the eye cannot see. Twentieths are
 * finer than a fade can be perceived at and coarse enough that a full sweep of
 * the envelope costs twenty rebuilds instead of six hundred.
 */
export function quantize(value: number, steps = 20): number {
  const k = steps > 0 ? steps : 20
  return Math.round(clamp01(value) * k) / k
}

/**
 * The density layer's window, in camera distance (globe radii).
 *
 * These are `DeckMap`'s hexagon stops converted through
 * `mercatorZoomToDistance` (see `tour.ts`), not numbers picked by eye: the 2D
 * map faded its aggregate layer in over Mercator zoom 1.9→2.8 and back out over
 * 3.6→4.6, which is 4.34→2.79 and 2.03→1.51 in globe distance. The shape of the
 * idea survives the projection change — an aggregate that is useless from orbit,
 * says something true at continent range, and gets out of the way once the
 * individual pins are worth looking at.
 */
export const DENSITY_IN_FAR = 4.34
export const DENSITY_IN_NEAR = 2.79
export const DENSITY_OUT_FAR = 2.03
export const DENSITY_OUT_NEAR = 1.51

/** Density-layer strength at `distance`, 0..1. Quantize before spending on it. */
export function densityFade(distance: number): number {
  if (!Number.isFinite(distance)) return 0
  const rampIn = clamp01(
    (DENSITY_IN_FAR - distance) / (DENSITY_IN_FAR - DENSITY_IN_NEAR),
  )
  const rampOut = clamp01(
    (distance - DENSITY_OUT_NEAR) / (DENSITY_OUT_FAR - DENSITY_OUT_NEAR),
  )
  return Math.min(rampIn, rampOut)
}

/**
 * How much of its size a SEED bead keeps while the density layer is up.
 *
 * The other half of a cross-fade: `DeckMap` dimmed its company dots to 15% as
 * the hexagons arrived (`1 - hexOpacity * 0.85`), because two representations of
 * the same 5,579 rows drawn at full strength is not a map, it is a smear. Same
 * coefficient here, and the same 0.15 floor.
 *
 * **Paid plots are exempt and always at full size.** They are what the globe is
 * selling; an aggregate blob is never allowed to stand in front of one. So the
 * cross-fade runs between the density discs and the SEED field only.
 */
export function seedScaleForDensity(densityStrength: number): number {
  return 1 - 0.85 * clamp01(densityStrength)
}

// ---------------------------------------------------------------------------
// Camera feel
// ---------------------------------------------------------------------------

/**
 * How close the camera may get, in globe radii.
 *
 * Was 1.34, then 1.09, and is now 1.06 — but the interesting part of that
 * history is that **1.09 did not work**. `Globe.tsx` fixes the camera's near
 * plane at 0.1, and 1.09 is an altitude of 0.09, so every square metre of
 * ground the camera was pointing at sat inside the near plane and was clipped.
 * Measured at the old floor: no ocean, no country fill, no footprints — just
 * the tops of plot columns and their labels floating on the page background.
 * The last stop of the zoom rendered an empty map, and because the labels
 * survived it read as a styling bug rather than as clipping. The ground came
 * back at 1.107 and was gone again by 1.095, which is exactly where the
 * arithmetic says the cliff is.
 *
 * The fix is in `GlobeScene`, which now tracks the near plane to altitude
 * instead of pinning it; see the note in `Rig`. With that in place the floor is
 * set by what the map can support rather than by the projection, and the number
 * stays at 1.09 — which is not the same thing as nothing having changed. It
 * used to be a stop that rendered an empty map; it is now a stop that renders
 * Greater Tokyo as a shape you can see the edges of.
 *
 * Going lower was tried, measured and rejected, in that order:
 *
 *   - **Urban footprints** are vector geometry and stay crisp all the way to
 *     1.035. They are not the constraint.
 *   - **The country fill** is a 4096-wide texture at 9.8 km per texel. Its
 *     coastlines are soft by 1.06 and mush below about 1.05.
 *   - **Plot markers** are the actual blocker. They are ~100 km across in world
 *     units — symbolic rather than physical, and exactly right at world view —
 *     so they do not shrink as you descend. The frame is 395 km tall at 1.09
 *     and 263 km at 1.06, so a single marker goes from a quarter of the height
 *     to nearly two fifths, and at 1.06 it is wider than Sofia's entire
 *     built-up area. That destroys the one thing this zoom level exists to say:
 *     *your plot is inside this city*.
 *
 * Shrinking the markers with altitude — in `PlotColumns` — is what would unlock
 * the last of the envelope. Until then, lowering this number only buys a closer
 * look at a marker.
 */
export const CAMERA_MIN_DISTANCE = 1.09
export const CAMERA_MAX_DISTANCE = 4.8

/**
 * Wheel sensitivity, scaled by altitude rather than held constant.
 *
 * OrbitControls dollies multiplicatively, so a wheel tick already moves you a
 * fixed *fraction of the distance to the globe centre*. That is the wrong
 * quantity. What the eye measures is altitude above the surface, and at the
 * bottom of the envelope altitude is a fifth of distance — so the same tick
 * that feels like a nudge from far away is a fifth of the remaining gap up
 * close, which is the exact lurch that makes 3D globes feel broken near the
 * ground.
 *
 * Normalised so the far end keeps the tuned `base` and only the near end slows.
 */
export function zoomSpeedForDistance(distance: number, base: number): number {
  const d = Math.max(distance, CAMERA_MIN_DISTANCE)
  const ratio = (d - 1) / d
  const reference = (CAMERA_MAX_DISTANCE - 1) / CAMERA_MAX_DISTANCE
  const k = clamp01(ratio / reference)
  // Floored at a quarter: below that a wheel tick stops registering at all,
  // which reads as a dead control rather than a precise one.
  return base * (0.25 + 0.75 * k)
}

/**
 * Drag sensitivity, same treatment, gentler curve.
 *
 * Rotation does not have the multiplicative-dolly problem, but it has the same
 * perceptual one: a drag that sweeps a continent from orbit whips the ground
 * past at close range, because the same angle covers far less screen.
 */
export function rotateSpeedForDistance(distance: number, base: number): number {
  const d = Math.max(distance, CAMERA_MIN_DISTANCE)
  const t = clamp01(
    (d - CAMERA_MIN_DISTANCE) / (CAMERA_MAX_DISTANCE - CAMERA_MIN_DISTANCE),
  )
  return base * (0.45 + 0.55 * t)
}

// ---------------------------------------------------------------------------
// Screen-space placement
// ---------------------------------------------------------------------------

export interface LabelBox {
  /** Stable across frames. Placement hysteresis is keyed on it. */
  id: string
  /** Left edge, in CSS pixels from the top-left of the viewport. */
  x: number
  /** Top edge, in CSS pixels. */
  y: number
  w: number
  h: number
  /** Higher wins a collision. Ties break on `id`, so runs are reproducible. */
  priority: number
}

export interface LayoutOptions {
  /** Nothing beyond this many labels is drawn, at any zoom. */
  maxLabels?: number
  /** Breathing room added around every box before testing overlap. */
  padding?: number
  viewportWidth?: number
  viewportHeight?: number
  /** How far outside the viewport a box may sit before it is culled. */
  margin?: number
  /** Spatial hash cell, in pixels. Only affects speed, never the result. */
  cellSize?: number
}

export interface LayoutResult {
  /** Winners, in placement order. */
  placed: string[]
  placedSet: Set<string>
  /** Candidates offered. */
  considered: number
  /** Rejected for being off-screen or degenerate. */
  culled: number
  /** Rejected for overlapping something more important. */
  collided: number
  /** Rejected because the cap was already full. */
  capped: number
}

/**
 * Breathing room kept between a label pill and the edge of the canvas.
 *
 * Matches the 6px the pill's own drop shadow needs to land inside the frame —
 * clamping flush to zero puts a shadow half outside the canvas, which reads as
 * the pill still being clipped.
 */
export const LABEL_EDGE_INSET = 6

/**
 * Slide a label back inside the viewport, or report that it cannot go.
 *
 * `layoutLabels` culls only boxes that are *entirely* outside the frame, which
 * is correct for collision purposes and is exactly why a label anchored near an
 * edge used to render half off it — on a 375px phone the United States pill is
 * wider than a third of the screen, and it came out as "d States of America".
 * Clipping a label is worse than not drawing it: a truncated country name is
 * indistinguishable from a rendering bug.
 *
 * So the pill is nudged back in, up to `maxShift`, and dropped past that.
 * `maxShift` is what keeps the nudge honest — a pill dragged far enough from
 * its anchor is no longer pointing at anything, so a caller passes the distance
 * beyond which the label would start lying about where its country is.
 *
 * Returns the new start coordinate, or `null` when the label should be dropped
 * (needed more than `maxShift`, or is simply wider than the viewport).
 */
export function clampLabelSpan(
  start: number,
  size: number,
  extent: number,
  maxShift: number,
  inset = LABEL_EDGE_INSET,
): number | null {
  if (!Number.isFinite(start) || !(size > 0)) return null

  // A pill wider than the frame cannot be placed at all; there is no position
  // where it is not clipped, so no amount of sliding helps.
  const room = extent - size - inset * 2
  if (!(room >= 0)) return null

  const lo = inset
  const hi = inset + room
  const next = start < lo ? lo : start > hi ? hi : start
  return Math.abs(next - start) > maxShift ? null : next
}

/**
 * Left edge for a pill that hangs off the side of a dot, `leader` pixels clear
 * of it — the city and plot layers, where the mark is the dot and the pill is
 * its caption.
 *
 * Right first, because a caption reading away from its dot is the convention
 * every atlas uses. If the pill will not fit there it is mirrored to the left
 * of the dot at the same gap, which is why a city on the right edge keeps its
 * name instead of losing it. Only when neither side fits is it dropped.
 *
 * Neither side is allowed to slide more than `leader`, which is exactly the
 * distance at which the pill would reach the dot. Past that the pill would
 * cover the mark it is naming — and a name sitting on top of the thing it
 * labels is how you hide a city behind its own caption.
 */
export function anchoredLabelX(
  anchorX: number,
  size: number,
  leader: number,
  extent: number,
  inset = LABEL_EDGE_INSET,
): number | null {
  const right = clampLabelSpan(anchorX + leader, size, extent, leader, inset)
  if (right !== null) return right
  return clampLabelSpan(anchorX - leader - size, size, extent, leader, inset)
}

/**
 * How much a label's importance is multiplied by while it is already on screen.
 *
 * Applied by the caller, not here, but it belongs next to the algorithm it
 * exists to stabilise. Without hysteresis two labels of near-equal importance
 * trade the same slot every few frames as the projection jitters, and the
 * result flickers exactly when the user is moving — which is when they are
 * looking. A third again is enough to hold a decision and not enough to keep a
 * label that has genuinely been outranked.
 */
export const STICKY_PRIORITY_BONUS = 1.35

/** Default label cap. Past this it is noise, and it stops being free. */
export const MAX_LABELS = 120

/**
 * Greedy placement, most important first, on a uniform spatial hash.
 *
 * Greedy is the right algorithm here and not a compromise: the alternative —
 * maximising the number of labels placed — routinely drops a capital city to
 * fit two villages, which is worse cartography and would also have to run in
 * under a millisecond, sixty times a second, on whatever laptop the visitor
 * brought.
 *
 * Boxes are inserted into every cell they touch, not just the cell containing
 * their origin. A label is commonly wider than a cell, and indexing by origin
 * alone silently misses collisions between a wide box and anything to its
 * right — which looks like the collision test randomly not working.
 */
export function layoutLabels(
  boxes: readonly LabelBox[],
  options: LayoutOptions = {},
): LayoutResult {
  const {
    maxLabels = MAX_LABELS,
    padding = 2,
    viewportWidth = Number.POSITIVE_INFINITY,
    viewportHeight = Number.POSITIVE_INFINITY,
    margin = 0,
    cellSize = 72,
  } = options

  const placed: string[] = []
  const placedSet = new Set<string>()
  const result: LayoutResult = {
    placed,
    placedSet,
    considered: boxes.length,
    culled: 0,
    collided: 0,
    capped: 0,
  }

  if (boxes.length === 0 || maxLabels <= 0) {
    result.capped = maxLabels <= 0 ? boxes.length : 0
    return result
  }

  const cell = cellSize > 0 ? cellSize : 72
  const minX = -margin
  const minY = -margin
  const maxX = viewportWidth + margin
  const maxY = viewportHeight + margin

  // Index-sorted rather than array-sorted: the caller's array is not ours to
  // reorder, and copying 400 objects per frame to sort them is 400 objects of
  // garbage per frame.
  const order: number[] = []
  for (let i = 0; i < boxes.length; i += 1) order.push(i)

  order.sort((a, b) => {
    const d = boxes[b].priority - boxes[a].priority
    if (d !== 0) return d
    return boxes[a].id < boxes[b].id ? -1 : boxes[a].id > boxes[b].id ? 1 : 0
  })

  // Accepted boxes, flat: x0, y0, x1, y1 per entry.
  const bounds: number[] = []
  const grid = new Map<number, number[]>()

  for (let n = 0; n < order.length; n += 1) {
    const box = boxes[order[n]]

    if (placed.length >= maxLabels) {
      result.capped += 1
      continue
    }

    const w = box.w
    const h = box.h
    if (
      !Number.isFinite(box.x) ||
      !Number.isFinite(box.y) ||
      !(w > 0) ||
      !(h > 0)
    ) {
      result.culled += 1
      continue
    }

    const x0 = box.x - padding
    const y0 = box.y - padding
    const x1 = box.x + w + padding
    const y1 = box.y + h + padding

    // Off-screen. Tested on the unpadded box so a label is not kept alive by
    // its own breathing room.
    if (
      box.x + w < minX ||
      box.x > maxX ||
      box.y + h < minY ||
      box.y > maxY
    ) {
      result.culled += 1
      continue
    }

    const cx0 = Math.floor(x0 / cell)
    const cy0 = Math.floor(y0 / cell)
    const cx1 = Math.floor(x1 / cell)
    const cy1 = Math.floor(y1 / cell)

    let free = true
    outer: for (let cy = cy0; cy <= cy1 && free; cy += 1) {
      for (let cx = cx0; cx <= cx1; cx += 1) {
        const bucket = grid.get(cellKey(cx, cy))
        if (bucket === undefined) continue
        for (let k = 0; k < bucket.length; k += 1) {
          const o = bucket[k] * 4
          // Strict inequalities: boxes that share an edge do not overlap, and
          // rejecting those would thin out a dense coastline for no reason.
          if (
            x0 < bounds[o + 2] &&
            bounds[o] < x1 &&
            y0 < bounds[o + 3] &&
            bounds[o + 1] < y1
          ) {
            free = false
            break outer
          }
        }
      }
    }

    if (!free) {
      result.collided += 1
      continue
    }

    const slot = bounds.length / 4
    bounds.push(x0, y0, x1, y1)
    for (let cy = cy0; cy <= cy1; cy += 1) {
      for (let cx = cx0; cx <= cx1; cx += 1) {
        const key = cellKey(cx, cy)
        const bucket = grid.get(key)
        if (bucket === undefined) grid.set(key, [slot])
        else bucket.push(slot)
      }
    }

    placed.push(box.id)
    placedSet.add(box.id)
  }

  return result
}

/**
 * Cell coordinates → one integer key.
 *
 * Cells are negative on two of four sides of a viewport, so the bias is not
 * optional. ±16384 cells at 72px covers ±1.1M pixels of screen, which no
 * display will reach and no projection can produce, because candidates are
 * culled to the viewport plus a margin before they get here.
 *
 * Multiplied rather than shifted: `<<` would have to be sized exactly to the
 * bias, and a bias one larger than the shift silently folds two distant cells
 * onto the same key, which shows up as two labels refusing to coexist for no
 * visible reason.
 */
const CELL_BIAS = 16384
const CELL_STRIDE = CELL_BIAS * 2 + 1

function cellKey(cx: number, cy: number): number {
  return (cx + CELL_BIAS) * CELL_STRIDE + (cy + CELL_BIAS)
}
