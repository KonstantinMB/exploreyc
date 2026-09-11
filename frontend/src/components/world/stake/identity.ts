/**
 * The one field the stake modal asks for, and what the API needs it to become.
 *
 * The reference flow collects a single line — a product URL or a social profile
 * — and nothing else. Our checkout endpoint wants two things: a `name` (1–40
 * chars, required) and a `url` (optional, but if present a full `https://` URL
 * or the server answers 400). Both are derived from that one line here, so the
 * modal never has to ask twice:
 *
 *   yourstartup.com      -> name "yourstartup.com"  url "https://yourstartup.com"
 *   https://acme.dev/app -> name "acme.dev"         url "https://acme.dev/app"
 *   x.com/yourhandle     -> name "@yourhandle"      url "https://x.com/yourhandle"
 *   github.com/torvalds  -> name "@torvalds"        url "https://github.com/torvalds"
 *
 * Everything else the plot can carry — a tagline, a founder, a logo — is
 * collected AFTER payment, on the plot's own page. That is the whole point of
 * the change: a form with six fields in front of a $5 purchase is the barrier
 * the owner asked us to remove.
 *
 * The validation here mirrors `validate_link` in backend/world.py. It is not a
 * substitute for it — the server still checks — it exists so a typo costs a
 * sentence rather than a round trip and a 400 on the way to Stripe.
 */

/** Which of the two the buyer is giving us. */
export type StakeKind = 'product' | 'social'

export interface StakeIdentity {
  /** 1–40 chars, exactly what the board row will be labelled with. */
  name: string
  /** Full https:// URL. */
  url: string
}

/** What the server accepts as a name. Mirrors WorldCheckoutRequest.name. */
const MAX_NAME = 40

/**
 * Hosts whose last path segment is a handle rather than a page. Used only to
 * decide how the row is LABELLED — a profile on a host not in this list still
 * works, it is simply named after its host.
 */
const HANDLE_HOSTS = new Set([
  'x.com',
  'twitter.com',
  'instagram.com',
  'github.com',
  'youtube.com',
  'linkedin.com',
  'tiktok.com',
  'threads.net',
  'bsky.app',
  'mastodon.social',
])

/** The placeholder each mode shows. Real examples, not instructions. */
export const PLACEHOLDER: Record<StakeKind, string> = {
  product: 'yourstartup.com',
  social: 'x.com/yourhandle',
}

/** The label on each half of the toggle. */
export const KIND_LABEL: Record<StakeKind, string> = {
  product: 'Product URL',
  social: 'Social profile',
}

/**
 * Parse the single line into `{ name, url }`, or explain what is missing.
 *
 * Errors are written as an EXAMPLE rather than as a rule — "Looks like
 * yourstartup.com" beats "must be a valid hostname", and it is the same
 * teach-by-example instruction the empty states follow.
 */
export function parseIdentity(
  kind: StakeKind,
  raw: string,
): { ok: true; value: StakeIdentity } | { ok: false; error: string } {
  const trimmed = raw.trim()
  if (trimmed === '') {
    return {
      ok: false,
      error:
        kind === 'product'
          ? 'Add your product link — something like yourstartup.com.'
          : 'Add your profile link — something like x.com/yourhandle.',
    }
  }

  // A bare "@handle" has no platform in it, so there is no URL to build and
  // nothing honest to link the plot to. Say which shape works.
  if (/^@/.test(trimmed)) {
    return {
      ok: false,
      error: 'Paste the whole profile link, like x.com/yourhandle — the @ alone has no site behind it.',
    }
  }

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  let parsed: URL
  try {
    parsed = new URL(withScheme)
  } catch {
    return { ok: false, error: `That is not a link. Try ${PLACEHOLDER[kind]}.` }
  }

  // http:// typed by hand is upgraded rather than rejected: the server's rule
  // is https-only and the buyer meant the same site either way.
  parsed.protocol = 'https:'

  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase()
  // A hostname with no dot is a typo ("localhost", "yourstartup"), not a site.
  if (!host.includes('.') || host.endsWith('.')) {
    return { ok: false, error: `That is not a link. Try ${PLACEHOLDER[kind]}.` }
  }

  const segments = parsed.pathname.split('/').filter(Boolean)

  if (kind === 'social') {
    if (segments.length === 0) {
      return {
        ok: false,
        error: `That is the site, not a profile. Try ${PLACEHOLDER.social}.`,
      }
    }
    // "@torvalds" reads as a person on a board of company domains, which is
    // exactly how the reference labels its social rows.
    const handle = segments[segments.length - 1].replace(/^@/, '')
    const name = HANDLE_HOSTS.has(host) ? `@${handle}` : `${host}/${handle}`
    return { ok: true, value: { name: name.slice(0, MAX_NAME), url: parsed.toString() } }
  }

  return { ok: true, value: { name: host.slice(0, MAX_NAME), url: parsed.toString() } }
}
