import * as THREE from 'three'
import type { GlobePin } from '../../../lib/worldApi'

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
 * How far a seed may be nudged off its city's centroid, in degrees of latitude.
 *
 * 0.065° is 7.23 km, and the number is a measurement, not a taste call. The feed
 * gives every company its CITY's centroid, so in production 2,819 of 5,579 pins
 * share the single coordinate (37.7749, -122.4194) — the whole of YC's San
 * Francisco cohort stacked into one bead that only one company can ever be
 * hovered, clicked or labelled through. San Francisco is the tightest metro on
 * the board, so it sets the ceiling:
 *
 *   - **West.** The centroid is 8.03 km from the surf at Ocean Beach
 *     (-122.5107 at that latitude). At 7.23 km NO seed reaches the Pacific:
 *     run over all 2,819, the westmost lands at -122.50112, 840 m inland. That
 *     is the one hard edge, and the reason the radius is not the 0.08–0.12 the
 *     eye would prefer.
 *   - **North.** 5.0 km to the Golden Gate; past it a pin lands in the strait
 *     or on the Marin headlands. Water, but water with a bridge over it.
 *   - **East.** The bay shoreline is only ~3 km out, so the eastern third of
 *     the disc lies over San Francisco Bay. Unavoidable — SF is a 7 km
 *     peninsula and any disc wide enough to separate 2,819 pins crosses it. The
 *     coarse topology this globe draws at world zoom (`countries-110m`) does not
 *     render the bay at all; the fine one (`countries-10m`) does, and a handful
 *     of seeds will sit on it at city zoom. That is the price, it is paid in the
 *     middle of the Bay Area, and it is ~6,000 km short of another country.
 *
 * Roomier metros are nowhere near their edges: New York's centroid is 15 km
 * from the Atlantic, Los Angeles' 24 km from Santa Monica bay.
 *
 * At world zoom this is deliberately invisible — one globe radius is ~295 px
 * there, so 7.23 km is a third of a pixel. The payoff is at city zoom and in the
 * HIT TEST: `PlotColumns` resolves hover and clicks to the nearest pin by
 * surface direction, and 2,819 identical directions means 2,818 companies that
 * can never be reached with a cursor. Same trade the 2D map made at 0.02° in
 * `WorldMap.tsx`; the globe can afford three times as much because its markers
 * are three times as far apart on screen at the zoom where it matters.
 */
export const SEED_JITTER_DEG = 0.065

/**
 * A stable 32-bit hash of a pin id.
 *
 * Seed ids arrive as `"seed-240"`, where the number is the companies-table row —
 * the same integer `WorldMap.tsx` hashes — so pulling the digits out keeps a
 * company on the same relative offset on both surfaces. Anything without digits
 * falls back to FNV-1a over the whole string, which is still deterministic.
 *
 * Never `Math.random`: an offset that changes per render walks the pin across
 * the map on every re-render, and one that changes per reload means a link to a
 * company points somewhere else tomorrow.
 */
