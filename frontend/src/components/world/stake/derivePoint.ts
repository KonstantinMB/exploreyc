/**
 * Where a country-level stake actually lands on the globe.
 *
 * THE MODEL CHANGED, THE STORAGE DID NOT. Buyers now bid on a COUNTRY — "Stake
 * on Kenya" — but `world_plots` stores a plot at a latitude and a longitude,
 * and `POST /api/world/checkout` resolves the country from that pair server
 * side. So the coordinate still has to exist; it simply stops being something a
 * buyer has to hunt for. This module is the whole of that translation, and it
 * is deliberately the only place in the feature that invents a coordinate.
 *
 * FOUR RULES IT HAS TO HOLD AT ONCE:
 *
 *   1. **On land, inside the country the buyer chose.** The checkout endpoint
 *      answers `400 {"detail":"ocean"}` for a point in open water and resolves
 *      a border point to whichever country actually contains it. Both of those
 *      would be a charge the buyer did not ask for, or an error after they had
 *      already decided to pay. So every candidate is confirmed against
 *      `GET /api/world/where` — the same server geography checkout will use —
 *      before it is offered as the point.
 *   2. **Deterministic.** No `Math.random`. Two buyers whose stakes land in the
 *      same country must not stack on one bead, and the same buyer reloading
 *      the page must not watch their spot move. The offset comes from a hash of
 *      a caller-supplied seed, exactly the technique `globe/geo.ts#jitterSeeds`
 *      uses for the imported layer.
 *   3. **Somewhere a person would recognise.** A country centroid is a field in
 *      the middle of nowhere, and for a concave country (Norway, Indonesia,
 *      Croatia) it is often not even in the country. Cities are: the reference
 *      set behind `/api/world/cities` is population-ordered, real, and already
 *      fetched once per page by the claim page's search. So the first choice is
 *      a real city, and the centroid is the last resort rather than the first.
 *   4. **Refinable afterwards.** Picking an exact coordinate is not gone; it
 *      moved to /world/claim, after the purchase, where it belongs. Nothing in
 *      here is permanent in a way the owner cannot change later.
 */

import { loadCities, type City } from '../claim/cityIndex'
import worldApi from '../../../lib/worldApi'

/**
 * How far a derived point may sit from its city centre, in degrees of latitude.
 *
 * 0.045° is about 5.0 km — deliberately tighter than the 0.065° the imported
 * seed layer uses. A seed only has to be separable under a cursor; this point
 * has to survive `resolve_country`, which runs against a coarse world topology
 * where a coastal city's 7 km disc reaches open water and a 400 is the buyer's
 * problem rather than a rendering artefact. 5 km still separates two plots at
 * city zoom, which is the whole requirement.
 */
export const COUNTRY_JITTER_DEG = 0.045

/** How many candidates are worth a round trip before falling back. */
const MAX_PROBES = 4

/** Cities considered for the primary pick, most populous first. */
const CITY_POOL = 6

/**
 * A stable 32-bit hash. FNV-1a — same family as `globe/geo.ts#pinHash`, and
 * chosen for the same reason: it is deterministic across reloads, machines and
 * builds, which `Math.random` is not.
 */
function hash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export interface LatLng {
  lat: number
  lng: number
}

/**
 * Nudge a point onto a deterministic spot within `radiusDeg` of it.
 *
 * Uniform over the disc rather than over (angle, radius) — the `sqrt` is what
 * stops repeated offsets piling into the centre, which is the one thing that
 * would defeat the purpose. The longitude divisor converts degrees of latitude
 * into the degrees of longitude that cover the same ground at that latitude, so
 * the disc is a circle in kilometres; floored at 0.2 so an Arctic city cannot
 * divide its way to the far side of the planet.
 */
