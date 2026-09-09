import * as THREE from 'three'

/**
 * Geometry helpers and the globe's two palettes.
 *
 * Ported from startupworld's `src/lib/geo.ts` with one structural change: the
 * theme is no longer sniffed off `document.documentElement` with a
 * MutationObserver — ExploreYC's globe receives `darkMode` as a prop, so the
 * palette is resolved once per render from that boolean and passed down.
 */

export const GLOBE_RADIUS = 1

/**
 * Latitude/longitude to a point on the globe.
 *
 * Note the sign on x: this pairs with the standard equirectangular texture
 * orientation and with `world-atlas` TopoJSON winding, so borders drawn from
 * that data land on the same spots as pins placed from this function. Flip it
 * and every pin sits mirrored across the prime meridian — a bug that looks
 * plausible until you notice London is in Kazakhstan.
 */
export function latLngToVector3(
  lat: number,
  lng: number,
  radius = GLOBE_RADIUS,
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

/** Inverse of `latLngToVector3`, for turning a raycast hit into coordinates. */
export function vector3ToLatLng(v: THREE.Vector3): {
  lat: number
  lng: number
} {
  const n = v.clone().normalize()
  const lat = 90 - (Math.acos(n.y) * 180) / Math.PI
  const lng = ((Math.atan2(n.z, -n.x) * 180) / Math.PI + 360) % 360 - 180
  return { lat, lng }
}

const EARTH_RADIUS_KM = 6371

/** Great-circle distance in kilometres. Used to snap a pin to its city. */
export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(s))
}

/**
 * Marker radius per stake-size tier, in the same units the donor's
 * `stakeToHeight` produced.
 *
 * The API ships a pre-bucketed `tier` (0 = the $5 floor, climbing with stake)
 * rather than raw cents, so the log curve lives server-side. Clamped: an
 * out-of-range tier from a future backend must not draw a dinner plate.
 */
export function tierToHeight(tier: number): number {
  const t = Math.min(Math.max(tier, 0), 6)
  return 0.018 + t * 0.017
}

/**
 * Pin colours, per theme.
 *
 * `promoted` is YC orange, and it is the only saturated colour on the map —
 * ExploreYC's rule that orange is signal, never decoration, applied literally.
 * Paid pins are a slate ramp getting stronger with tier; a seed (an imported
 * company nobody has claimed) is the palest mark on the map: present, clearly
 * unowned, obviously claimable.
 */
export interface MarkerPalette {
  promoted: string
  seed: string
  /** Slate ramp, low tier to high tier. */
  ramp: readonly [string, string, string]
}

/** YC orange — the one saturated hue the map is allowed. */
export const YC_ORANGE = '#FB651E'

export function markerColor(
  palette: MarkerPalette,
  kind: 'plot' | 'seed',
  tier: number,
  promoted: boolean,
): string {
  if (promoted) return palette.promoted
  if (kind === 'seed') return palette.seed
  if (tier >= 4) return palette.ramp[2]
  if (tier >= 2) return palette.ramp[1]
  return palette.ramp[0]
}

/**
 * The claim ramp: one hue, from a faint warm tint to a confident orange.
 *
 * This used to be twelve saturated pastels hashed off the ISO code, so that a
 * country's colour was a property of the country and somebody could say "the
 * purple one is us". That was a nice social property bought at a price the
 * brand does not pay: it put a second, third and twelfth accent hue on a
 * surface whose entire visual argument is that **orange is signal and nothing
 * else is**. On a board with a single claim it rendered the United States in
 * magenta, which is not a colour this product owns.
 *
 * So rank is the only thing the fill encodes now, and it encodes it on one
 * axis of one hue derived from `YC_ORANGE`: value and chroma climb together
 * from `faint` to `strong`. The identity a visitor reads off the globe is the
 * *height* of a country on the board, which is the thing the board is actually
 * about — and two claimed countries are still told apart by their own outline,
 * which `CountryFills` derives from the fill.
 *
 * Both endpoints are chosen against their theme's `land`, not in the abstract:
 *
 * - **Dark.** Land is `#2B3038` (relative luminance 0.029). `faint` measures
 *   0.070 — a contrast of 1.51:1, which is a clear warm shift without the
 *   weakest claim shouting; `strong` measures 0.193, 2.03:1 above `faint`, so
 *   the top of the board is unmistakable at world view.
 * - **Light.** Land is `#E4E7EB` (0.797). `faint` measures 0.630, 1.25:1 under
 *   the land and unmistakably warm against a neutral grey; `strong` measures
 *   0.222, which is 3.11:1 against unclaimed land and 2.50:1 against `faint`.
 *
 * Both `strong` ends stay deliberately below pure `#FB651E` in value, so a
 * promoted pin — the one place the *pure* accent is allowed — still reads as
 * hotter than the ground it stands on.
 */
