/**
 * OG share card for ExploreYC World — Vercel Edge function.
 *
 *   /api/og/world?plot=<id>     — plot card (what a founder posts after planting)
 *   /api/og/world?country=<iso> — country standing card
 *   anything else / any failure — generic World card (never a broken image)
 *
 * Data comes from the public backend endpoints on api.exploreyc.com; a fetch
 * failure degrades to the generic card rather than a 500, because a missing
 * share image costs more than a plain one.
 *
 * Composition ported from startupworld's two opengraph-image.tsx files
 * (masthead + terminal command line, `>` headline, rank at the opposite
 * corner, one rule-separated figures row, full-bleed orange edge) but drawn
 * on ExploreYC's near-black ground instead of paper. On #0A0A0A the brand
 * orange #FB651E measures ~6.5:1, so unlike on white it can carry glyphs
 * directly — no split brand-ink needed here.
 *
 * Satori constraints shape the markup: flexbox only, explicit `display` on
 * every element. Elements are built with a tiny h() helper (satori accepts
 * plain {type, props} trees) so this file stays dependency-light plain JS,
 * matching the repo's api/cron/*.js conventions.
 *
 * This file must never answer 502/504 semantics — it always returns a card.
 */
import { ImageResponse } from '@vercel/og'

export const config = { runtime: 'edge' }

const API_BASE = 'https://api.exploreyc.com'
const WIDTH = 1200
const HEIGHT = 630

/* ExploreYC dark palette — mirrored from frontend/src/index.css tokens.
   Duplicated rather than imported: this renders outside the browser. */
const BG = '#0A0A0A' // near-black ground
const INK = '#F5F5F5' // primary glyphs, ~18:1 on BG
const MUTED = '#8F8F8F' // labels/eyebrows, ~5.4:1 on BG (AA)
const LINE = '#2A2A2A' // hairlines — structure, not content
const BRAND = '#FB651E' // YC orange, signal only: rank, cursor, edge, $

const MIN_STAKE_CENTS = 500 // mirrors backend/world_constants.py
const WORDMARK = 'EXPLOREYC'
const SITE_LINE = 'EXPLOREYC.COM'
const FOOTNOTE = `A PLOT FROM ${formatMoney(MIN_STAKE_CENTS)}`

/** Minimal element factory — satori consumes plain {type, props} trees. */
function h(type, props, ...children) {
  const kids = children
    .flat(Infinity)
    .filter((c) => c !== null && c !== undefined && c !== false && c !== '')
  return {
    type,
    key: null,
    props: {
      ...props,
      children:
        kids.length === 0 ? undefined : kids.length === 1 ? kids[0] : kids,
    },
  }
}

function formatMoney(cents) {
  const n = Math.max(0, Math.round(Number(cents) || 0))
  const dollars = Math.floor(n / 100)
  const rem = n % 100
  const base = `$${dollars.toLocaleString('en-US')}`
  return rem ? `${base}.${String(rem).padStart(2, '0')}` : base
}

/** Country flag emoji from an ISO-3166 alpha-2 code. Pure arithmetic. */
function flagEmoji(iso) {
  if (!/^[A-Za-z]{2}$/.test(iso || '')) return null
  return String.fromCodePoint(
    ...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  )
}

