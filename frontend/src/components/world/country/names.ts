/**
 * Every country the globe can draw, as a searchable list — and the one place
 * that turns an ISO code into a name.
 *
 * WHY THIS EXISTS. The World bids on COUNTRIES now, so three separate surfaces
 * need to turn "KE" into "Kenya": the country panel, the stake modal's live
 * readout, and the activity feed. Two of those receive a name from the API and
 * one (the pulse feed) receives only the code, so the lookup has to exist
 * somewhere — and it must never fabricate. `nameFor('ZZ')` is "ZZ", not a
 * guess.
 *
 * The table is `globe/countries.ts`, which is the same one the globe uses to
 * match Natural Earth's numeric ids to alpha-2 codes. It is documented there as
 * import-free precisely so it can be shared like this: pulling it in here costs
 * a 238-row object and drags no three.js behind it.
 *
 * Names are Natural Earth's own short forms ("Dem. Rep. Congo", "Bosnia and
 * Herz."), which is deliberate: they are the names printed ON the map, so a
 * visitor reading a panel sees the label they just clicked.
 */

import { COUNTRY_BY_NUMERIC } from '../globe/countries'

export interface CountryRef {
  /** ISO-3166 alpha-2, upper case. */
  iso: string
  name: string
  /** Folded name + code, precomputed, so a keystroke is a substring test. */
  search: string
}

/**
 * Lower-case and strip diacritics, so "Cote" finds "Côte d'Ivoire" and "Aland"
 * finds "Åland". Same rule (and same combining-marks range) the claim page's
 * city search uses, so the two search boxes behave identically.
 */
export function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

const NAME_BY_ISO = new Map<string, string>()
for (const row of Object.values(COUNTRY_BY_NUMERIC)) {
  NAME_BY_ISO.set(row[0], row[2])
}
// Kosovo carries no ISO numeric id in Natural Earth, but the map draws it and
// the backend's world_countries row exists — so it is selectable here too.
NAME_BY_ISO.set('XK', 'Kosovo')

/** Every country, alphabetical. Built once at module load. */
export const ALL_COUNTRIES: readonly CountryRef[] = [...NAME_BY_ISO.entries()]
  .map(([iso, name]) => ({ iso, name, search: `${fold(name)} ${iso.toLowerCase()}` }))
  .sort((a, b) => a.name.localeCompare(b.name, 'en'))

/**
 * The display name for a code.
 *
 * `fallback` wins when it is present — the API's own `name` for a country is
 * authoritative and this table is only the offline stand-in for the surfaces
 * (the pulse feed) that never receive one. An unknown code prints as itself;
 * there is no branch here that invents a country.
 */
export function nameFor(iso: string | null | undefined, fallback?: string | null): string {
  const code = (iso ?? '').trim().toUpperCase()
  if (fallback) return fallback
  if (code.length !== 2) return code
  return NAME_BY_ISO.get(code) ?? code
}

export interface CountryMatches {
  /** The capped slice actually rendered. */
  shown: CountryRef[]
  /** Everything that matched, so the UI can say what it is not showing. */
  total: number
}

/**
 * Name-or-code match, ranked: countries whose name STARTS with the query come
 * before ones that merely contain it, so "ind" offers India before Finland.
 * An empty query matches nothing — the caller decides what to show instead
 * (in practice, the countries that already have money in them).
 */
export function matchCountries(query: string, limit = 8): CountryMatches {
  const q = fold(query)
  if (q.length === 0) return { shown: [], total: 0 }

  const starts: CountryRef[] = []
  const contains: CountryRef[] = []
  for (const country of ALL_COUNTRIES) {
    const at = country.search.indexOf(q)
    if (at === 0) starts.push(country)
    else if (at > 0) contains.push(country)
  }

  const total = starts.length + contains.length
  const shown: CountryRef[] = []
  for (const band of [starts, contains]) {
    for (const country of band) {
      if (shown.length >= limit) return { shown, total }
      shown.push(country)
    }
  }
  return { shown, total }
}
