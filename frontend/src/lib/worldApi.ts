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
}

export interface GlobeResponse {
  plots: GlobePin[]
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
}

export interface FoundersResponse {
  rows: FounderRow[]
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
  country_iso: string
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

// ============================================================================
// Client
// ============================================================================

export const worldApi = {
  // ---- Public reads ----
  getGlobe: () => api.get<GlobeResponse>('/api/world/globe'),

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