function pinHash(id: string): number {
  const digits = /\d+/.exec(id)
  if (digits) {
    const n = Number(digits[0])
    // Knuth's multiplicative constant, exactly as the 2D map uses it.
    if (Number.isFinite(n)) return Math.imul(n, 2654435761) >>> 0
  }
  let h = 2166136261
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Spread coincident SEED pins over a small disc around their shared centroid.
 *
 * **Paid plots are returned untouched, by identity.** A plot's coordinate is the
 * spot its buyer chose and paid for; moving it — by any amount, for any reason,
 * including "it looked better" — is falsifying the product's central claim. The
 * `kind !== 'seed'` guard below is the whole of that promise, and the identity
 * return is what makes it checkable: `jitterSeeds(pins).filter(p => p.kind ===
 * 'plot')` is reference-equal, element for element, to the input's plots.
 *
 * Uniform over the disc, not over (angle, radius): `sqrt` on the radial term is
 * what stops the offsets piling into the centre, which would defeat the point.
 * The longitude divisor turns degrees of latitude into the degrees of longitude
 * that cover the same ground at that latitude, so the disc is a circle in
 * kilometres rather than an ellipse squashed toward the poles — floored at 0.2
 * (~78°) so a polar pin cannot divide its way to the far side of the planet.
 *
 * Pure and total: same input, same output, no clock, no globals.
 */
export function jitterSeeds(
  pins: readonly GlobePin[],
  radiusDeg = SEED_JITTER_DEG,
): GlobePin[] {
  return pins.map((pin) => {
    if (pin.kind !== 'seed') return pin

    const h = pinHash(pin.id)
    const angle = ((h % 3600) / 3600) * 2 * Math.PI
    const dist = Math.sqrt(((h >>> 12) % 1000) / 1000)
    const r = radiusDeg * dist
    const latRad = (pin.lat * Math.PI) / 180

    const lat = pin.lat + r * Math.cos(angle)
    const lng =
      pin.lng + (r * Math.sin(angle)) / Math.max(Math.cos(latRad), 0.2)

    return {
      ...pin,
      // Clamped and wrapped so a bad feed coordinate cannot produce a pin the
      // sphere maths has no answer for.
      lat: lat > 89.9 ? 89.9 : lat < -89.9 ? -89.9 : lat,
      lng: ((((lng + 180) % 360) + 360) % 360) - 180,
    }
  })
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
 * What a pin's tier honestly says about its stake.
 *
 * The globe feed ships a bucket, not an amount — `_tier_bucket` in
 * `backend/world.py` — so this is the whole truth the client holds about how
 * much is on a pin:
 *
 *   0  a seed. Nothing is staked; it is not a claim at all.
 *   1  at least the $5 floor and under $50
 *   2  $50 – $249
 *   3  $250 – $999
 *   4  $1,000 or more
 *
 * A band is not a guess: every one of those edges is the backend's own, mirrored
 * by hand exactly like `constants.ts` mirrors `world_constants.py`. Anything
 * outside the range the backend currently emits returns `null`, and the caller
 * renders "unknown" — the same rule `cents_to_beat` follows. **Do not invent a
 * midpoint here.** A pin whose bucket this file does not recognise is a pin
 * whose stake this client does not know.
 */
export function stakeBand(tier: number, kind: 'plot' | 'seed'): string | null {
  if (kind === 'seed' || tier <= 0) return null
  switch (tier) {
    case 1:
      return '$5 – $49'
    case 2:
      return '$50 – $249'
    case 3:
      return '$250 – $999'
    case 4:
      return '$1,000+'
    default:
      // A bucket a future backend added. Say so; do not extrapolate the ladder.
      return null
  }
}

/**
 * Pin colours, per theme.
 *
 * `promoted` is YC orange, and it is the only saturated colour on the map —
 * ExploreYC's rule that orange is signal, never decoration, applied literally.
 * Paid pins are a slate ramp getting stronger with tier; a seed (an imported
 * company nobody has claimed) is the quietest mark on the map: present, clearly
 * unowned, obviously claimable — but no longer *invisible*. Every seed value
 * below clears **3:1 against its own land** — 3.17:1 light, 3.19:1 dark —
 * because "quieter" and "not there" are different design instructions and the
 * old palette shipped the second one twice: first at 1.26:1, then at ~2.5:1.
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
 * Both endpoints are chosen against their theme's `land`, not in the abstract,
 * and both were re-measured when the grounds moved to the bright/physical
 * palette (light ground #F2F7FC, soft dark ground #151A22). Every ratio below
 * was computed from the hex values in this file, not estimated:
 *
 * - **Light.** Land is `#EDF2F8` (relative luminance 0.8829). `faint` #FBD9BE
 *   measures 0.7385 — 1.18:1 under the land, a warm tint that is unmistakably
 *   *not* grey without shouting; `strong` #D2621C measures 0.2252, which is
 *   3.39:1 against unclaimed land and 2.87:1 against `faint`, so the ramp is
 *   legible end to end at world view.
 * - **Dark.** Land is `#4A5563` (0.0885) — the soft elevated slate, not the
 *   old near-black #2B3038. Lighter land leaves less headroom under pure
 *   orange, so both ends moved up: `faint` #955429 measures 0.1289 (1.29:1
 *   above land) and `strong` #E0701E measures 0.2753 (2.35:1 above land,
 *   1.82:1 above `faint`) — within a hair of the old ramp's 1.51 / 2.03 spread
 *   on a ground that is now three shades friendlier.
 *
 * Both `strong` ends stay deliberately below pure `#FB651E` (0.2991) in value —
 * light 0.2252, dark 0.2753 — so a promoted pin, the one place the *pure*
 * accent is allowed, still reads as hotter than the ground it stands on.
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
 * How a country reacts to the cursor.
 *
 * One mechanism, two settings, because "brighten" is not a instruction that
 * survives a theme swap: the light map's land is already a near-white
 * (#EDF2F8, luminance 0.8829) and has nowhere left to go toward white, while
 * the dark map's land has all the headroom in the world. So the hovered fill is
 * mixed toward a *warm* target instead — deepening in light, lifting in dark —
 * and the direction of travel is the palette's business, not the shader's.
 *
 * Deliberately NOT pure `--w-accent`: an orange-saturated hover on grey land
 * looks exactly like the faintest rung of the claim ramp, and "your cursor is
 * here" must never be mistakable for "somebody owns this". These are washes
 * from the same warm family, one hue, no second accent.
 */
export interface HoverWash {
  /** Colour the hovered country's own fill is mixed toward. */
  tint: string
  /** How far, 0..1. */
  amount: number
}

/**
 * The globe's ground colours, one set per theme.
 *
 * Both themes now sit on the World design tokens' grounds — light #F2F7FC,
 * dark #151A22 — and the sphere is tuned to read as a friendly object resting
 * on that page rather than as an instrument panel. The dark set in particular
 * is a SOFT ELEVATED night map: its ocean is 1.82:1 *lighter* than the page
 * behind it and its land 2.30:1, so the globe is the brightest thing in the
 * frame. The old near-black terrain (#0B2136 water, #2B3038 land) read as a
 * hole cut in the page, which is the terminal idiom this feature is leaving.
 *
 * Measured against the page ground, from these exact hex values:
 *
 *   LIGHT   ocean #7CC2EA on ground #F2F7FC ....... 1.81:1  (silhouette)
 *           oceanDeep #4E9AD1 on ground .......... 2.84:1  (limb)
 *           land #EDF2F8 over ocean #7CC2EA ...... 1.73:1  (paper on water)
 *           landStroke #C9D5E2 on land ........... 1.32:1  (seams)
 *   DARK    ocean #1F4869 on ground #151A22 ...... 1.82:1
 *           oceanDeep #132D45 on ground .......... 1.24:1  (limb, + rim below)
 *           rim #6098C6 on ground ................ 5.66:1  (edge of the world)
 *           land #4A5563 over ocean #1F4869 ...... 1.27:1  (+ hue + seams)
 *           land #4A5563 on ground ............... 2.30:1
 *           landStroke #6C7A8C on land ........... 1.73:1
 */
export interface GlobePalette {
  ocean: string
  oceanDeep: string
  land: string
  landStroke: string
  /** Rim mixed toward at the limb of the globe body. */
  rim: string
  /**
   * The halo outside the silhouette.
   *
   * Its own token rather than a reuse of `oceanDeep`, which is what it used to
   * be: the halo is blended over the *page*, so it has to be judged against the
   * page. `oceanDeep` in the dark theme (#132D45) is 1.24:1 on the dark ground
   * — an invisible halo — while these values measure 2.26:1 (light, #5FAEDF on
   * #F2F7FC) and 3.93:1 (dark, #4A7CA6 on #151A22).
   */
  halo: string
  /** Graticule minor/major line colours. */
  gridMinor: string
  gridMajor: string
  markers: MarkerPalette
  /** Claimed-country fill, floor to top of board. */
  claim: ClaimRamp
  /** What happens to a country's fill under the cursor. */
  hover: HoverWash
  /**
   * The outline drawn around the SELECTED country — the one the panel is
   * showing.
   *
   * A shade of YC orange, not a second hue: the claim ramp already establishes
   * that this surface has exactly one accent family, and selection is the
   * loudest thing on the map, so it is the closest of them all to the pure
   * accent. Chosen per theme because "orange" is not a contrast ratio — the
   * light map's land is near-white and wants a deep orange, the dark map's
   * land is a mid slate and wants a light one. Measured against each theme's
   * own `land`, from these exact hex values:
   *
   *   LIGHT  #C2410C (luminance 0.1528) on land #EDF2F8 (0.8829) .... 4.60:1
   *   DARK   #FF9A5C (0.4831)          on land #4A5563 (0.0885) .... 3.85:1
   *
   * Both clear the 3:1 floor WCAG 1.4.11 asks of a non-text indicator, and
   * selection never depends on this ring alone — the rest of the world recedes,
   * the country's pill gets its own selected state, and the panel opens.
   */
  select: string
}

export const GLOBE_PALETTE_LIGHT: GlobePalette = {
  ocean: '#7CC2EA',
  oceanDeep: '#4E9AD1',
  land: '#EDF2F8',
  landStroke: '#C9D5E2',
  rim: '#FFFFFF',
  halo: '#5FAEDF',
  gridMinor: '#A2D5F1',
  gridMajor: '#4E9AD1',
  markers: {
    promoted: YC_ORANGE,
    // 3.69:1 on land, 2.13:1 on ocean. Deepened twice now — #8A9DB6 (2.46:1),
    // then #7789A3 (3.17:1), and 3.17 was still not enough: viewed at 1920 and
    // 2560 with the paid layer empty, the several hundred seeds over the United
    // States read as dust on near-white land. Still a full rung lighter than
    // tier 1 (#5A6E8C, 4.61:1), so it stays quieter than a stake — the other
    // half of that fix is size and the narrower white ring, in PlotColumns.
    seed: '#6B7E97',
    // 4.61:1 / 6.91:1 / 10.39:1 against land — the tiers are told apart by
    // value alone, which is what makes the ladder survive a greyscale print.
    ramp: ['#5A6E8C', '#3E5375', '#26385A'],
  },
  claim: { faint: '#FBD9BE', strong: '#D2621C' },
  // Land 0.8829 mixed 0.38 toward #E88B3F resolves to #EBCBB2 — 1.36:1 under
  // its unhovered neighbours, and warm rather than merely darker. It stays
  // 1.15:1 clear of the faintest claim fill, which is the colour it must not be
  // confused with.
  hover: { tint: '#E88B3F', amount: 0.38 },
  select: '#C2410C',
}

export const GLOBE_PALETTE_DARK: GlobePalette = {
  ocean: '#1F4869',
  oceanDeep: '#132D45',
  land: '#4A5563',
  landStroke: '#6C7A8C',
  rim: '#6098C6',
  halo: '#4A7CA6',
  gridMinor: '#316A93',
  gridMajor: '#4A7CA6',
  markers: {
    promoted: YC_ORANGE,
    // 3.19:1 on land, 4.04:1 on ocean. Lifted from #8798AC (2.57:1), which was
    // itself a lift off the pre-soft-ground #55616F. Dark land is bright enough
    // (#4A5563) that the whole ramp only has 7.11:1 of headroom above it, so
    // the seed sits just 1.24:1 under tier 1 (#AFBDCE, 3.97:1) — closer than
    // the light palette's rungs, and deliberately so: in this theme "quieter
    // than a stake" is carried by SIZE (5.0px against 7.4px) and by the pop,
    // which no seed ever gets. Value alone cannot carry it here without pushing
    // the seed back under the 3:1 floor.
    seed: '#9AAABC',
    // 3.97:1 / 5.67:1 / 7.11:1 against land.
    ramp: ['#AFBDCE', '#D5E0EC', '#F4F8FD'],
  },
  claim: { faint: '#955429', strong: '#E0701E' },
  // Land 0.0885 mixed 0.45 toward #FFD3B4 resolves to #9B8E87 — 2.39:1 above
  // its unhovered neighbours, and 1.85:1 clear of the faintest claim fill.
  // Lifting, not deepening, because dark land has the room for it.
  hover: { tint: '#FFD3B4', amount: 0.45 },
  select: '#FF9A5C',
}

/** The palette for a theme flag. The single switch the whole globe reads. */
export function paletteFor(darkMode: boolean): GlobePalette {
  return darkMode ? GLOBE_PALETTE_DARK : GLOBE_PALETTE_LIGHT
}
