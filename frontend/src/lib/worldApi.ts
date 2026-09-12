// ExploreYC World — typed API client for the /api/world/* endpoint family.
//
// Public reads go through the shared `api` axios instance; authed calls go
// through a bearer-injecting instance that mirrors the DevAuth pattern in
// api.ts (localStorage `dev_token` -> `Authorization: Bearer <token>`).

import axios from 'axios'
import { api, DEV_TOKEN_KEY } from './api'

// Authed instance: same base URL as the shared client, with the developer
// session token attached (identical to the `devApi` interceptor in api.ts).
const worldDevApi = axios.create({
  baseURL: api.defaults.baseURL,
  headers: { 'Content-Type': 'application/json' },
})
worldDevApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(DEV_TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ============================================================================
// Types — exact mirror of the /api/world contract
// ============================================================================

/** Stake-size bucket used to scale pins on the globe. */
export type PlotTier = number

/** 'plot' = paid claimed plot; 'seed' = virtual pin derived from the companies table. */
export type GlobePinKind = 'plot' | 'seed'

export interface GlobePin {
  id: string
  lat: number
  lng: number
  name: string
  tier: PlotTier
  promoted: boolean
  kind: GlobePinKind
  company_slug: string | null

  // ---- paid layer only (kind === 'plot') ------------------------------------

  /**
   * Exact stake in cents. Paid plots only — a seed has never been bought, and
   * `tier` is the only size signal it has.
   */
  total_cents?: number

  // ---- imported layer only (kind === 'seed') --------------------------------
  // Present on seeds, absent on paid plots. These exist so the globe can filter
  // and render the imported layer with no second request; a fact the scrape
  // never captured is null, never '' and never a placeholder.

  /** companies.id. Seeds only — the pin's own `id` is `seed-${company_id}`. */
  company_id?: number
  /** YC batch as written, e.g. 'Winter 2025' or 'IK12'. Sort with batchSortKey. */
  batch?: string | null
  industry?: string | null
  /**
   * First ';'-separated segment of companies.all_locations, verbatim — in YC's
   * data a whole place string ('San Francisco, CA, USA'), not a bare city. It
   * is what computeHubs() groups and names hubs by.
   */
  location?: string | null
  /**
   * BOTH LAYERS. On a paid plot it is the plot's own mark falling back to the
   * linked company's thumbnail — the marker the buyer paid to put on the globe.
   * On a seed it is the imported company's thumbnail. Null means no logo,
   * never '' and never a placeholder.
   */
  logo_url?: string | null
  team_size?: number | null
  is_hiring?: boolean
  top_company?: boolean
}

/** The decoded globe: one flat pin list, paid plots first. */
export interface GlobeResponse {
  plots: GlobePin[]
}

// ---------------------------------------------------------------------------
// Seed layer wire format (see backend/world.py, SEED_COLUMNS)
// ---------------------------------------------------------------------------
//
// The imported layer arrives columnar, not as objects, because there are 5,579
// of it and this query refetches every 60 seconds. Tuples instead of repeated
// key names, integer indices instead of repeated batch/industry/location
// strings, and one shared logo directory instead of 5,579 copies of it, take
// the widened payload to ~563 KiB — below the 759 KiB the *narrow* object form
// cost before these fields existed. `decodeGlobe` is the only place that knows
// any of this: everything downstream sees plain GlobePins.

/** [id, lat, lng, name, slug, batch, industry, location, logo, team_size, flags] */
export type SeedRow = [
  number, number, number, string, string,
  number, number, number, string, number, number,
]

export interface SeedLayerWire {
  /** Format version. Bumped when the tuple order changes. */
  v: number
  /** Column names, in tuple order — self-describing, for humans and for debugging. */
  cols: string[]
  batches: string[]
  industries: string[]
  locations: string[]
  /** Shared logo directory, folded out of the rows. '' when there is none. */
  logo_prefix: string
  rows: SeedRow[]
}

/** Raw GET /api/world/globe. Only decodeGlobe should read this shape. */
export interface GlobeWire {
  plots: GlobePin[]
  /** Absent only if the page outlives a backend that predates this format. */
  seeds?: SeedLayerWire | null
}

const SEED_FLAG_HIRING = 1
const SEED_FLAG_TOP_COMPANY = 2
/** Marks a logo value as relative to `logo_prefix` (backend: SEED_LOGO_FOLD). */
const SEED_LOGO_FOLD = '*'

/** Dictionary lookup where -1 (and any out-of-range index) means "no value". */
function at(dict: string[], index: number): string | null {
  return index >= 0 && index < dict.length ? dict[index] : null
}

/**
 * Rebuild the flat pin list the globe renders.
 *
 * Total: every wire row becomes exactly one pin. If `seeds` is missing — an old
 * backend behind a new bundle — the paid layer still renders rather than the
 * page failing, which is the layer that matters most anyway.
 */
export function decodeGlobe(wire: GlobeWire): GlobeResponse {
  const pins: GlobePin[] = [...(wire.plots ?? [])]
  const seeds = wire.seeds
  if (!seeds?.rows?.length) return { plots: pins }

  const { batches, industries, locations, logo_prefix: prefix } = seeds
  for (const r of seeds.rows) {
    const [id, lat, lng, name, slug, bi, ii, li, logo, teamSize, flags] = r
    pins.push({
      id: `seed-${id}`,
      lat,
      lng,
      name,
      tier: 0,
      promoted: false,
      kind: 'seed',
      company_slug: slug || null,
      company_id: id,
      batch: at(batches, bi),
      industry: at(industries, ii),
      location: at(locations, li),
      // Marked values are relative to the folded directory; everything else
      // travels whole. Absent stays absent — never a placeholder image.
      logo_url: logo
        ? logo.startsWith(SEED_LOGO_FOLD)
          ? prefix + logo.slice(1)
          : logo
        : null,
      team_size: teamSize >= 0 ? teamSize : null,
      is_hiring: (flags & SEED_FLAG_HIRING) !== 0,
      top_company: (flags & SEED_FLAG_TOP_COMPANY) !== 0,
    })
  }
  return { plots: pins }
}

export type BoardKind = 'richest' | 'planted' | 'rising'
/** 'world' | 'country:XX' (iso2) | 'city:ID' */
export type BoardScope = string

export interface BoardRow {
  rank: number
  iso: string
  name: string
  total_cents: number
  plot_id: string | null
  delta_cents: number | null
  /**
   * Plot rows: the plot's own logo, else the linked company's thumbnail.
   * Country rows (scope=world): always null — render the flag emoji instead.
   * null means "no logo", never a placeholder.
   */
  logo_url?: string | null
  /**
   * The plot's own one-liner, else the linked company's. Country rows always
   * null. null means the owner never wrote one — render no second line rather
   * than filling the gap with something they did not say.
   */
  tagline?: string | null
}

export interface BoardResponse {
  rows: BoardRow[]
  /** null = unknown — UI must say "unknown", never guess a number. */
  cents_to_beat: number | null
}

export type FoundersBoardKind = 'staked' | 'pioneers'

export interface FounderRow {
  rank: number
  founder_name: string
  plot_id: string
  name: string
  total_cents: number
  created_at: string
  /** Plot logo, else the linked company's thumbnail, else null. */
  logo_url?: string | null
}

export interface FoundersResponse {
  rows: FounderRow[]
}

/**
 * Public facts about the YC company a plot is linked to, copied straight from
 * the companies row. Any field the scrape never captured stays null.
 */
export interface WorldCompanyBrief {
  slug: string
  name: string
  logo_url: string | null
  batch: string | null
  one_liner: string | null
  industry: string | null
  team_size: number | null
  is_hiring: boolean
}

export interface WorldPlot {
  id: string
  name: string
  url: string | null
  tagline: string | null
  founder_name: string | null
  founder_title: string | null
  founder_link: string | null
  logo_url: string | null
  lat: number
  lng: number
  country_iso: string
  country_name: string
  city_id: number | null
  city_name: string | null
  total_cents: number
  status: 'active' | 'pending'
  promoted: boolean
  company_id: number | null
  company_slug: string | null
  created_at: string
  updated_at: string
  /** Present only when the request carried an Authorization header. */
  is_mine?: boolean
  /** Richest-board ranks; present on GET /api/world/plots/{id} only (null while pending). */
  rank_world?: number | null
  rank_country?: number | null
  /**
   * The linked company; present on GET /api/world/plots/{id} only.
   * null when company_id is null, or the company row no longer exists.
   */
  company?: WorldCompanyBrief | null
}

/** Row in a country page's plot list — board row shape plus id + promoted. */
export interface CountryPlotRow {
  rank: number
  /** Same value as plot_id, provided under both names. */
  id: number
  plot_id: number
  iso: string
  name: string
  total_cents: number
  delta_cents: number | null
  promoted: boolean
  /**
   * Plot logo, else the linked company's thumbnail, else null. These rows go
   * through the same `_board_row` serializer as /api/world/board, so they get
   * the field for free.
   */
  logo_url?: string | null
  /** Same serializer, same rule: the plot's one-liner, else the company's, else null. */
  tagline?: string | null
}

export interface CountryCity {
  id: number
  name: string
  total_cents: number
  plots_count: number | null
  top_plot: { id: number; name: string; total_cents: number } | null
}

export interface CountryResponse {
  iso: string
  name: string
  flag_emoji?: string | null
  centroid_lat?: number | null
  centroid_lng?: number | null
  rank_richest: number | null
  rank_planted: number | null
  total_cents: number
  plots_count: number
  plots: CountryPlotRow[]
  cities: CountryCity[]
}

export interface WhereResponse {
  country_iso: string
  country_name: string
  city_id: number | null
  city_name: string | null
}

export type PulseEventType = 'plant' | 'topup' | 'promotion'

export interface PulseEvent {
  type: PulseEventType
  name: string
  /**
   * NULLABLE, and not rarely: a global `featured` promotion carries no country
   * (world.py COALESCEs the promotion's iso with the plot's, and a sponsor slot
   * has neither). Typed `string` until now, which is why the feed rendered the
   * fallback globe glyph and an empty country name for those rows.
   */
  country_iso: string | null
  amount_cents: number
  at: string
}

export interface PulseResponse {
  events: PulseEvent[]
}

export interface FeaturedPromotion {
  plot_id: string
  name: string
  logo_url: string | null
  ends_at: string
}

export interface SponsorSlot {
  label: string
  url: string
  logo_url: string | null
  ends_at: string
}

export interface PromotionsResponse {
  featured: FeaturedPromotion[]
  sponsors: SponsorSlot[]
}

export interface ClaimedResponse {
  status: 'pending' | 'done'
  plot_id: string | null
}

export interface WorldCheckoutRequest {
  lat: number
  lng: number
  name: string
  url: string
  tagline: string
  founder_name?: string
  founder_title?: string
  founder_link?: string
  /** Set when claiming a seed pin derived from the companies table. */
  company_id?: number
  /** Set for a top-up of an existing plot (text fields are ignored server-side). */
  plot_id?: string
  /** Stake in cents; floor is MIN_STAKE_CENTS (500). */
  amount_cents: number
}

export interface CheckoutResponse {
  checkout_url: string
}

export interface PromotionCheckoutRequest {
  plot_id: string
  tier: '7d' | '30d'
}

export interface PlotPatchRequest {
  name?: string
  url?: string
  tagline?: string
  founder_name?: string
  founder_title?: string
  founder_link?: string
}

export interface MyPromotion {
  id: number
  kind: 'featured' | 'sponsor'
  plot_id: string | null
  country_iso: string | null
  starts_at: string
  ends_at: string
  status: 'active' | 'expired' | 'revoked'
}

export interface MineResponse {
  plots: WorldPlot[]
  promotions: MyPromotion[]
}

// ---------------------------------------------------------------------------
// Audience — the only numbers on this product that are about US
// ---------------------------------------------------------------------------

export interface AudienceCountry {
  /** ISO-3166 alpha-2, as Vercel reported it. */
  iso: string
  visitors: number
}

/**
 * GET /api/world/audience (and the identical body POST /api/world/beat returns).
 *
 * TWO FIGURES, TWO SOURCES, AND THE NULLS ARE THE CONTRACT:
 *
 *   `viewers_now` is ours — distinct anonymous sessions that beat inside
 *   `window_seconds`. Always a real integer, including 0 and 1. It is never
 *   rounded up, and the UI must not boast about 1 (see WatchingNow).
 *
 *   Everything else is the last cached read of Vercel Web Analytics for
 *   exploreyc.com. `null` means the backend has no VERCEL_ANALYTICS_TOKEN, or
 *   has never completed a read. **null is not zero and must never render as a
 *   number** — the line it belongs to is omitted instead.
 */
export interface AudienceResponse {
  /** Distinct sessions watching a World surface right now. */
  viewers_now: number
  /** How recently a session must have beaten to count. Seconds. */
  window_seconds: number
  /** How often the client is asked to beat. Seconds. */
  beat_seconds: number

  /** Unique visitors in the measured window. null = not measured. */
  visitors_30d: number | null
  pageviews_30d: number | null
  /** Distinct countries with at least one visitor. null = not measured. */
  countries_count: number | null
  /** True => `countries_count` is a FLOOR; render it with a "+". */
  countries_capped: boolean
  /** Biggest first. Empty when nothing has been measured. */
  top_countries: AudienceCountry[]
  /** Length of the measured window in days (30). null = not measured. */
  window_days: number | null
  /** End of the measured window, ISO-8601 UTC. null = not measured. */
  updated_at: string | null
  /** Provenance, e.g. 'vercel_web_analytics'. null = not measured. */
  source: string | null
}

// ============================================================================
// Client
// ============================================================================

export const worldApi = {
  // ---- Public reads ----
  /**
   * The globe's pins. The wire format is two layers (see decodeGlobe); this
   * hands back the same `{ plots: GlobePin[] }` it always did, so callers are
   * unaware the imported layer travels columnar.
   */
  getGlobe: async () => {
    const res = await api.get<GlobeWire>('/api/world/globe')
    return { ...res, data: decodeGlobe(res.data) }
  },

  getBoard: (kind: BoardKind, scope: BoardScope = 'world') =>
    api.get<BoardResponse>('/api/world/board', { params: { kind, scope } }),

  getFounders: (kind: FoundersBoardKind) =>
    api.get<FoundersResponse>('/api/world/founders', { params: { kind } }),

  getCountry: (iso: string) =>
    api.get<CountryResponse>(`/api/world/country/${encodeURIComponent(iso)}`),

  // Uses the authed instance so `is_mine` is populated when logged in;
  // works without a token too (header simply isn't attached).
  getPlot: (id: string) =>
    worldDevApi.get<WorldPlot>(`/api/world/plots/${encodeURIComponent(id)}`),

  /** Server-side geography. Rejects ocean points with 400 {"detail":"ocean"}. */
  getWhere: (lat: number, lng: number) =>
    api.get<WhereResponse>('/api/world/where', { params: { lat, lng } }),

  getPulse: () => api.get<PulseResponse>('/api/world/pulse'),

  getPromotions: (scope: string = 'world') =>
    api.get<PromotionsResponse>('/api/world/promotions', { params: { scope } }),

  /** Post-checkout landing poll — no auth, keyed by the Stripe session id. */
  getClaimed: (sessionId: string) =>
    api.get<ClaimedResponse>('/api/world/claimed', { params: { session_id: sessionId } }),

  /** Platform reach + live viewers. Cached server-side; safe to poll. */
  getAudience: () => api.get<AudienceResponse>('/api/world/audience'),

  /**
   * One anonymous presence heartbeat, which answers with the same body
   * `getAudience` returns — so a surface that beats never needs a second
   * request for the count.
   *
   * `sessionId` is generated in the browser and kept in sessionStorage. It is
   * not a cookie, it is not an identity, and it dies with the tab.
   */
  beat: (sessionId: string) =>
    api.post<AudienceResponse>('/api/world/beat', { session_id: sessionId }),

  // ---- Authed (dev session) ----
  createCheckout: (payload: WorldCheckoutRequest) =>
    worldDevApi.post<CheckoutResponse>('/api/world/checkout', payload),

  createPromotionCheckout: (payload: PromotionCheckoutRequest) =>
    worldDevApi.post<CheckoutResponse>('/api/world/promotions/checkout', payload),

  updatePlot: (id: string, patch: PlotPatchRequest) =>
    worldDevApi.patch<WorldPlot>(`/api/world/plots/${encodeURIComponent(id)}`, patch),

  uploadPlotLogo: (id: string, logoDataUrl: string) =>
    worldDevApi.post<WorldPlot>(`/api/world/plots/${encodeURIComponent(id)}/logo`, {
      logo_data_url: logoDataUrl,
    }),

  getMine: () => worldDevApi.get<MineResponse>('/api/world/mine'),
}

export default worldApi
