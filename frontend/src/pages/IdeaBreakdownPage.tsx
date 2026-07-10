import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, Search, TrendingUp, Users, Building2 } from 'lucide-react'
import { apiClient, type HeroAnswer, type SimilarCompany } from '../lib/api'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card'
import { IndustryBreakdownChart } from '../components/IndustryBreakdownChart'
import { BatchTimelineChart } from '../components/BatchTimelineChart'
import { ValidatorCompanyCard } from '../components/ValidatorCompanyCard'

const METER: Record<HeroAnswer['meter'], { label: string; text: string; ring: string; dot: string }> = {
  open: { label: 'OPEN FIELD', text: 'text-emerald-500', ring: 'border-emerald-500/40', dot: 'bg-emerald-500' },
  emerging: { label: 'EMERGING', text: 'text-[#FB651E]', ring: 'border-[#FB651E]/40', dot: 'bg-[#FB651E]' },
  competitive: { label: 'COMPETITIVE', text: 'text-amber-500', ring: 'border-amber-500/40', dot: 'bg-amber-500' },
  crowded: { label: 'CROWDED', text: 'text-red-500', ring: 'border-red-500/40', dot: 'bg-red-500' },
}

function Stat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card/40 px-4 py-3">
      <div className="text-[#FB651E]">{icon}</div>
      <div>
        <div className="font-mono text-lg font-bold leading-none text-foreground">{value}</div>
        <div className="mt-1 font-mono text-[11px] text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}

export function IdeaBreakdownPage() {
  const location = useLocation()
  const [params] = useSearchParams()
  const navState = location.state as { answer?: HeroAnswer; idea?: string } | null
  const q = (params.get('q') || navState?.idea || '').trim()

  const [answer, setAnswer] = useState<HeroAnswer | null>(navState?.answer ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch only if we don't already have an enriched answer in hand. On a cache
    // hit this costs no embedding — it just re-serves the stored result.
    const hasEnriched = !!answer && Array.isArray(answer.all_matches)
    if (hasEnriched || q.length < 3) return
    let cancelled = false
    setLoading(true)
    setError(null)
    apiClient
      .heroAnswer(q)
      .then((res) => {
        if (!cancelled) setAnswer(res.data)
      })
      .catch((e: unknown) => {
        const err = e as { response?: { data?: { detail?: string } } }
        if (!cancelled) setError(err?.response?.data?.detail ?? 'Could not load this breakdown.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const matches: SimilarCompany[] = answer?.all_matches ?? []
  const meter = answer ? METER[answer.meter] : null

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 font-mono text-sm text-muted-foreground transition-colors hover:text-[#FB651E]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to search
        </Link>

        {q && (
          <p className="mb-2 font-mono text-xs uppercase tracking-wide text-muted-foreground/60">
            <span className="text-[#FB651E]">&gt;</span> breakdown for
          </p>
        )}
        {q && <h1 className="mb-6 font-mono text-2xl font-bold leading-snug text-foreground">"{q}"</h1>}

        {loading && (
          <div className="flex items-center gap-3 py-16 font-mono text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-[#FB651E]" />
            Loading the full breakdown…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-border bg-card/40 p-8 text-center">
            <p className="font-mono text-sm text-red-500">{error}</p>
            <Link
              to="/"
              className="mt-4 inline-flex items-center gap-1 font-mono text-xs font-semibold text-[#FB651E] hover:underline"
            >
              <Search className="h-3.5 w-3.5" /> Try a new search
            </Link>
          </div>
        )}

        {!loading && !error && !answer && (
          <div className="rounded-xl border border-border bg-card/40 p-8 text-center">
            <p className="font-mono text-sm text-muted-foreground">
              Nothing to show yet — start from a search on the home page.
            </p>
            <Link
              to="/"
              className="mt-4 inline-flex items-center gap-1 font-mono text-xs font-semibold text-[#FB651E] hover:underline"
            >
              <Search className="h-3.5 w-3.5" /> Go to search
            </Link>
          </div>
        )}

        {!loading && answer && meter && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-8"
          >
            {/* Verdict */}
            <div className="rounded-2xl border border-border bg-card/50 p-6">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider ${meter.text} ${meter.ring}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${meter.dot}`} />
                  {meter.label}
                </span>
                <span className="font-mono text-base font-semibold text-foreground">{answer.headline}</span>
                {answer.cached && (
                  <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground/60">
                    <TrendingUp className="h-3 w-3" /> instant
                  </span>
                )}
              </div>
              <p className="mt-3 font-mono text-sm leading-relaxed text-muted-foreground">
                {answer.prose || answer.summary}
              </p>
            </div>

            {/* Market stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat icon={<Building2 className="h-4 w-4" />} value={String(answer.total_similar)} label="similar companies" />
              <Stat icon={<TrendingUp className="h-4 w-4" />} value={`${answer.market_size_percentage}%`} label="of YC portfolio" />
              <Stat icon={<TrendingUp className="h-4 w-4" />} value={`${Math.round(answer.recent_share * 100)}%`} label="from recent batches" />
              <Stat icon={<Users className="h-4 w-4" />} value={`${Math.round(answer.hiring_share * 100)}%`} label="actively hiring" />
            </div>

            {/* Charts */}
            {answer.total_similar > 0 && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {answer.industry_breakdown && Object.keys(answer.industry_breakdown).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Industry Breakdown</CardTitle>
                      <CardDescription>Similar companies by industry</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <IndustryBreakdownChart data={answer.industry_breakdown} />
                    </CardContent>
                  </Card>
                )}
                {answer.batch_timeline && answer.batch_timeline.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Batch Timeline</CardTitle>
                      <CardDescription>When similar companies were founded</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <BatchTimelineChart data={answer.batch_timeline} />
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Company grid */}
            {matches.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-mono text-lg font-semibold">Similar companies</h2>
                  <span className="font-mono text-sm text-muted-foreground">sorted by similarity</span>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {matches.map((company) => (
                    <ValidatorCompanyCard key={company.id} company={company} />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
