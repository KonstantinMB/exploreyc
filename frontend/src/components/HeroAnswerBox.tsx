import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ArrowRight, CornerDownLeft, Loader2, TrendingUp } from 'lucide-react'
import { apiClient, type HeroAnswer } from '../lib/api'

const EXAMPLES = [
  'AI code review for developers',
  'Vertical SaaS for dentists',
  'Fintech for freelancers',
  'AI agents for customer support',
]

const METER: Record<
  HeroAnswer['meter'],
  { label: string; text: string; ring: string; glow: string; dot: string }
> = {
  open: {
    label: 'OPEN FIELD',
    text: 'text-emerald-500',
    ring: 'border-emerald-500/40',
    glow: 'shadow-[0_0_18px_-2px_rgba(16,185,129,0.5)]',
    dot: 'bg-emerald-500',
  },
  emerging: {
    label: 'EMERGING',
    text: 'text-[#FB651E]',
    ring: 'border-[#FB651E]/40',
    glow: 'shadow-[0_0_18px_-2px_rgba(251,101,30,0.5)]',
    dot: 'bg-[#FB651E]',
  },
  competitive: {
    label: 'COMPETITIVE',
    text: 'text-amber-500',
    ring: 'border-amber-500/40',
    glow: 'shadow-[0_0_18px_-2px_rgba(245,158,11,0.5)]',
    dot: 'bg-amber-500',
  },
  crowded: {
    label: 'CROWDED',
    text: 'text-red-500',
    ring: 'border-red-500/40',
    glow: 'shadow-[0_0_18px_-2px_rgba(239,68,68,0.5)]',
    dot: 'bg-red-500',
  },
}

