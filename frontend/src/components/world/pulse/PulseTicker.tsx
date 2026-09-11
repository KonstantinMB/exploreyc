import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Megaphone, Sprout, TrendingUp } from 'lucide-react'
import { cn } from '../../../lib/utils'
import worldApi, { type PulseEvent } from '../../../lib/worldApi'
import { Money, WorldCard } from '../ui'
import { isoFlag, timeAgo } from '../boards/format'
import { nameFor } from '../country/names'

const PULSE_POLL_MS = 15_000
const ROTATE_MS = 4_000

function usePulse() {
  return useQuery({
    queryKey: ['world', 'pulse'],
    queryFn: () => worldApi.getPulse().then((r) => r.data),
    refetchInterval: PULSE_POLL_MS,
  })
}

/**
 * Two grammars per verb, because `country_iso` is nullable: a global featured
 * promotion belongs to no country, and "promoted in" trailing off into a
 * fallback globe glyph is a broken sentence. Same table, same reasoning, as
 * activity/ActivityPanel.tsx.
 */
const VERB: Record<PulseEvent['type'], { in: string; alone: string }> = {
  plant: { in: 'planted in', alone: 'planted a plot' },
  topup: { in: 'topped up in', alone: 'topped up' },
  promotion: { in: 'promoted in', alone: 'promoted worldwide' },
}

/** Tinted disc behind the event glyph so the icon reads as a badge, not a bullet. */
function EventIcon({ type }: { type: PulseEvent['type'] }) {
  const Icon = type === 'plant' ? Sprout : type === 'topup' ? TrendingUp : Megaphone
  return (
    <span
      aria-hidden
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#FB651E]/[0.05] text-[#FB651E]"
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  )
}

function EventLine({ event, now }: { event: PulseEvent; now: number }) {
  const code = (event.country_iso ?? '').trim().toUpperCase()
  const iso = /^[A-Z]{2}$/.test(code) ? code : null
  return (
    <span className="flex min-w-0 items-center gap-2.5 text-xs">
      <EventIcon type={event.type} />
      {/* No country, no flag — rather than the fallback globe glyph, which
          reads as a real place nobody can name. */}
      {iso ? (
        <span aria-hidden className="shrink-0 text-base leading-none">
          {isoFlag(iso)}
        </span>
      ) : null}
      {/* The amount sits OUTSIDE the truncating span. Inside it, a long name
          ate the figure — "TerminalStack promoted in US +…" — and the figure is
          the one part of this line that has to stay honest and readable. Now
          the name gives way instead. */}
      <span className="min-w-0 flex-1 truncate">
        <span className="font-semibold text-foreground">{event.name}</span>{' '}
        <span className="text-muted-foreground">
          {/* The country's NAME, not its code. "promoted in US" is a database
              value; "promoted in United States of America" is a sentence. */}
          {iso ? `${VERB[event.type].in} ${nameFor(iso)}` : VERB[event.type].alone}
        </span>
      </span>
      <Money
        cents={event.amount_cents}
        plus
        className="shrink-0 text-[#FB651E]"
      />
      <span className="world-num shrink-0 text-muted-foreground">
        {timeAgo(event.at, now)}
      </span>
    </span>
  )
}

/**
 * Single-line world-pulse strip for the globe overlay. Rotates through recent
 * events; with prefers-reduced-motion it holds still on the most recent one.
 */
export function PulseTicker({ className }: { className?: string }) {
  const reduced = useReducedMotion()
  const { data } = usePulse()
  const events = data?.events ?? []
  const [index, setIndex] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (reduced || events.length < 2) return
    const id = setInterval(() => setIndex((i) => (i + 1) % events.length), ROTATE_MS)
    return () => clearInterval(id)
  }, [reduced, events.length])

  if (events.length === 0) return null
  const event = events[Math.min(index, events.length - 1)]

  return (
    <WorldCard
      className={cn('overflow-hidden px-3 py-2', className)}
      // Rotating content must not spam screen readers (no aria-live). The
      // accessible surface for this feed is <ActivityPanel>, which renders the
      // same events as a static list and is on /world unconditionally.
    >
      {/* Both the outgoing and the incoming event occupy the SAME grid cell, so
          they cross over each other. This used to be `mode="wait"` in block
          flow, which had two visible faults: the strip went completely blank
          for the half-second between the exit finishing and the entry starting
          (caught in a screenshot — an empty card floating over the globe), and
          while the exiting line was still in flow it stacked a second card
          edge under the first on mobile. Stacking fixes both and keeps the
          card's height stable. */}
      <div className="grid grid-cols-1 grid-rows-1">
        <AnimatePresence initial={false}>
          <motion.div
            key={`${event.at}-${event.name}-${index}`}
            className="col-start-1 row-start-1 min-w-0"
            initial={reduced ? false : { y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduced ? undefined : { y: -10, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <EventLine event={event} now={now} />
          </motion.div>
        </AnimatePresence>
      </div>
    </WorldCard>
  )
}

export default PulseTicker
