// Small formatting helpers shared by the World boards / pulse / featured surfaces.

/** ISO-3166 alpha-2 -> regional-indicator flag emoji. Unknown input -> globe. */
export function isoFlag(iso: string): string {
  const code = (iso || '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return '🌐'
  return String.fromCodePoint(
    0x1f1e6 + (code.charCodeAt(0) - 65),
    0x1f1e6 + (code.charCodeAt(1) - 65)
  )
}

/** Compact relative time: "12s", "4m", "2h", "3d". Never guesses beyond days. */
export function timeAgo(at: string, now: number = Date.now()): string {
  const then = new Date(at).getTime()
  if (Number.isNaN(then)) return ''
  const s = Math.max(0, Math.floor((now - then) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

/**
 * Board rows are ~330px wide inside the globe rail, and the name column is what
 * gets squeezed: "United States of America" shipped as "United States o…", the
 * one row on the board a visitor is most likely to be looking for.
 *
 * The names themselves come from `world_countries`, which is already the
 * Natural Earth short set ("Dem. Rep. Congo", not "Democratic Republic of the
 * Congo"), so this is a small correction list rather than a second name table —
 * every entry below is a name that still overflows a row after that. Keyed by
 * ISO because the code is stable and the stored string is not.
 *
 * Nothing here renames a country: each value is the same country's ordinary
 * short form, the one a map or a news bulletin would use.
 */
const SHORT_COUNTRY_NAME: Readonly<Record<string, string>> = {
  US: 'United States',
  AE: 'UAE',
  ST: 'São Tomé & Príncipe',
  TT: 'Trinidad & Tobago',
  BA: 'Bosnia & Herz.',
  AG: 'Antigua & Barb.',
  KN: 'St. Kitts & Nevis',
  VC: 'St. Vin. & Gren.',
  PM: 'St. Pierre & Miquelon',
  WF: 'Wallis & Futuna',
  TC: 'Turks & Caicos',
  HM: 'Heard & McDonald Is.',
  UM: 'U.S. Outlying Is.',
  TF: 'Fr. S. Antarctic',
  IO: 'Br. Indian Ocean',
  GS: 'S. Georgia & Is.',
  CF: 'C. African Rep.',
}

/**
 * The name to print for a country row. Falls back to whatever the API sent, so
 * a country missing from the list above is still named — never blanked.
 */
export function countryDisplayName(iso: string | null | undefined, name: string): string {
  const code = (iso ?? '').trim().toUpperCase()
  return SHORT_COUNTRY_NAME[code] ?? name
}

/** "Mar 2026" style date for pioneer rows. */
export function shortDate(at: string): string {
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