/** One line — stop before it wraps into the layout below it. */
function clamp(text, max) {
  const s = String(text)
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`
}

/**
 * Display-size tiers for the headline. Monospace makes this arithmetic:
 * IBM Plex Mono advances 0.6em/char, the name column is ~700px, and the
 * `> ` prefix costs two characters. Past the last tier the name wraps.
 */
function nameSize(name) {
  const len = name.length
  if (len <= 10) return 92
  if (len <= 14) return 74
  if (len <= 19) return 56
  if (len <= 26) return 44
  if (len <= 34) return 36
  return 30
}

/** `#1` and `#4207` cannot share a size in a fixed column. */
function rankSize(text) {
  if (text.length <= 3) return 156
  if (text.length === 4) return 130
  return 108
}

/**
 * Google Fonts subset loader, ported from the donor cards. Returns null
 * rather than throwing — the caller drops the face and satori falls back to
 * the bundled default, which is a lesser card but still a card.
 */
async function loadFont(family, weight, text) {
  try {
    const query = `family=${family.replace(/ /g, '+')}:wght@${weight}&text=${encodeURIComponent(text)}`
    const cssResponse = await fetch(
      `https://fonts.googleapis.com/css2?${query}`,
      // No browser UA, so Google serves TTF — the format satori wants.
      { headers: { 'User-Agent': 'exploreyc-og' }, cache: 'force-cache' },
    )
    if (!cssResponse.ok) return null

    const css = await cssResponse.text()
    const match = css.match(
      /src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/,
    )
    if (!match) return null

    const fontResponse = await fetch(match[1], { cache: 'force-cache' })
    if (!fontResponse.ok) return null

    const buffer = await fontResponse.arrayBuffer()
    // A CDN error page served with a 200 is a real failure mode: every
    // TrueType/OpenType file starts with one of three known tags.
    if (buffer.byteLength < 1024) return null
    const tag = new DataView(buffer).getUint32(0)
    return [0x00010000, 0x4f54544f, 0x74727565].includes(tag) ? buffer : null
  } catch {
    return null
  }
}

async function fetchJson(path) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { accept: 'application/json' },
      signal:
        typeof AbortSignal !== 'undefined' && AbortSignal.timeout
          ? AbortSignal.timeout(4500)
          : undefined,
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Card data — one shape, three sources                                */
/* ------------------------------------------------------------------ */

function fallbackCard() {
  return {
    command: 'world --map',
    flag: null,
    eyebrow: 'THE STARTUP WORLD MAP',
    name: 'EXPLOREYC WORLD',
    tagline: null,
    rankText: null,
    rankLabel: null,
    figures: [],
    invitation: 'PLANT YOUR STARTUP ON THE MAP.',
    invitationSub: 'EVERY DOLLAR SCORES FOR YOUR COUNTRY.',
  }
}

/**
 * The plot detail contract only guarantees the globe fields, so ranks are
 * read defensively across plausible key names. Unknown is rendered as an
 * em dash — the honesty rule: never print a number that isn't known.
 */
function plotCard(plot, id) {
  const countryIso = plot.country_iso ?? plot.iso ?? null
  const countryName = plot.country_name ?? countryIso ?? null
  const cityName = plot.city_name ?? null
  const countryRank = plot.rank_country ?? plot.country_rank ?? null
  const worldRank = plot.rank_world ?? plot.world_rank ?? plot.rank ?? null

  const primary = countryRank ?? worldRank
  const rankText = primary != null ? `#${primary}` : '—'
  const rankScope = countryRank != null ? countryName : 'THE WORLD'
  const place =
    [cityName, countryName].filter(Boolean).join(', ') || 'THE WORLD'

  return {
    command: `world --plot ${clamp(String(plot.id ?? id), 22)}`,
    flag: flagEmoji(countryIso),
    eyebrow: clamp(place.toUpperCase(), 34),
    name: clamp(String(plot.name ?? 'UNCLAIMED'), 40).toUpperCase(),
    tagline: plot.tagline ? clamp(plot.tagline, 76) : null,
    rankText,
    rankLabel:
      primary != null
        ? `IN ${clamp(String(rankScope ?? 'THE WORLD').toUpperCase(), 22)}`
        : 'RANK UNKNOWN',
    figures: [
      {
        label: 'STAKED',
        value: plot.total_cents != null ? formatMoney(plot.total_cents) : '—',
      },
      {
        label: `IN ${clamp(String(countryName ?? 'COUNTRY').toUpperCase(), 18)}`,
        value: countryRank != null ? `#${countryRank}` : '—',
      },
      {
        label: 'IN THE WORLD',
        value: worldRank != null ? `#${worldRank}` : '—',
      },
    ],
    invitation: null,
    invitationSub: null,
  }
}

/**
 * Country card. An unclaimed country is framed as the invitation it is —
 * "#56 · $0 · 0 PLOTS" is a true statement and a terrible share.
 */
function countryCard(country, iso) {
  const plots = Array.isArray(country.plots) ? country.plots.length : 0
  const richest = country.rank_richest ?? null
  const planted = country.rank_planted ?? null
  const claimed = plots > 0 && richest != null

  return {
    command: `world --country ${iso.toLowerCase()}`,
    flag: flagEmoji(iso),
    eyebrow: 'ON THE WORLD MAP',
    name: clamp(String(country.name ?? iso), 40).toUpperCase(),
    tagline: null,
    rankText: claimed ? `#${richest}` : 'UNCLAIMED',
    rankLabel: claimed ? 'RICHEST' : 'BE FIRST',
    figures: claimed
      ? [
          {
            label: 'TOTAL STAKED',
            value:
              country.total_cents != null
                ? formatMoney(country.total_cents)
                : '—',
          },
          { label: 'PLOTS', value: plots.toLocaleString('en-US') },
          {
            label: 'MOST PLANTED',
            value: planted != null ? `#${planted}` : '—',
          },
        ]
      : [],
    invitation: claimed ? null : 'NOBODY HAS PLANTED HERE.',
    invitationSub: claimed ? null : 'THE FIRST PLOT TAKES #1.',
  }
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function render(card, face) {
  const size = nameSize(card.name)
  const unclaimed = card.rankText === 'UNCLAIMED'

  return h(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: BG,
        color: INK,
        fontFamily: face,
        fontWeight: 400,
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          padding: '52px 72px 40px',
        },
      },
      // Masthead: brand square + wordmark left, terminal command right.
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 26,
          },
        },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center' } },
          h('div', {
            style: {
              display: 'flex',
              width: 24,
              height: 24,
              backgroundColor: BRAND,
            },
          }),
          h(
            'div',
            {
              style: {
                display: 'flex',
                marginLeft: 14,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 5,
                color: INK,
              },
            },
            WORDMARK,
          ),
        ),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center' } },
          h(
            'div',
            {
              style: {
                display: 'flex',
                marginRight: 10,
                fontSize: 17,
                fontWeight: 700,
                color: BRAND,
              },
            },
            '$',
          ),
          h(
            'div',
            { style: { display: 'flex', fontSize: 17, color: MUTED } },
            card.command,
          ),
          // The block cursor — a fill, never a glyph.
          h('div', {
            style: {
              display: 'flex',
              width: 9,
              height: 19,
              marginLeft: 9,
              backgroundColor: BRAND,
            },
          }),
        ),
      ),
      h('div', {
        style: {
          display: 'flex',
          height: 1,
          marginTop: 22,
          backgroundColor: LINE,
        },
      }),
      // The statement: place/name/tagline left, rank at the opposite corner
      // so both survive a 400px thumbnail.
      h(
        'div',
        {
          style: {
            display: 'flex',
            flex: 1,
            alignItems: 'center',
            justifyContent: 'space-between',
          },
        },
        h(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              paddingRight: 40,
            },
          },
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center' } },
            card.flag &&
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    marginRight: 12,
                    fontSize: 26,
                    lineHeight: 1,
                  },
                },
                card.flag,
              ),
            h(
              'div',
              {
                style: {
                  display: 'flex',
                  fontSize: 16,
                  letterSpacing: 2.6,
                  color: MUTED,
                },
              },
              card.eyebrow,
            ),
          ),
          // `> NAME` — the orange chevron is how ExploreYC prefixes its own h1.
          h(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'flex-start',
                marginTop: 22,
              },
            },
            h(
              'div',
              {
                style: {
                  display: 'flex',
                  fontSize: size,
                  fontWeight: 700,
                  lineHeight: 1,
                  color: BRAND,
                },
              },
              '>',
            ),
            h(
              'div',
              {
                style: {
                  display: 'flex',
                  flex: 1,
                  marginLeft: size * 0.3,
                  fontSize: size,
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: -1,
                  color: INK,
                },
              },
              card.name,
            ),
          ),
          card.tagline &&
            h(
              'div',
              {
                style: {
                  display: 'flex',
                  marginTop: 22,
                  fontSize: 22,
                  lineHeight: 1.35,
                  color: MUTED,
                },
              },
              card.tagline,
            ),
        ),
        card.rankText &&
          h(
            'div',
            {
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
              },
            },
            h(
              'div',
              {
                style: {
                  display: 'flex',
                  fontSize: unclaimed ? 52 : rankSize(card.rankText),
                  fontWeight: 700,
                  lineHeight: 0.9,
                  // Positive tracking at display size: a mono face wants air
                  // between `#` and the digit, not tightening.
                  letterSpacing: unclaimed ? 1 : 4,
                  color: BRAND,
                },
              },
              card.rankText,
            ),
            card.rankLabel &&
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    marginTop: 18,
                    fontSize: 16,
                    letterSpacing: 2.6,
                    color: MUTED,
                  },
                },
                card.rankLabel,
              ),
          ),
      ),
      h('div', { style: { display: 'flex', height: 1, backgroundColor: LINE } }),
      // Figures as one rule-separated row — a readout, no tiles or boxes.
      card.figures.length > 0
        ? h(
            'div',
            { style: { display: 'flex', alignItems: 'center', height: 88 } },
            card.figures.map((figure, i) =>
              h(
                'div',
                {
                  key: figure.label,
                  style: { display: 'flex', alignItems: 'center' },
                },
                i > 0 &&
                  h('div', {
                    style: {
                      display: 'flex',
                      width: 1,
                      height: 48,
                      marginLeft: 36,
                      marginRight: 36,
                      backgroundColor: LINE,
                    },
                  }),
                h(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column' } },
                  h(
                    'div',
                    {
                      style: {
                        display: 'flex',
                        fontSize: 14,
                        letterSpacing: 2.2,
                        color: MUTED,
                      },
                    },
                    figure.label,
                  ),
                  h(
                    'div',
                    {
                      style: {
                        display: 'flex',
                        marginTop: 12,
                        fontSize: 38,
                        fontWeight: 700,
                        lineHeight: 1,
                        color: INK,
                      },
                    },
                    figure.value,
                  ),
                ),
              ),
            ),
          )
        : h(
            'div',
            {
              style: {
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                height: 88,
              },
            },
            card.invitation &&
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    fontSize: 26,
                    fontWeight: 700,
                    color: INK,
                  },
                },
                card.invitation,
              ),
            card.invitationSub &&
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    marginTop: 10,
                    fontSize: 26,
                    fontWeight: 700,
                    color: BRAND,
                  },
                },
                card.invitationSub,
              ),
          ),
      // Footer: the wordmark URL left, the price right — a stranger who only
      // reads two things reads these.
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 20,
          },
        },
        h(
          'div',
          {
            style: {
              display: 'flex',
              fontSize: 15,
              letterSpacing: 2.4,
              color: MUTED,
            },
          },
          SITE_LINE,
        ),
        h(
          'div',
          {
            style: {
              display: 'flex',
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: 2.4,
              color: BRAND,
            },
          },
          FOOTNOTE,
        ),
      ),
    ),
    // Full-bleed orange edge — the one saturated fill, so the card doesn't
    // dissolve into a dark timeline.
    h('div', { style: { display: 'flex', height: 10, backgroundColor: BRAND } }),
  )
}

