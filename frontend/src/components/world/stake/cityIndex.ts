// The city reference set the derived stake point is built from.
//
// GET /api/world/cities returns every city as a compact tuple
// [id, name, country_iso, lat, lng, population], population-descending, behind
// a one-year immutable cache header. The set never changes at runtime, so it is
// fetched ONCE per page load and kept in a module-level cache every caller
// shares.
//
// WHAT THIS FILE USED TO BE. It lived in `claim/cityIndex.ts` and carried the
// accent-folding matcher behind the claim wizard's city-search combobox. The
// wizard and its combobox are deleted — nobody is asked for a coordinate any
// more — and the matcher went with them. What remains is what `derivePoint.ts`
// genuinely needs: the rows, and one shared fetch of them. A country-level
// stake still has to land on a real place, and a real place is a city.

import { api } from '../../../lib/api'

export interface City {
  id: number
  name: string
  /** ISO-3166 alpha-2. */
  iso: string
  lat: number
  lng: number
  population: number
}

/** Tuple row exactly as the endpoint ships it. */
type CityTuple = [number, string, string, number, number, number]

/** Object row, in case the backend ever serialises cities as records. */
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

function toCity(row: CityTuple | CityRecord): City {
  const [id, name, iso, lat, lng, population] = Array.isArray(row)
    ? row
    : ([row.id, row.name, row.country_iso, row.lat, row.lng, row.population] as CityTuple)
  return { id, name, iso, lat, lng, population }
}

let cache: City[] | null = null
let inflight: Promise<City[]> | null = null

/**
 * One fetch per page load, shared by every caller. A failure clears `inflight`
 * so the next call retries; `derivePoint` treats a failure as "no cities" and
 * falls through to the country centroid rather than blocking a purchase.
 */
export function loadCities(): Promise<City[]> {
  if (cache) return Promise.resolve(cache)
  if (inflight) return inflight

  inflight = api
    .get<CitiesPayload>('/api/world/cities')
    .then((response) => {
      const rows = response.data?.cities ?? []
      cache = rows.map(toCity)
      return cache
    })
    .catch((error: unknown) => {
      inflight = null
      throw error
    })

  return inflight
}
