import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Copy, Check, KeyRound, Gauge, ExternalLink, BookOpen, ChevronRight } from 'lucide-react'
import { DotPattern } from '../components/ui/dot-pattern'
import { ApiProCta } from '../components/ApiProCta'
import { useDevAuth } from '../contexts/DevAuthContext'

const API_BASE = 'https://api.exploreyc.com/api/v1'

type Param = { name: string; type: string; required?: boolean; def?: string; desc: string }
type Endpoint = {
  id: string
  method: string
  path: string
  summary: string
  params?: Param[]
  request: string
  response: string
}

// A trimmed company object shared by several examples
const COMPANY = `{
  "id": 2000373009,
  "source": "a16z",
  "source_id": "373009",
  "name": "11x",
  "slug": "11x",
  "website": "https://www.11x.ai/",
  "one_liner": "AI digital workers for revenue teams.",
  "status": "Active",
  "stage": "Venture",
  "industry": null,
  "batch": null,
  "country": null,
  "founders": null,
  "exit_type": null,
  "ticker_symbol": null,
  "small_logo_thumb_url": "https://d1lamhf6l6yk6d.cloudfront.net/.../11x.svg",
  "created_at": "2026-07-06T08:49:28Z"
}`

const ENDPOINTS: Endpoint[] = [
  {
    id: 'companies',
    method: 'GET',
    path: '/companies',
    summary: 'List and filter companies across all tracked sources (YC + a16z).',
    params: [
      { name: 'source', type: 'string', def: 'all', desc: "'yc', 'a16z', or 'all'." },
      { name: 'limit', type: 'integer', def: '50', desc: 'Page size, 1–100.' },
      { name: 'offset', type: 'integer', def: '0', desc: 'Rows to skip (pagination).' },
      { name: 'batch', type: 'string', desc: 'YC batch, e.g. "Winter 2024".' },
      { name: 'industry', type: 'string', desc: 'Exact industry match.' },
      { name: 'country', type: 'string', desc: 'Exact country match.' },
      { name: 'is_hiring', type: 'boolean', desc: 'Only companies currently hiring.' },
      { name: 'top_company', type: 'boolean', desc: 'Only YC "top companies".' },
      { name: 'search', type: 'string', desc: 'Substring match on name / description.' },
    ],
    request: `curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "${API_BASE}/companies?source=a16z&limit=2"`,
    response: `{
  "companies": [
    ${COMPANY.split('\n').join('\n    ')},
    { "id": 2000371459, "source": "a16z", "name": "Accolade",
      "status": "Acquired", "stage": "M&A", "exit_type": "M&A",
      "acquirer": "Transcarent", "founders": null, "created_at": "2026-07-06T08:49:28Z" }
  ],
  "total": 849,
  "limit": 2,
  "offset": 0,
  "has_more": true
}`,
  },
  {
    id: 'company-id',
    method: 'GET',
    path: '/companies/{id}',
    summary: 'Fetch a single company by its numeric id. Returns 404 if not found.',
    params: [{ name: 'id', type: 'integer (path)', required: true, desc: 'The company id from a list/search response.' }],
    request: `curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "${API_BASE}/companies/2000373009"`,
    response: COMPANY,
  },
  {
    id: 'company-slug',
    method: 'GET',
    path: '/companies/{slug}',
    summary: 'Fetch a single company by slug (the human-readable url segment).',
    params: [{ name: 'slug', type: 'string (path)', required: true, desc: 'e.g. "11x", "pagerduty".' }],
    request: `curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "${API_BASE}/companies/slug/11x"`,
    response: COMPANY,
  },
  {
    id: 'search',
    method: 'GET',
    path: '/search',
    summary: 'Full-text search over company name, one-liner, and description.',
    params: [
      { name: 'q', type: 'string', required: true, desc: 'The search query.' },
      { name: 'limit', type: 'integer', def: '50', desc: 'Page size, 1–100.' },
      { name: 'offset', type: 'integer', def: '0', desc: 'Pagination offset.' },
      { name: 'source', type: 'string', def: 'all', desc: "'yc', 'a16z', or 'all'." },
    ],
    request: `curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "${API_BASE}/search?q=fintech&limit=10"`,
    response: `{
  "companies": [ { "id": 15231, "source": "yc", "name": "Stripe",
    "one_liner": "Payments infrastructure for the internet.",
    "batch": "Summer 2009", "industry": "Fintech", "status": "Active" } ],
  "total": 214,
  "limit": 10,
  "offset": 0,
  "has_more": true
}`,
  },
  {
    id: 'stats',
    method: 'GET',
    path: '/stats',
    summary: 'Aggregate portfolio stats: totals and counts by batch / industry / country / status.',
    request: `curl -H "Authorization: Bearer YOUR_API_KEY" "${API_BASE}/stats"`,
    response: `{
  "total_companies": 5017,
  "hiring": 1188,
  "by_batch": { "Summer 2024": 253, "Winter 2024": 241, "Summer 2023": 238 },
  "by_industry": { "B2B": 1402, "Fintech": 523, "Healthcare": 388 },
  "by_country": { "United States": 3901, "United Kingdom": 214 },
  "by_status": { "Active": 4610, "Acquired": 301, "Public": 106 }
}`,
  },
  {
    id: 'sources',
    method: 'GET',
    path: '/sources',
    summary: 'The incubators / VCs available in the dataset, with company counts.',
    request: `curl -H "Authorization: Bearer YOUR_API_KEY" "${API_BASE}/sources"`,
    response: `{
  "sources": [
    { "key": "yc",   "display_name": "Y Combinator", "count": 6017 },
    { "key": "a16z", "display_name": "Andreessen Horowitz (a16z)", "count": 849 }
  ]
}`,
  },
  {
    id: 'batches',
    method: 'GET',
    path: '/batches',
    summary: 'Distinct YC batch names (most recent first).',
    request: `curl -H "Authorization: Bearer YOUR_API_KEY" "${API_BASE}/batches"`,
    response: `{ "batches": ["Summer 2024", "Winter 2024", "Summer 2023", "Winter 2023"] }`,
  },
  {
    id: 'industries',
    method: 'GET',
    path: '/industries',
    summary: 'Distinct industry values you can pass to the `industry` filter.',
    request: `curl -H "Authorization: Bearer YOUR_API_KEY" "${API_BASE}/industries"`,
    response: `{ "industries": ["B2B", "Consumer", "Education", "Fintech", "Healthcare"] }`,
  },
  {
    id: 'countries',
    method: 'GET',
    path: '/countries',
    summary: 'Distinct country values you can pass to the `country` filter.',
    request: `curl -H "Authorization: Bearer YOUR_API_KEY" "${API_BASE}/countries"`,
    response: `{ "countries": ["United States", "United Kingdom", "Canada", "India"] }`,
  },
  {
    id: 'map',
    method: 'GET',
    path: '/map',
    summary: 'Geo-located companies (only those with lat/lng), for map views.',
    params: [
      { name: 'batch', type: 'string', desc: 'Restrict to a YC batch.' },
      { name: 'is_hiring', type: 'boolean', desc: 'Only companies currently hiring.' },
    ],
    request: `curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "${API_BASE}/map?is_hiring=true"`,
    response: `{
  "companies": [
    { "id": 15231, "name": "Stripe", "slug": "stripe",
      "latitude": 37.7749, "longitude": -122.4194,
      "batch": "Summer 2009", "is_hiring": true } ],
  "total": 4231
}`,
  },
  {
    id: 'wrapped',
    method: 'GET',
    path: '/batch/{name}/wrapped',
    summary: '"Wrapped"-style analytics for a single YC batch.',
    params: [{ name: 'name', type: 'string (path)', required: true, desc: 'URL-encoded batch, e.g. "Summer%202024".' }],
    request: `curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "${API_BASE}/batch/Summer%202024/wrapped"`,
    response: `{
  "batch": "Summer 2024",
  "total_companies": 253,
  "hiring_count": 61,
  "hiring_percentage": 24.1,
  "avg_team_size": 4.2,
  "top_industries": [ { "name": "B2B", "count": 120, "percentage": 47.4 } ],
  "top_countries": [ { "name": "United States", "count": 180, "percentage": 71.1 } ],
  "fun_fact": "24% of this batch is already hiring."
}`,
  },
]