export interface ClaimRamp {
  /** A country sitting at the $5 floor. */
  faint: string
  /** The top of the board. */
  strong: string
}

/**
 * Where a claimed country sits on the ramp when every claim is at the floor.
 *
 * `t = 0` would be correct and would also render the map's only claim at its
 * faintest, which reads as a rendering failure rather than as a statement about
 * rank. Mid-ramp is the honest answer to "there is nothing to rank yet".
 */
const SOLO_CLAIM_T = 0.55

/**
 * Fill for a claimed country at ramp position `t` (0 = floor, 1 = top).
 *
 * Interpolated in sRGB. Both endpoints sit at ~22° hue, so a straight lerp
 * stays on the ramp's hue instead of bending through brown — the check that
 * makes the cheap interpolation legitimate here rather than merely convenient.
 */
export function claimFill(ramp: ClaimRamp, t: number): string {
  const k = t <= 0 ? 0 : t >= 1 ? 1 : t
  const a = hexToRgb(ramp.faint)
  const b = hexToRgb(ramp.strong)
  const mix = (i: number) => Math.round(a[i] + (b[i] - a[i]) * k)
  return `rgb(${mix(0)},${mix(1)},${mix(2)})`
}

/**
 * Ramp position for a claim of `weight` on a board whose heaviest claim is
 * `max`, where a weight of 1 is a single pin at the $5 floor.
 *
 * Logarithmic and anchored at the floor rather than at zero. Zero stake is not
 * a case — an unclaimed country is grey — so anchoring there wastes the bottom
 * of the ramp on a state that never renders and compresses every real claim
 * into its top half. Anchored at the floor, the cheapest claim on the board is
 * the faintest colour on it and the ramp is used end to end.
 */
export function claimRampT(weight: number, max: number): number {
  const denom = Math.log1p(Math.max(max, 1) - 1)
  if (!(denom > 0)) return SOLO_CLAIM_T
  const t = Math.log1p(Math.max(weight, 1) - 1) / denom
  return t <= 0 ? 0 : t >= 1 ? 1 : t
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

/**
 * The globe's ground colours, one set per theme.
 *
 * Light: a genuinely blue ocean under neutral grey land that reads as paper
 * floating on it. Dark: the same relationships at night — deep water, charcoal
 * land — tuned so the label pills and slate pins keep WCAG-legible contrast.
 */
export interface GlobePalette {
  ocean: string
  oceanDeep: string
  land: string
  landStroke: string
  /** Rim mixed toward at the limb of the globe body. */
  rim: string
  /** Graticule minor/major line colours. */
  gridMinor: string
  gridMajor: string
  markers: MarkerPalette
  /** Claimed-country fill, floor to top of board. */
  claim: ClaimRamp
}

export const GLOBE_PALETTE_LIGHT: GlobePalette = {
  ocean: '#A8D4EE',
  oceanDeep: '#5B9BD5',
  land: '#E4E7EB',
  landStroke: '#C4CAD2',
  rim: '#f6fbff',
  gridMinor: '#b4d6f4',
  gridMajor: '#8fbde6',
  markers: {
    promoted: YC_ORANGE,
    seed: '#C3D0E0',
    ramp: ['#8494AB', '#5B6B84', '#3B4A63'],
  },
  claim: { faint: '#F0C9A4', strong: '#D0621F' },
}

export const GLOBE_PALETTE_DARK: GlobePalette = {
  ocean: '#1D4A6E',
  oceanDeep: '#0B2136',
  land: '#2B3038',
  landStroke: '#454C57',
  rim: '#39536e',
  gridMinor: '#28567a',
  gridMajor: '#356c99',
  markers: {
    promoted: YC_ORANGE,
    seed: '#55616F',
    ramp: ['#94A3B8', '#B8C4D4', '#DCE4EE'],
  },
  claim: { faint: '#6B4028', strong: '#C05E20' },
}

/** The palette for a theme flag. The single switch the whole globe reads. */
export function paletteFor(darkMode: boolean): GlobePalette {
  return darkMode ? GLOBE_PALETTE_DARK : GLOBE_PALETTE_LIGHT
}