/** Typewriter that cycles the example prompts as the placeholder. */
function useTypewriter(words: string[]) {
  const [text, setText] = useState('')
  useEffect(() => {
    let mounted = true
    let wordIdx = 0
    let charIdx = 0
    let deleting = false
    let timer: ReturnType<typeof setTimeout>

    const tick = () => {
      if (!mounted) return
      const word = words[wordIdx]
      if (!deleting) {
        charIdx++
        setText(word.slice(0, charIdx))
        if (charIdx === word.length) {
          deleting = true
          timer = setTimeout(tick, 1900)
          return
        }
        timer = setTimeout(tick, 45)
      } else {
        charIdx--
        setText(word.slice(0, charIdx))
        if (charIdx === 0) {
          deleting = false
          wordIdx = (wordIdx + 1) % words.length
          timer = setTimeout(tick, 350)
          return
        }
        timer = setTimeout(tick, 22)
      }
    }
    timer = setTimeout(tick, 700)
    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [words])
  return text
}

export function HeroAnswerBox() {
  const [idea, setIdea] = useState('')
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState<HeroAnswer | null>(null)
  const [submittedIdea, setSubmittedIdea] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const typed = useTypewriter(EXAMPLES)

  async function ask(q: string) {
    if (q.trim().length < 10) {
      setError('Add a little more detail — a sentence or two works best.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.heroAnswer(q)
      setAnswer(res.data)
      setSubmittedIdea(q.trim())
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err?.response?.data?.detail ?? 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const meter = answer ? METER[answer.meter] : null

  return (
    <div className="w-full max-w-2xl">
      <div className="relative">
        {/* Ambient glow that breathes and intensifies on focus */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-x-6 -inset-y-4 -z-10 rounded-[2rem] bg-[#FB651E]/25 blur-2xl"
          animate={{ opacity: focused ? 0.9 : [0.35, 0.55, 0.35] }}
          transition={
            focused
              ? { duration: 0.4 }
              : { duration: 5, repeat: Infinity, ease: 'easeInOut' }
          }
        />

        {/* The search bar */}
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className={`group flex items-center gap-2 rounded-2xl border bg-background/85 p-2 pl-4 backdrop-blur-md transition-all duration-300 ${
            focused
              ? 'border-[#FB651E]/70 shadow-[0_0_0_4px_rgba(251,101,30,0.10),0_20px_60px_-20px_rgba(251,101,30,0.55)]'
              : 'border-border shadow-[0_10px_40px_-24px_rgba(0,0,0,0.5)] hover:border-[#FB651E]/40'
          }`}
        >
          <span
            aria-hidden
            className="select-none self-center font-mono text-lg font-bold leading-none text-[#FB651E]"
          >
            &gt;_
          </span>

          <textarea
            ref={taRef}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                ask(idea)
              }
            }}
            rows={1}
            placeholder={typed ? `${typed}` : 'Describe your startup idea…'}
            className="min-h-[2.75rem] flex-1 resize-none bg-transparent py-3 font-mono text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70"
          />

          <button
            onClick={() => ask(idea)}
            disabled={loading}
            aria-label="Ask"
            className="group/btn inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[#FB651E] px-4 font-mono text-sm font-semibold text-white transition-all duration-200 hover:bg-[#E65C00] hover:shadow-[0_0_24px_-4px_rgba(251,101,30,0.8)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">Scanning</span>
              </>
            ) : (
              <>
                <span>Ask</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
              </>
            )}
          </button>
        </motion.div>

        {/* scanning beam while loading */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute -bottom-px left-4 right-4 h-px overflow-hidden"
            >
              <motion.div
                className="h-full w-1/3 bg-gradient-to-r from-transparent via-[#FB651E] to-transparent"
                animate={{ x: ['-100%', '400%'] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* hint + example chips */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
        className="mt-4 flex flex-wrap items-center justify-center gap-2"
      >
        <span className="mr-1 hidden items-center gap-1 font-mono text-[11px] text-muted-foreground/70 sm:inline-flex">
          <CornerDownLeft className="h-3 w-3" /> try
        </span>
        {EXAMPLES.map((ex) => (
          <motion.button
            key={ex}
            onClick={() => {
              setIdea(ex)
              ask(ex)
            }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="rounded-full border border-border/80 bg-background/50 px-3 py-1 font-mono text-xs text-muted-foreground backdrop-blur transition-colors hover:border-[#FB651E]/50 hover:text-foreground"
          >
            {ex}
          </motion.button>
        ))}
      </motion.div>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 text-center font-mono text-xs text-red-500"
        >
          {error}
        </motion.p>
      )}

      {/* answer card */}
      <AnimatePresence>
        {answer && meter && (
          <motion.div
            initial={{ opacity: 0, y: 12, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 8, height: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden text-left"
          >
            <div className="mt-5 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur-md shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)]">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider ${meter.text} ${meter.ring} ${meter.glow}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${meter.dot}`} />
                  {meter.label}
                </span>
                <span className="font-mono text-sm font-semibold text-foreground">
                  {answer.headline}
                </span>
                {answer.cached && (
                  <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground/60">
                    <TrendingUp className="h-3 w-3" /> instant
                  </span>
                )}
              </div>

              <p className="mt-3 font-mono text-sm leading-relaxed text-muted-foreground">
                {answer.prose || answer.summary}
              </p>

              {answer.closest.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground/60">
                    closest matches
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {answer.closest.map((c) => (
                      <Link
                        key={c.id}
                        to={`/company/${c.slug}`}
                        className="group/chip inline-flex items-center gap-1.5 rounded-lg border border-[#FB651E]/30 bg-[#FB651E]/5 px-2.5 py-1.5 font-mono text-xs text-foreground transition-all hover:border-[#FB651E]/60 hover:bg-[#FB651E]/10"
                      >
                        <span className="font-semibold">{c.name}</span>
                        <span className="rounded bg-[#FB651E]/15 px-1 text-[10px] font-bold text-[#FB651E]">
                          {Math.round(c.similarity * 100)}%
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <Link
                to={`/idea?q=${encodeURIComponent(submittedIdea)}`}
                state={{ answer, idea: submittedIdea }}
                className="mt-4 inline-flex items-center gap-1 font-mono text-xs font-semibold text-[#FB651E] transition-colors hover:text-[#E65C00]"
              >
                Full breakdown, charts &amp; market map
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* subtle "powered by" line — reinforces the agentic angle */}
      {!answer && !loading && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-4 flex items-center justify-center gap-1.5 font-mono text-[11px] text-muted-foreground/60"
        >
          <Sparkles className="h-3 w-3 text-[#FB651E]" />
          instant semantic search across the YC &amp; a16z portfolio
        </motion.p>
      )}
    </div>
  )
}
