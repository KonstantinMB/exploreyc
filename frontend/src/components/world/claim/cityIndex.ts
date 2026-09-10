// The city reference set, and the matching that powers the claim page's city
// search — the keyboard alternative to clicking the globe.
//
// GET /api/world/cities returns every city as a compact tuple
// [id, name, country_iso, lat, lng, population], population-descending, behind
// a one-year immutable cache header. The set never changes at runtime, so it is
// fetched ONCE per page load, folded for search, and kept in a module-level
// cache that every mount shares. Filtering then happens entirely in the client:
// ~7k rows is nothing to scan, and a network round trip per keystroke would
// make the only keyboard path into the flow the slowest one.
//
// No component in here. Keeping the data and the matching separate from the
// combobox means the accent-folding rules can be read (and corrected) without
// wading through ARIA.

import { api } from '../../../lib/api'

export interface City {
  id: number
  name: string
  /** ISO-3166 alpha-2. */
  iso: string
  lat: number
  lng: number
  population: number
  /** Folded city name — lower-cased, diacritics stripped. Precomputed. */
  search: string
  /** Folded country name, so "bulgaria" finds Sofia. Precomputed. */
  searchCountry: string
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

/**
 * Lower-case and strip diacritics, so "Malmo" finds "Malmö", "Dusseldorf"
 * finds "Düsseldorf" and "Sao Paulo" finds "São Paulo". Deliberately uses the
 * combining-marks range rather than \p{Diacritic}: same result, no dependency
 * on the regex unicode-property level the build targets.
 */
export function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

const REGION_NAMES =
  typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null

const countryNameCache = new Map<string, string>()

/**
 * "BG" -> "Bulgaria". Falls back to the code itself when the runtime has no
 * region data — an honest "BG" beats a blank, and never a guessed name.
 */
export function countryName(iso: string): string {
  const code = (iso || '').trim().toUpperCase()
  if (code.length !== 2) return code
  const hit = countryNameCache.get(code)
  if (hit !== undefined) return hit
  let name = code
  try {
    name = REGION_NAMES?.of(code) ?? code
  } catch {
    name = code
  }
  countryNameCache.set(code, name)
  return name
}

/** "Sofia, Bulgaria" — the same shape /api/world/where gives back. */
export function cityLabel(city: City): string {
  return `${city.name}, ${countryName(city.iso)}`
}

/** 1_320_000 -> "1.3M". Population, so compact is honest enough. */
export function formatPopulation(population: number): string {
  if (!Number.isFinite(population) || population <= 0) return ''
  if (population >= 1_000_000) {
    const millions = population / 1_000_000
    return `${millions >= 10 ? Math.round(millions) : millions.toFixed(1)}M`
  }
  if (population >= 1_000) return `${Math.round(population / 1_000)}k`
  return String(Math.round(population))
}

function toCity(row: CityTuple | CityRecord): City {
  const [id, name, iso, lat, lng, population] = Array.isArray(row)
    ? row
    : ([row.id, row.name, row.country_iso, row.lat, row.lng, row.population] as CityTuple)
  return {
    id,
    name,
    iso,
    lat,
    lng,
    population,
    search: fold(name),
    searchCountry: fold(countryName(iso)),
  }
}

let cache: City[] | null = null
let inflight: Promise<City[]> | null = null

/**
 * One fetch per page load, shared by every mount. A failure clears `inflight`
 * so the next mount retries — the search says so out loud rather than
 * pretending there are no cities called "Sofia".
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

export interface CityMatches {
  /** Capped slice actually rendered. */
  shown: City[]
  /** Everything that matched, so the UI can say how many it is not showing. */
  total: number
}

/**
 * Case- and accent-insensitive match, ranked: names that START with the query
 * first, then names that contain it, then cities whose COUNTRY matches (typing
 * "bulgaria" should reach Sofia). Within each band the server's
 * population-descending order is preserved, so the obvious city wins.
 */
export function matchCities(cities: City[], query: string, limit = 20): CityMatches {
  const q = fold(query)
  if (q.length === 0) return { shown: [], total: 0 }

  const starts: City[] = []
  const contains: City[] = []
  const byCountry: City[] = []

  for (const city of cities) {
    const at = city.search.indexOf(q)
    if (at === 0) starts.push(city)
    else if (at > 0) contains.push(city)
    else if (city.searchCountry.startsWith(q)) byCountry.push(city)
  }

  const total = starts.length + contains.length + byCountry.length
  const shown: City[] = []
  for (const band of [starts, contains, byCountry]) {
    for (const city of band) {
      if (shown.length >= limit) return { shown, total }
      shown.push(city)
    }
  }
  return { shown, total }
}
