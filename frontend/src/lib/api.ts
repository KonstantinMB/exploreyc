import axios from 'axios'

const rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
// Ensure full URL with protocol (Vercel env may omit https://)
const API_BASE_URL = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
  ? rawUrl
  : `https://${rawUrl.replace(/^\/+/, '')}`

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Public-API developer account client — injects the dashboard session token from localStorage.
export const DEV_TOKEN_KEY = 'dev_token'
const devApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})
devApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(DEV_TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export interface Company {
  id: number
  source?: string
  source_id?: string
  dedupe_key?: string
  // Present when a company was merged across sources (source=all&merged=true)
  merged_sources?: { key: string; source_url?: string }[]
  // Present on semantic-search results (/api/companies/similar)
  similarity_score?: number
  name: string
  slug: string
  website: string
  one_liner: string
  long_description: string
  team_size: number
  batch: string
  status: string
  industry: string
  subindustry: string
  all_locations: string
  is_hiring: boolean
  top_company: boolean
  nonprofit: boolean
  stage: string
  small_logo_thumb_url: string
  tags: string
  regions: string
  industries: string
  latitude?: number
  longitude?: number
  country?: string
  created_at: string
  updated_at: string
  // Source-agnostic fields (populated for a16z and future VC/incubator sources)
  founders?: string
  year_founded?: number
  exit_type?: string
  acquirer?: string
  ticker_symbol?: string
  funded_date?: string
  source_url?: string
  // Funding data fields (Coresignal)
  funding_total_usd?: number
  funding_last_round_usd?: number
  funding_last_round_date?: string
  funding_last_round_name?: string
  funding_rounds_count?: number
  investors_count?: number
  valuation_usd?: number
  employee_count?: number
  employee_growth_6m?: number
  coresignal_last_updated?: string
}

export interface ScrapeRequest {
  query?: string
  batch?: string[]
  industry?: string[]
  region?: string[]
  is_hiring?: boolean
  top_company?: boolean
  nonprofit?: boolean
  hits_per_page?: number
  max_pages?: number
}

export interface CompanyFilter {
  limit?: number
  offset?: number
  batch?: string
  is_hiring?: boolean
  industry?: string
  country?: string
  search?: string
  top_company?: boolean
  source?: string // undefined -> YC only; 'all' -> every source; or a source key like 'a16z'
  merged?: boolean // collapse same-domain rows across sources into one card
}

export interface Source {
  key: string
  display_name: string
  count: number
}

// ---- Public API developer accounts ----
export interface ApiUser {
  id: number
  email: string
  company_name?: string
  plan: string
  plan_name?: string
  status: string
  email_verified: boolean
  avatar_url?: string | null
  daily_limit: number
}

export interface ApiKey {
  id: number
  key_prefix: string
  name?: string
  is_active: boolean
  revoked_at?: string | null
  last_used_at?: string | null
  created_at: string
}

export interface UsageSummary {
  used_24h: number
  limit: number
  remaining: number
}

export interface DevMe extends ApiUser {
  usage: UsageSummary
  keys: ApiKey[]
}

export interface CreatedApiKey {
  id: number
  api_key: string
  key_prefix: string
  name?: string
  warning: string
}

export interface UsageStats {
  days: number
  total: number
  series: { date: string; count: number }[]
  by_endpoint: { endpoint: string; count: number }[]
}

export interface Stats {
  total_companies: number          // YC-only
  total_all_companies?: number     // every source (YC + Hacker News + a16z + ...)
  hiring: number
  by_batch: Record<string, number>
  by_industry: Record<string, number>
  by_country: Record<string, number>
  by_status: Record<string, number>
  by_batch_industry?: Record<string, Record<string, number>>
}

export interface ScrapeJob {
  job_id: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  total_scraped: number
  current_page: number
  error?: string
  created_at: string
  updated_at: string
}

export interface SimilarCompany extends Company {
  similarity_score: number
}

export interface BatchCount {
  batch: string
  count: number
}

export interface ValidationResult {
  similar_companies: SimilarCompany[]
  total_similar: number
  market_indicator: 'green' | 'yellow' | 'crowded'
  market_analysis: string
  industry_breakdown: Record<string, number>
  batch_timeline: BatchCount[]
  market_size_percentage: number
}

export const apiClient = {
  // Health check
  health: () => api.get('/api/health'),

  // Scraping
  startScrape: (request: ScrapeRequest) => api.post<{ job_id: number }>('/api/scrape', request),
  getScrapeStatus: (jobId: number) => api.get<ScrapeJob>(`/api/scrape/status/${jobId}`),

  // Companies
  getCompanies: (filters: CompanyFilter) =>
    api.post<{ companies: Company[]; total: number; has_more: boolean }>('/api/companies', filters),
  getCompany: (id: number) => api.get<Company>(`/api/companies/${id}`),
  getCompanyBySlug: (slug: string) => api.get<Company>(`/api/company/slug/${slug}`),
  // All-source semantic search (vector search across YC + Hacker News + a16z + ...)
  getSimilarCompanies: (query: string, limit = 12) =>
    api.post<{ companies: Company[]; total: number }>('/api/companies/similar', { query, limit }),

  // Stats
  getStats: () => api.get<Stats>('/api/stats'),

  // Bootstrap: stats + map in one call (faster initial load)
  getBootstrap: (recentBatches?: number) =>
    api.get<{ stats: Stats; companies: Company[]; total: number; total_map: number }>('/api/bootstrap', {
      params: recentBatches != null ? { recent_batches: recentBatches } : {},
    }),

  // Map (full - use when "Show all" clicked)
  getMapData: (batch?: string, isHiring?: boolean) =>
    api.get<{ companies: Company[]; total: number }>('/api/map', {
      params: { batch, is_hiring: isHiring }
    }),

  // Filters
  getSources: () => api.get<{ sources: Source[] }>('/api/filters/sources'),

  // Public API developer accounts + keys
  devSignup: (email: string, password: string, company_name?: string) =>
    devApi.post<{ token: string; user: ApiUser }>('/api/dev/signup', { email, password, company_name }),
  devLogin: (email: string, password: string) =>
    devApi.post<{ token: string; user: ApiUser }>('/api/dev/login', { email, password }),
  devLogout: () => devApi.post('/api/dev/logout'),
  devMe: () => devApi.get<DevMe>('/api/dev/me'),
  createApiKey: (name?: string) => devApi.post<CreatedApiKey>('/api/dev/keys', { name }),
  listApiKeys: () => devApi.get<{ keys: ApiKey[] }>('/api/dev/keys'),
  revokeApiKey: (id: number) => devApi.post(`/api/dev/keys/${id}/revoke`),
  devUsage: (days = 7) => devApi.get<UsageStats>(`/api/dev/usage?days=${days}`),
  updateProfile: (data: { company_name?: string; avatar_url?: string }) =>
    devApi.post<ApiUser>('/api/dev/profile', data),
  getBatches: () => api.get<{ batches: string[] }>('/api/filters/batches'),
  getIndustries: () => api.get<{ industries: string[] }>('/api/filters/industries'),
  getCountries: () => api.get<{ countries: string[] }>('/api/filters/countries'),

  // Feature interest — data export is currently unavailable; users register demand here.
  submitFeatureInterest: (payload: { feature?: string; email?: string; user_identifier?: string }) =>
    api.post<{ success: boolean; feature: string; already_registered: boolean; count: number }>(
      '/api/feature-interest',
      payload,
    ),

  // Startup Idea Validator
  validateIdea: (idea: string, maxSimilar: number = 10) =>
    api.post<ValidationResult>('/api/validate-idea', { idea, max_similar: maxSimilar }),

  // Hero Answer Box
  heroAnswer: (idea: string) =>
    api.post<HeroAnswer>('/api/hero-answer', { idea }),

  // Batch Wrapped
  getBatchWrapped: (batch: string) =>
    api.get(`/api/batch/${encodeURIComponent(batch)}/wrapped`),

  // Funding Data
  getFundingStats: () => api.get<FundingStats>('/api/funding/stats'),
  getFundingNetwork: () => api.get<FundingNetwork>('/api/funding/network'),
  getCompanyFunding: (companyId: number) => api.get<CompanyFundingDetails>(`/api/companies/${companyId}/funding`),
  enrichCompanyFunding: (companyId: number) => api.post(`/api/admin/enrich-funding/${companyId}`),

  // Hiring Board Data
  getHiringBoard: () => api.get<any>('/api/hiring/board'),
  getHiringStats: () => api.get<any>('/api/hiring/stats'),
}

// ============================================================================
// FUNDING DATA INTERFACES
// ============================================================================

export interface FundingStats {
  total_funded_companies: number
  total_funding_usd: number
  avg_funding_per_company: number
  top_funded_companies: Array<{
    name: string
    slug: string
    funding_total_usd: number
    batch: string
    industry: string
    valuation_usd?: number
  }>
  funding_by_batch: Record<string, { total: number; funded_count: number }>
  funding_by_industry: Record<string, { total: number; count: number }>
  recent_fundings: Array<{
    name: string
    slug: string
    funding_last_round_usd: number
    funding_last_round_date: string
    funding_last_round_name: string
    batch: string
  }>
}

export interface FundingNetwork {
  companies: Array<{
    id: number
    name: string
    slug: string
    funding_total_usd: number
    valuation_usd?: number
    funding_stage?: string
    batch: string
    industry: string
    logo?: string
    last_funding_date?: string
    employee_count?: number
  }>
  investors: Array<{
    id: number
    name: string
    investor_type?: string
    portfolio_count: number
  }>
  connections: Array<{
    company_id: number
    investor_id: number
    amount_usd?: number
    round_name?: string
    date?: string
  }>
  total_companies: number
  total_investors: number
  total_connections: number
}

export interface CompanyFundingDetails {
  company_id: number
  company_name: string
  funding_total_usd?: number
  funding_last_round_usd?: number
  funding_last_round_date?: string
  funding_last_round_name?: string
  funding_rounds_count?: number
  investors_count?: number
  valuation_usd?: number
  employee_count?: number
  employee_growth_6m?: number
  last_updated?: string
  funding_rounds: Array<{
    round_name: string
    amount_usd: number
    date: string
    investors: string[]
  }>
  investors: Array<{
    name: string
    is_lead: boolean
  }>
}

// Hero Answer Box
export interface HeroClosest {
  id: number
  name: string
  slug: string
  batch: string
  similarity: number
}

export interface HeroAnswer {
  meter: 'open' | 'emerging' | 'competitive' | 'crowded'
  headline: string
  summary: string
  closest: HeroClosest[]
  total_similar: number
  top_industries: { name: string; count: number }[]
  recent_share: number
  hiring_share: number
  market_size_percentage: number
  cached: boolean
  prose: string | null
  // Enrichment for the dedicated /idea breakdown page (present on fresh answers).
  all_matches?: SimilarCompany[]
  industry_breakdown?: Record<string, number>
  batch_timeline?: BatchCount[]
  market_indicator?: 'green' | 'yellow' | 'crowded'
}

// WebSocket connection for live scrape updates
export const createWebSocket = (onMessage: (data: any) => void) => {
  const wsUrl = API_BASE_URL.replace(/^http/, 'ws')
  const ws = new WebSocket(`${wsUrl}/ws/scrape`)

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data)
    onMessage(data)
  }

  ws.onerror = (error) => {
    console.error('WebSocket error:', error)
  }

  ws.onclose = () => {
    console.log('WebSocket connection closed')
  }

  return ws
}

// Raw axios instance for custom API calls (e.g. /api/subscribe, /api/roadmap/*)
export { api }
export default api
