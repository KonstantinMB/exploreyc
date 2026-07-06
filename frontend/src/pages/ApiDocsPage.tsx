import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Copy, Check, KeyRound, Gauge, ExternalLink, BookOpen } from 'lucide-react'
import { DotPattern } from '../components/ui/dot-pattern'
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

/** A terminal-window chrome wrapper. */
function Terminal({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`border border-border bg-[#0b0b0d] rounded-md overflow-hidden shadow-[0_0_0_1px_rgba(251,101,30,0.08),0_12px_40px_-12px_rgba(0,0,0,0.5)] ${className}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.03]">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-[11px] font-mono text-white/40 truncate">{title}</span>
      </div>
      <div className="p-4 font-mono text-sm text-white/90">{children}</div>
    </div>
  )
}

function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Terminal title={`${label} — bash`}>
      <div className="relative">
        <pre className="overflow-x-auto pr-10 text-[13px] leading-relaxed text-emerald-300/90"><code>{code}</code></pre>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
          className="absolute top-0 right-0 inline-flex items-center gap-1 text-xs text-white/50 hover:text-[#FB651E]"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </Terminal>
  )
}

export function ApiDocsPage() {
  const { user } = useDevAuth()

  const curl = `$ curl -H "Authorization: Bearer YOUR_API_KEY" \\\n    "${API_BASE}/companies?source=all&limit=20"`
  const js = `const res = await fetch(\n  "${API_BASE}/companies?source=all&limit=20",\n  { headers: { Authorization: "Bearer YOUR_API_KEY" } }\n);\nconst data = await res.json();`
  const py = `import requests\nr = requests.get(\n    "${API_BASE}/companies",\n    headers={"Authorization": "Bearer YOUR_API_KEY"},\n    params={"source": "all", "limit": 20},\n)\nprint(r.json())`

  return (
    <>
      <Helmet><title>API Docs | ExploreYC</title></Helmet>
      <div className="relative min-h-screen bg-background overflow-x-hidden">
        <DotPattern color="hsl(var(--primary) / 0.12)" size={26} radius={0.5} />
        <div className="container relative mx-auto px-4 py-10 max-w-4xl">

          {/* Hero terminal */}
          <Terminal title="guest@exploreyc: ~/api" className="mb-8">
            <div className="space-y-1.5">
              <p><span className="text-[#FB651E]">$</span> <span className="text-white/60">whoami</span></p>
              <p className="text-white/90">exploreyc — programmatic access to YC &amp; a16z portfolio companies</p>
              <p className="mt-3"><span className="text-[#FB651E]">$</span> <span className="text-white/60">cat api.md</span></p>
              <p className="text-white/70 leading-relaxed">
                Read-only REST API. Funding, stage, exits, founders, and more.
                Free tier = <span className="text-emerald-300">5 requests/day</span>. Bring your API key.
              </p>
              <p className="mt-3 flex items-center gap-1"><span className="text-[#FB651E]">$</span> <span className="text-emerald-300 animate-pulse">▋</span></p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to={user ? '/dashboard' : '/signup'}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#FB651E] hover:bg-[#E65C00] text-white text-sm font-semibold rounded-sm transition-colors"
              >
                <KeyRound className="h-4 w-4" /> {user ? 'Your keys' : 'Get an API key'}
              </Link>
              <a
                href={`${API_BASE}/docs`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 border border-white/15 text-white/80 hover:text-white hover:border-[#FB651E]/50 text-sm rounded-sm transition-colors"
              >
                <BookOpen className="h-4 w-4" /> Interactive docs <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </Terminal>

          {/* Auth */}
          <section className="mb-8">
            <h2 className="font-mono text-lg font-bold mb-3 flex items-center gap-2">
              <span className="text-[#FB651E]">#</span> Authentication
            </h2>
            <p className="text-sm text-muted-foreground font-mono mb-3">
              Send your key as a bearer token (or the <code className="text-[#FB651E]">X-API-Key</code> header).{' '}
              {user
                ? <>You're logged in — grab your key from the <Link to="/dashboard" className="text-[#FB651E] hover:underline">dashboard</Link>.</>
                : <><Link to="/signup" className="text-[#FB651E] hover:underline">Sign up</Link> to get one.</>}
            </p>
            <Terminal title="base url">
              <span className="text-emerald-300">{API_BASE}</span>
            </Terminal>
          </section>

          {/* Quick start */}
          <section className="mb-8">
            <h2 className="font-mono text-lg font-bold mb-3 flex items-center gap-2">
              <span className="text-[#FB651E]">#</span> Quick start
            </h2>
            <div className="space-y-3">
              <CodeBlock label="curl" code={curl} />
              <CodeBlock label="node" code={js} />
              <CodeBlock label="python" code={py} />
            </div>
          </section>

          {/* Rate limits */}
          <section className="mb-8">
            <h2 className="font-mono text-lg font-bold mb-3 flex items-center gap-2">
              <Gauge className="h-5 w-5 text-[#FB651E]" /> Rate limits
            </h2>
            <p className="text-sm text-muted-foreground font-mono mb-3">
              Per key, rolling 24h. Every response carries <code className="text-[#FB651E]">X-RateLimit-*</code>; a 429 adds <code className="text-[#FB651E]">Retry-After</code>.
            </p>
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full font-mono text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr><th className="px-3 py-2">Plan</th><th className="px-3 py-2">Limit</th><th className="px-3 py-2">Price</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {PLANS.map((p) => (
                    <tr key={p.name}>
                      <td className="px-3 py-2 font-medium">{p.name}</td>
                      <td className="px-3 py-2 text-[#FB651E]">{p.limit}</td>
                      <td className="px-3 py-2 text-muted-foreground">{p.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Endpoints */}
          <section>
            <h2 className="font-mono text-lg font-bold mb-3 flex items-center gap-2">
              <span className="text-[#FB651E]">#</span> Endpoints
            </h2>
            <div className="border border-border rounded-md divide-y divide-border">
              {ENDPOINTS.map((e) => (
                <div key={e.path} className="p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2 font-mono text-sm">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">{e.method}</span>
                    <code className="text-foreground">{e.path}</code>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{e.desc}</p>
                  {e.params && <p className="text-xs text-muted-foreground/70 font-mono mt-1">params: {e.params}</p>}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
