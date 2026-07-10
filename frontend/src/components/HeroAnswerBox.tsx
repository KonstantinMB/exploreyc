import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ArrowRight } from 'lucide-react'
import { apiClient, type HeroAnswer } from '../lib/api'

const EXAMPLES = [
  'AI code review for developers',
  'Vertical SaaS for dentists',
  'Fintech for freelancers',
  'AI agents for customer support',
]

const METER: Record<HeroAnswer['meter'], { label: string; cls: string }> = {
  open: { label: 'OPEN FIELD', cls: 'text-emerald-500 border-emerald-500/40' },
  emerging: { label: 'EMERGING', cls: 'text-[#FB651E] border-[#FB651E]/40' },
  competitive: { label: 'COMPETITIVE', cls: 'text-amber-500 border-amber-500/40' },
  crowded: { label: 'CROWDED', cls: 'text-red-500 border-red-500/40' },
}

export function HeroAnswerBox() {
  const [idea, setIdea] = useState('')
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState<HeroAnswer | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function ask(q: string) {
    if (q.trim().length < 10) {
      setError('Add a little more detail.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      setAnswer((await apiClient.heroAnswer(q)).data)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err?.response?.data?.detail ?? 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl font-mono">
      <div className="flex items-stretch gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ask(idea)
            }}
            rows={2}
            placeholder="Describe your startup idea…  (⌘+Enter)"
            className="w-full resize-none rounded-md border border-border bg-background/70 pl-9 pr-3 py-3 text-sm outline-none focus:border-[#FB651E]/60"
          />
        </div>
        <button
          onClick={() => ask(idea)}
          disabled={loading}
          className="group inline-flex items-center gap-2 rounded-md bg-[#FB651E] px-4 text-sm text-white hover:bg-[#E65C00] disabled:opacity-60 transition-colors"
        >
          {loading ? (
            'Scanning…'
          ) : (
            <>
              Ask
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => {
              setIdea(ex)
              ask(ex)
            }}
            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-[#FB651E]/50 hover:text-foreground transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      <AnimatePresence>
        {answer && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 rounded-md border border-border bg-card/40 p-4"
          >
            <div className="flex items-center gap-3">
              <span
                className={`rounded border px-2 py-0.5 text-[11px] tracking-wider ${METER[answer.meter].cls}`}
              >
                {METER[answer.meter].label}
              </span>
              <span className="text-sm font-semibold">{answer.headline}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {answer.prose || answer.summary}
            </p>
            {answer.closest.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {answer.closest.map((c) => (
                  <Link
                    key={c.id}
                    to={`/company/${c.slug}`}
                    className="inline-flex items-center gap-1 rounded border border-[#FB651E]/30 bg-[#FB651E]/5 px-2 py-1 text-xs hover:border-[#FB651E]/60 transition-colors"
                  >
                    {c.name}{' '}
                    <span className="text-muted-foreground">
                      {Math.round(c.similarity * 100)}%
                    </span>
                  </Link>
                ))}
              </div>
            )}
            <Link
              to="/validator"
              className="mt-3 inline-flex items-center gap-1 text-xs text-[#FB651E] hover:underline"
            >
              Full breakdown <ArrowRight className="h-3 w-3" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