/* ------------------------------------------------------------------ */
/* Handler                                                             */
/* ------------------------------------------------------------------ */

export default async function handler(request) {
  let card = fallbackCard()

  try {
    const params = new URL(request.url).searchParams
    const plotId = (params.get('plot') || '').trim()
    const countryIso = (params.get('country') || '').trim()

    if (plotId && /^[\w-]{1,64}$/.test(plotId)) {
      const plot = await fetchJson(
        `/api/world/plots/${encodeURIComponent(plotId)}`,
      )
      if (plot && typeof plot === 'object') card = plotCard(plot, plotId)
    } else if (/^[A-Za-z]{2}$/.test(countryIso)) {
      const country = await fetchJson(
        `/api/world/country/${countryIso.toUpperCase()}`,
      )
      if (country && typeof country === 'object') {
        card = countryCard(country, countryIso.toUpperCase())
      } else {
        // The backend couldn't resolve it, but the ISO itself still makes a
        // truthful invitation card — flag, name unknown, "BE FIRST".
        card = countryCard({ name: countryIso.toUpperCase(), plots: [] },
          countryIso.toUpperCase())
      }
    }
  } catch {
    card = fallbackCard()
  }

  // Exact glyph subsets per face keep both downloads inside @vercel/og's
  // font budget. User text (names, taglines) drives the subset itself so an
  // accent never renders as tofu.
  const figureText = card.figures
    .map((f) => `${f.label}${f.value}`)
    .join('')
  const boldGlyphs =
    `${WORDMARK}${card.name}${card.rankText ?? ''}${figureText}` +
    `${card.invitation ?? ''}${card.invitationSub ?? ''}${FOOTNOTE}` +
    '0123456789#$+,.—>'
  const bodyGlyphs =
    `${card.eyebrow}${card.tagline ?? ''}${card.command}` +
    `${card.rankLabel ?? ''}${figureText}${SITE_LINE}` +
    '0123456789 ·,.…—$'

  const [bold, body] = await Promise.all([
    loadFont('IBM Plex Mono', 700, boldGlyphs),
    loadFont('IBM Plex Mono', 400, bodyGlyphs),
  ])

  const fonts = []
  if (bold) {
    fonts.push({ name: 'IBM Plex Mono', data: bold, style: 'normal', weight: 700 })
  }
  if (body) {
    fonts.push({ name: 'IBM Plex Mono', data: body, style: 'normal', weight: 400 })
  }

  // When both fetches fail, `fontFamily: undefined` falls through to the
  // bundled default face, and `fonts` is OMITTED rather than passed empty —
  // `@vercel/og` resolves `options.fonts || defaultFonts` and `[]` is truthy,
  // which would hand satori zero fonts and produce a zero-byte 200.
  const face = fonts.length > 0 ? 'IBM Plex Mono' : undefined

  const options = {
    width: WIDTH,
    height: HEIGHT,
    headers: {
      'cache-control':
        'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400',
    },
  }
  if (fonts.length > 0) options.fonts = fonts

  try {
    return new ImageResponse(render(card, face), options)
  } catch {
    // Absolute floor: satori choked on something in the data (an exotic
    // glyph, a malformed field). Serve the generic card — never a 5xx.
    return new ImageResponse(render(fallbackCard(), face), options)
  }
}
