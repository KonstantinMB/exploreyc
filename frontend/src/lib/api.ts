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

export interface Company {
  id: number
  source?: string
  source_id?: string
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
}

export interface Source {
  key: string
  display_name: string
  count: number
}

export interface Stats {
  total_companies: number
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
  getBatches: () => api.get<{ batches: string[] }>('/api/filters/batches'),
  getIndustries: () => api.get<{ industries: string[] }>('/api/filters/industries'),
  getCountries: () => api.get<{ countries: string[] }>('/api/filters/countries'),

  // Export
  exportJSON: (filters: Partial<CompanyFilter>) => {
    const params = new URLSearchParams()
    if (filters.batch) params.append('batch', filters.batch)
    if (filters.is_hiring !== undefined) params.append('is_hiring', String(filters.is_hiring))
    if (filters.industry) params.append('industry', filters.industry)
    if (filters.country) params.append('country', filters.country)
    if (filters.search) params.append('search', filters.search)
    if (filters.top_company !== undefined) params.append('top_company', String(filters.top_company))
    if (filters.source) params.append('source', filters.source)

    window.open(`${API_BASE_URL}/api/export/json?${params.toString()}`, '_blank')
  },

  exportCSV: (filters: Partial<CompanyFilter>) => {
    const params = new URLSearchParams()
    if (filters.batch) params.append('batch', filters.batch)
    if (filters.is_hiring !== undefined) params.append('is_hiring', String(filters.is_hiring))
    if (filters.industry) params.append('industry', filters.industry)
    if (filters.country) params.append('country', filters.country)
    if (filters.search) params.append('search', filters.search)
    if (filters.top_company !== undefined) params.append('top_company', String(filters.top_company))
    if (filters.source) params.append('source', filters.source)

    window.open(`${API_BASE_URL}/api/export/csv?${params.toString()}`, '_blank')
  },

  // Startup Idea Validator
  validateIdea: (idea: string, maxSimilar: number = 10) =>
    api.post<ValidationResult>('/api/validate-idea', { idea, max_similar: maxSimilar }),

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
