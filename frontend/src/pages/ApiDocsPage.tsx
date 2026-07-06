import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Terminal, Copy, Check, BookOpen, KeyRound, Gauge, ExternalLink } from 'lucide-react'
import { HackerCard } from '../components/ui/hacker-card'
import { Button } from '../components/ui/button'
import { useDevAuth } from '../contexts/DevAuthContext'

const API_BASE = 'https://api.exploreyc.com/api/v1'

const ENDPOINTS: { method: string; path: string; desc: string; params?: string }[] = [
  { method: 'GET', path: '/companies', desc: 'List / filter companies (YC + a16z).', params: 'limit≤100, offset, source (yc|a16z|all), batch, industry, country, is_hiring, top_company, search' },
  { method: 'GET', path: '/companies/{id}', desc: 'A single company by id.' },
  { method: 'GET', path: '/companies/slug/{slug}', desc: 'A single company by slug.' },
  { method: 'GET', path: '/search', desc: 'Full-text company search.', params: 'q (required), limit≤100, offset, source' },
  { method: 'GET', path: '/stats', desc: 'Portfolio stats (counts by batch, industry, country).' },
  { method: 'GET', path: '/sources', desc: 'Available sources (incubators / VCs) with counts.' },
  { method: 'GET', path: '/batches', desc: 'Distinct YC batches.' },
  { method: 'GET', path: '/industries', desc: 'Distinct industries.' },
  { method: 'GET', path: '/countries', desc: 'Distinct countries.' },
  { method: 'GET', path: '/map', desc: 'Geo-located companies (lat/lng).', params: 'batch, is_hiring' },
  { method: 'GET', path: '/batch/{name}/wrapped', desc: 'Batch "wrapped" analytics.' },
]

const PLANS = [
  { name: 'Free', limit: '5 / day', price: '$0' },
  { name: 'Starter', limit: '500 / day', price: '$29/mo' },
  { name: 'Pro', limit: '5,000 / day', price: '$99/mo' },
  { name: 'Enterprise', limit: 'Custom', price: 'Contact us' },
]

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative group">
      {label && <div className="text-[10px] uppercase tracking-wide font-mono text-muted-foreground mb-1">{label}</div>}
      <pre className="rounded-md border border-border bg-muted/50 p-3 pr-12 overflow-x-auto text-xs font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
        className="absolute top-2 right-2 inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-[#FB651E]"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}

export function ApiDocsPage() {
  const { user } = useDevAuth()

  const curl = `curl -H "Authorization: Bearer YOUR_API_KEY" \\\n  "${API_BASE}/companies?source=all&limit=20"`
  const js = `const res = await fetch("${API_BASE}/companies?source=all&limit=20", {\n  headers: { Authorization: "Bearer YOUR_API_KEY" },\n});\nconst data = await res.json();`
  const py = `import requests\nr = requests.get(\n    "${API_BASE}/companies",\n    headers={"Authorization": "Bearer YOUR_API_KEY"},\n    params={"source": "all", "limit": 20},\n)\nprint(r.json())`

  return (
    <>
      <Helmet><title>API Docs | ExploreYC</title></Helmet>
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2 font-mono text-sm text-muted-foreground">
              <Terminal className="h-4 w-4 text-[#FB651E]" />
              <span>$ curl api.exploreyc.com/api/v1</span>
            </div>
            <h1 className="text-3xl font-bold font-mono">
              <span className="text-[#FB651E]">&gt;</span> ExploreYC API
            </h1>
            <p className="text-muted-foreground font-mono text-sm mt-2 max-w-2xl">
              Read-only programmatic access to Y Combinator and a16z portfolio companies —
              funding, stage, exits, and more.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {user ? (
                <Link to="/dashboard"><Button className="bg-[#FB651E] hover:bg-[#E65C00] font-mono"><KeyRound className="h-4 w-4 mr-2" />Your keys</Button></Link>
              ) : (
                <Link to="/signup"><Button className="bg-[#FB651E] hover:bg-[#E65C00] font-mono"><KeyRound className="h-4 w-4 mr-2" />Get an API key</Button></Link>
              )}
              <a href={`${API_BASE}/docs`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="font-mono"><BookOpen className="h-4 w-4 mr-2" />Interactive docs<ExternalLink className="h-3 w-3 ml-2" /></Button>
              </a>
            </div>
          </div>

          {/* Auth */}
          <HackerCard glowColor="orange" className="p-6 mb-6">
            <h2 className="text-lg font-bold font-mono mb-3 flex items-center gap-2"><KeyRound className="h-5 w-5 text-[#FB651E]" />Authentication</h2>
            <p className="text-sm text-muted-foreground mb-3">
              Send your key on every request as a bearer token (or the <code className="bg-muted px-1 rounded">X-API-Key</code> header).
              {user
                ? <> You're logged in — grab your key from the <Link to="/dashboard" className="text-[#FB651E] hover:underline">dashboard</Link>.</>
                : <> <Link to="/signup" className="text-[#FB651E] hover:underline">Sign up</Link> to get one.</>}
            </p>
            <CodeBlock label="Base URL" code={API_BASE} />
          </HackerCard>

          {/* Quick start */}
          <HackerCard glowColor="green" className="p-6 mb-6">
            <h2 className="text-lg font-bold font-mono mb-3">Quick start</h2>
            <div className="space-y-3">
              <CodeBlock label="curl" code={curl} />
              <CodeBlock label="JavaScript" code={js} />
              <CodeBlock label="Python" code={py} />
            </div>
          </HackerCard>

          {/* Rate limits */}
          <HackerCard glowColor="blue" className="p-6 mb-6">
            <h2 className="text-lg font-bold font-mono mb-3 flex items-center gap-2"><Gauge className="h-5 w-5 text-blue-500" />Rate limits</h2>
            <p className="text-sm text-muted-foreground mb-3">
              Per key, rolling 24h. Every response includes <code className="bg-muted px-1 rounded">X-RateLimit-Limit</code>,
              <code className="bg-muted px-1 rounded ml-1">X-RateLimit-Remaining</code>, and
              <code className="bg-muted px-1 rounded ml-1">X-RateLimit-Reset</code>; a 429 adds <code className="bg-muted px-1 rounded">Retry-After</code>.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead className="text-left text-muted-foreground border-b border-border">
                  <tr><th className="pb-2">Plan</th><th className="pb-2">Limit</th><th className="pb-2">Price</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {PLANS.map((p) => (
                    <tr key={p.name}><td className="py-2 font-medium">{p.name}</td><td className="py-2">{p.limit}</td><td className="py-2 text-muted-foreground">{p.price}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </HackerCard>

          {/* Endpoints */}
          <HackerCard glowColor="purple" className="p-6">
            <h2 className="text-lg font-bold font-mono mb-3">Endpoints</h2>
            <div className="divide-y divide-border">
              {ENDPOINTS.map((e) => (
                <div key={e.path} className="py-3">
                  <div className="flex items-center gap-2 font-mono text-sm">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">{e.method}</span>
                    <code className="text-foreground">{e.path}</code>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{e.desc}</p>
                  {e.params && <p className="text-xs text-muted-foreground/80 font-mono mt-1">params: {e.params}</p>}
                </div>
              ))}
            </div>
          </HackerCard>
        </div>
      </div>
    </>
  )
}