function Terminal({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`border border-border bg-[#0b0b0d] rounded-md overflow-hidden ${className}`}>
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-white/10 bg-white/[0.03]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-[10px] font-mono text-white/40 truncate">{title}</span>
      </div>
      <div className="p-3 font-mono text-[12.5px]">{children}</div>
    </div>
  )
}

function CopyBtn({ value }: { value: string }) {
  const [c, setC] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(value); setC(true); setTimeout(() => setC(false), 1200) }}
            className="inline-flex items-center gap-1 text-[11px] text-white/40 hover:text-[#FB651E]">
      {c ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}{c ? 'copied' : 'copy'}
    </button>
  )
}

function EndpointCard({ e }: { e: Endpoint }) {
  const [open, setOpen] = useState(false)
  return (
    <div id={`ep-${e.id}`} className="border border-border rounded-md overflow-hidden scroll-mt-6 bg-background">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left">
        <ChevronRight className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 flex-shrink-0">{e.method}</span>
        <code className="font-mono text-sm text-foreground flex-shrink-0">{e.path}</code>
        <span className="text-sm text-muted-foreground truncate hidden sm:block">{e.summary}</span>
      </button>

      {open && (
        <div className="border-t border-border p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Left: description + params */}
          <div>
            <p className="text-sm text-muted-foreground mb-3">{e.summary}</p>
            {e.params ? (
              <div className="border border-border rounded overflow-hidden">
                <table className="w-full text-xs font-mono">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr><th className="px-2 py-1.5">Param</th><th className="px-2 py-1.5">Type</th><th className="px-2 py-1.5">Description</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {e.params.map((p) => (
                      <tr key={p.name}>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <span className="text-[#FB651E]">{p.name}</span>
                          {p.required && <span className="ml-1 text-red-500 text-[10px]">*</span>}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                          {p.type}{p.def && <span className="text-muted-foreground/60"> = {p.def}</span>}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">{p.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground font-mono">No parameters.</p>
            )}
          </div>

          {/* Right: example request + response */}
          <div className="space-y-3 min-w-0">
            <Terminal title="request — bash">
              <div className="flex items-start justify-between gap-2">
                <pre className="overflow-x-auto text-emerald-300/90 leading-relaxed"><code>{e.request}</code></pre>
                <CopyBtn value={e.request} />
              </div>
            </Terminal>
            <Terminal title="200 response — json">
              <div className="flex items-start justify-between gap-2">
                <pre className="overflow-x-auto text-white/80 leading-relaxed max-h-80"><code>{e.response}</code></pre>
                <CopyBtn value={e.response} />
              </div>
            </Terminal>
          </div>
        </div>
      )}
    </div>
  )
}

export function ApiDocsPage() {
  const { user } = useDevAuth()
  const nav = [
    { id: 'overview', label: 'Overview' },
    { id: 'auth', label: 'Authentication' },
    { id: 'ratelimits', label: 'Rate limits' },
    { id: 'errors', label: 'Errors' },
  ]

  return (
    <>
      <Helmet><title>API Reference | ExploreYC</title></Helmet>
      <div className="relative min-h-screen bg-background overflow-x-hidden">
        <DotPattern color="hsl(var(--primary) / 0.10)" size={26} radius={0.5} />
        <div className="relative mx-auto max-w-[1400px] px-4 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-8">

            {/* Sticky sidebar */}
            <aside className="hidden lg:block">
              <div className="sticky top-20 font-mono text-sm space-y-4">
                <div className="text-base font-bold flex items-center gap-2">
                  <span className="text-[#FB651E]">&gt;</span> API Reference
                </div>
                <div className="space-y-0.5">
                  {nav.map((n) => (
                    <a key={n.id} href={`#${n.id}`} className="block px-2 py-1 text-muted-foreground hover:text-[#FB651E] transition-colors">{n.label}</a>
                  ))}
                </div>
                <div>
                  <div className="px-2 text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">Endpoints</div>
                  <div className="space-y-0.5">
                    {ENDPOINTS.map((e) => (
                      <a key={e.id} href={`#ep-${e.id}`} className="flex items-center gap-2 px-2 py-1 text-muted-foreground hover:text-[#FB651E] transition-colors">
                        <span className="text-[9px] text-emerald-500 w-7">{e.method}</span>
                        <code className="text-xs truncate">{e.path}</code>
                      </a>
                    ))}
                  </div>
                </div>
                <Link to={user ? '/dashboard' : '/signup'}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-[#FB651E] hover:bg-[#E65C00] text-white text-xs font-semibold rounded-sm transition-colors">
                  <KeyRound className="h-3.5 w-3.5" /> {user ? 'Your keys' : 'Get an API key'}
                </Link>
              </div>
            </aside>

            {/* Main content */}
            <main className="min-w-0 space-y-10">
              {/* Overview */}
              <section id="overview" className="scroll-mt-6">
                <div className="flex items-center gap-2 mb-2 font-mono text-sm text-muted-foreground">
                  <span>$ curl api.exploreyc.com/api/v1</span>
                </div>
                <h1 className="text-3xl font-bold font-mono mb-2"><span className="text-[#FB651E]">&gt;</span> ExploreYC API</h1>
                <p className="text-muted-foreground max-w-2xl mb-4">
                  A read-only REST API over Y Combinator and a16z portfolio companies — funding, stage, exits,
                  founders, and more. JSON over HTTPS. Free tier is 5 requests/day.
                </p>
                <div className="flex flex-wrap gap-2">
                  <a href={`${API_BASE}/docs`} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center gap-2 px-3 py-2 border border-border text-sm rounded-sm hover:border-[#FB651E]/50 transition-colors font-mono">
                    <BookOpen className="h-4 w-4" /> Interactive Swagger <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="mt-4">
                  <Terminal title="base url">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-emerald-300">{API_BASE}</span><CopyBtn value={API_BASE} />
                    </div>
                  </Terminal>
                </div>
              </section>

              {/* Auth */}
              <section id="auth" className="scroll-mt-6">
                <h2 className="text-xl font-bold font-mono mb-2 flex items-center gap-2"><KeyRound className="h-5 w-5 text-[#FB651E]" /> Authentication</h2>
                <p className="text-sm text-muted-foreground mb-3 max-w-2xl">
                  Every request needs your API key as a bearer token (or the <code className="text-[#FB651E]">X-API-Key</code> header).
                  Missing/invalid/revoked keys return <code>401</code>.{' '}
                  {user ? <>Grab yours from the <Link to="/dashboard" className="text-[#FB651E] hover:underline">dashboard</Link>.</>
                        : <><Link to="/signup" className="text-[#FB651E] hover:underline">Sign up</Link> to get one.</>}
                </p>
                <Terminal title="auth header">
                  <span className="text-white/80">Authorization: Bearer <span className="text-emerald-300">eyc_live_…</span></span>
                </Terminal>
              </section>

              {/* Rate limits */}
              <section id="ratelimits" className="scroll-mt-6">
                <h2 className="text-xl font-bold font-mono mb-2 flex items-center gap-2"><Gauge className="h-5 w-5 text-[#FB651E]" /> Rate limits</h2>
                <p className="text-sm text-muted-foreground mb-3 max-w-2xl">
                  Enforced per key on a rolling 24h window. Every response includes <code className="text-[#FB651E]">X-RateLimit-Limit</code>,
                  <code className="text-[#FB651E]"> X-RateLimit-Remaining</code>, and <code className="text-[#FB651E]">X-RateLimit-Reset</code>.
                  Over the limit returns <code>429</code> with a <code className="text-[#FB651E]">Retry-After</code> header.
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="border border-border rounded-md overflow-hidden">
                    <table className="w-full font-mono text-sm">
                      <thead className="bg-muted/50 text-left text-muted-foreground"><tr><th className="px-3 py-2">Plan</th><th className="px-3 py-2">Limit</th><th className="px-3 py-2">Price</th></tr></thead>
                      <tbody className="divide-y divide-border">
                        <tr><td className="px-3 py-2 font-medium">Free</td><td className="px-3 py-2 text-[#FB651E]">5 / day</td><td className="px-3 py-2 text-muted-foreground">$0</td></tr>
                        <tr><td className="px-3 py-2 font-medium">Starter</td><td className="px-3 py-2 text-[#FB651E]">500 / day</td><td className="px-3 py-2 text-muted-foreground">$29/mo</td></tr>
                        <tr><td className="px-3 py-2 font-medium">Pro</td><td className="px-3 py-2 text-[#FB651E]">5,000 / day</td><td className="px-3 py-2 text-muted-foreground">$99/mo</td></tr>
                        <tr><td className="px-3 py-2 font-medium">Enterprise</td><td className="px-3 py-2 text-[#FB651E]">Custom</td><td className="px-3 py-2 text-muted-foreground">Contact us</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <Terminal title="429 response — json">
                    <pre className="text-white/80 leading-relaxed"><code>{`Retry-After: 82800
X-RateLimit-Remaining: 0

{ "detail": "Rate limit exceeded for
  your plan. Upgrade for a higher limit." }`}</code></pre>
                  </Terminal>
                </div>
                <ApiProCta className="mt-6" defaultEmail={user?.email ?? ''} />
              </section>

              {/* Errors */}
              <section id="errors" className="scroll-mt-6">
                <h2 className="text-xl font-bold font-mono mb-2 flex items-center gap-2"><span className="text-[#FB651E]">#</span> Errors</h2>
                <div className="border border-border rounded-md overflow-hidden max-w-2xl">
                  <table className="w-full font-mono text-sm">
                    <tbody className="divide-y divide-border">
                      <tr><td className="px-3 py-2 text-[#FB651E]">401</td><td className="px-3 py-2 text-muted-foreground">Missing, invalid, or revoked API key.</td></tr>
                      <tr><td className="px-3 py-2 text-[#FB651E]">404</td><td className="px-3 py-2 text-muted-foreground">Company / batch not found.</td></tr>
                      <tr><td className="px-3 py-2 text-[#FB651E]">422</td><td className="px-3 py-2 text-muted-foreground">Invalid query parameter.</td></tr>
                      <tr><td className="px-3 py-2 text-[#FB651E]">429</td><td className="px-3 py-2 text-muted-foreground">Rate limit exceeded — see Retry-After.</td></tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Endpoints */}
              <section className="scroll-mt-6">
                <h2 className="text-xl font-bold font-mono mb-3 flex items-center gap-2"><span className="text-[#FB651E]">#</span> Endpoints
                  <span className="text-xs font-normal text-muted-foreground">— click to expand</span>
                </h2>
                <div className="space-y-2">
                  {ENDPOINTS.map((e) => <EndpointCard key={e.id} e={e} />)}
                </div>
              </section>
            </main>
          </div>
        </div>
      </div>
    </>
  )
}