export function offsetFrom(point: LatLng, seed: string, radiusDeg = COUNTRY_JITTER_DEG): LatLng {
  const h = hash(seed)
  const angle = ((h % 3600) / 3600) * 2 * Math.PI
  const r = radiusDeg * Math.sqrt(((h >>> 12) % 1000) / 1000)
  const latRad = (point.lat * Math.PI) / 180

  const lat = point.lat + r * Math.cos(angle)
  const lng = point.lng + (r * Math.sin(angle)) / Math.max(Math.cos(latRad), 0.2)

  return {
    lat: lat > 89.9 ? 89.9 : lat < -89.9 ? -89.9 : lat,
    lng: ((((lng + 180) % 360) + 360) % 360) - 180,
  }
}

/**
 * The ordered list of points to try for a stake in `iso`, best first.
 *
 * Pure — no network, no clock — so the ordering can be reasoned about and
 * tested without a server. `cities` is the full reference set; it is filtered
 * here rather than by the caller so the population order the endpoint ships in
 * is preserved.
 */
export function candidatePoints(
  iso: string,
  cities: readonly City[],
  seed: string,
  centroid: LatLng | null,
): LatLng[] {
  const code = iso.trim().toUpperCase()
  const local = cities.filter((c) => c.iso === code)
  const out: LatLng[] = []

  if (local.length > 0) {
    // Which of the country's big cities this stake belongs to is itself part of
    // the deterministic spread: two buyers in the same country usually get two
    // different cities, not two dots 5 km apart in the same one.
    const pool = local.slice(0, CITY_POOL)
    const pick = hash(`${code}:${seed}`) % pool.length
    for (let i = 0; i < pool.length; i += 1) {
      const city = pool[(pick + i) % pool.length]
      out.push(offsetFrom(city, `${seed}:${city.id}`))
      // The city itself, un-nudged. If a 5 km offset fell in the sea, the
      // place it was measured from did not.
      out.push({ lat: city.lat, lng: city.lng })
    }
  }

  // Last resort. Honest about being one: for a concave country this is often
  // not inside the country at all, which is exactly why it is last and why
  // every candidate is confirmed before it is used.
  if (centroid) out.push(centroid)

  return out
}

export interface DerivedPoint extends LatLng {
  /** True when `/api/world/where` confirmed this point resolves to `iso`. */
  confirmed: boolean
}

/**
 * Resolve the coordinate a country-level stake will be created at.
 *
 * Walks the candidates, asking the server where each one is, and returns the
 * first that comes back as the country the buyer chose. Bounded at
 * `MAX_PROBES` requests: in practice the first candidate answers, and a
 * country whose four best guesses all miss is a country the buyer should be
 * told about rather than one we should keep probing.
 *
 * Never throws. A network failure, an empty city set and a country with no
 * centroid all end at the same place: `confirmed: false`, which the caller
 * renders as "pick a point yourself" rather than as a charge that might land in
 * the sea.
 */
export async function derivePoint(
  iso: string,
  seed: string,
  centroid: LatLng | null,
): Promise<DerivedPoint | null> {
  const code = iso.trim().toUpperCase()

  let cities: readonly City[] = []
  try {
    cities = await loadCities()
  } catch {
    // The city set is a convenience, not a dependency — fall through to the
    // centroid rather than failing the purchase over a cache miss.
    cities = []
  }

  const candidates = candidatePoints(code, cities, seed, centroid)
  if (candidates.length === 0) return null

  for (const point of candidates.slice(0, MAX_PROBES)) {
    try {
      const { data } = await worldApi.getWhere(point.lat, point.lng)
      if (data.country_iso?.toUpperCase() === code) return { ...point, confirmed: true }
    } catch {
      // 400 'ocean', a 503, a dropped connection — all mean "not this point".
    }
  }

  // Nothing confirmed. Hand back the best guess anyway so the caller can show
  // the buyer what it would have done, flagged as unconfirmed so the caller
  // does NOT quietly charge for it.
  return { ...candidates[0], confirmed: false }
}
