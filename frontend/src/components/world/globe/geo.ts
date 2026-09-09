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
 * The claim palette: saturated pastels, one per claimed country.
 *
 * Ordered so that adjacent entries are far apart on the wheel — hashing is not
 * a permutation, and a palette ordered by hue would hand neighbouring countries
 * near-identical colours.
 */
export const CLAIM_PALETTE = [
  '#A98BE8', // violet
  '#F2A0C0', // pink
  '#6FD1C6', // teal
  '#F5D06A', // yellow
  '#F09A7E', // coral
  '#8FB8EC', // cornflower
  '#B9C3CE', // slate
  '#C8A2E0', // orchid
  '#7FCBA0', // jade
  '#EFB07A', // apricot
  '#E88C99', // rose
  '#9FD5EA', // sky
] as const

/**
 * Fill hue for a claimed country: a deterministic FNV-1a hash of the ISO code.
 *
 * A country's hue is a property of the *country*, not of the current board —
 * it survives a reshuffle, a reload, and a different visitor, because the
 * social value of the map is somebody saying "the purple one is us" and having
 * that still be true tomorrow.
 */
export function claimColor(iso2: string): string {
  const key = iso2.toUpperCase()
  let hash = 0x811c9dc5
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i)
    // FNV prime; Math.imul keeps this in 32-bit integer space.
    hash = Math.imul(hash, 0x01000193)
  }
  return CLAIM_PALETTE[(hash >>> 0) % CLAIM_PALETTE.length]
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
}

/** The palette for a theme flag. The single switch the whole globe reads. */
export function paletteFor(darkMode: boolean): GlobePalette {
  return darkMode ? GLOBE_PALETTE_DARK : GLOBE_PALETTE_LIGHT
}
