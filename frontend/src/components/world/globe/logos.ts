import type { GlobePin } from '../../../lib/worldApi'

/**
 * Company imagery on the globe: what may be loaded, how big it is drawn, and
 * which company gets a slot when there are more of them than slots.
 *
 * Pure and dependency-free so the two places that draw a logo — the marker
 * overlay and the hover tooltip — cannot drift apart on any of the three
 * questions, and so neither has to pull three.js in to ask.
 */

/**
 * A logo URL the page is willing to put in an `<img src>`, or null.
 *
 * The values come from our own feed, which is exactly the reasoning that makes
 * an allowlist cheap insurance rather than paranoia: `logo_url` is a scraped
 * third-party string that has travelled through a scraper, a database and a
 * JSON encoder, and `src` is one of the attributes a `javascript:` or `data:`
 * payload is worth trying. Absolute http(s) and root-relative paths are what the
 * bookface CDN and our own static host actually produce; everything else is a
 * company that renders as a letter, which is a fallback the design already has.
 */
export function safeImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  const url = raw.trim()
  if (url.length === 0) return null
  if (url.startsWith('/') && !url.startsWith('//')) return url
  const lower = url.toLowerCase()
  if (lower.startsWith('https://') || lower.startsWith('http://')) return url
  return null
}

/** The letter that occupies the same box when there is no usable image. */
export function logoLetter(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : '?'
}

/**
 * Marker box size in CSS pixels.
 *
 * The ladder is the bead ladder said again in a second channel: a $1,000 stake
 * is a 42px tile and an unclaimed import is a 22px one, so the size difference
 * survives even where colour cannot (greyscale, forced colours, a logo that is
 * itself orange). Paid starts at 30px — past the 24px at which a target stops
 * being a game of skill on a trackpad — and seeds stay under it deliberately.
 */
export function logoSizeFor(pin: GlobePin): number {
  if (pin.kind === 'seed') return 22
  const tier = Math.min(Math.max(pin.tier, 0), 4)
  return 26 + tier * 4
}

/**
 * Who gets a logo slot, in one number.
 *
 * Two rules, and the first one is the product: **every paid plot outranks every
 * imported company**, by a margin no seed can close. A seed with 10,000
 * employees does not get to push a $5 plot off the map, because the $5 plot is
 * the thing this globe sells and the seed is inventory we imported.
 *
 * Within paid, stake decides, then promotion. Within seeds, the signals the
 * feed actually carries: a YC top company, then hiring, then team size. The
 * comparison is by value only — the STABLE part is the id tiebreak at the call
 * site, and that is what stops the field reshuffling every time the globe turns.
 */
export function logoPriority(pin: GlobePin): number {
  if (pin.kind === 'plot') {
    // Tier first (the bucket every payload has had), then promotion, then the
    // exact stake as a tiebreak inside a bucket — two tier-4 plots in the same
    // city are not equally important, and the one that paid more should be the
    // one that keeps its slot. Capped so the term stays an order of magnitude
    // under the promotion step and can never reorder tiers.
    return (
      1e10 +
      Math.min(Math.max(pin.tier, 0), 6) * 1e6 +
      (pin.promoted ? 4e5 : 0) +
      Math.min((pin.total_cents ?? 0) / 1e4, 3e4)
    )
  }
  return (
    1e5 +
    (pin.top_company ? 4e4 : 0) +
    (pin.is_hiring ? 2e4 : 0) +
    Math.min(Math.max(pin.team_size ?? 0, 0), 9999)
  )
}
