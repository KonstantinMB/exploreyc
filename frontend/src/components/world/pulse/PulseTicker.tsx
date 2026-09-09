import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Megaphone, Sprout, TrendingUp } from 'lucide-react'
import { cn } from '../../../lib/utils'
import worldApi, { type PulseEvent } from '../../../lib/worldApi'
import { formatDollars } from '../constants'
import { isoFlag, timeAgo } from '../boards/format'

const PULSE_POLL_MS = 15_000
const ROTATE_MS = 4_000

function usePulse() {
  return useQuery({
    queryKey: ['world', 'pulse'],
    queryFn: () => worldApi.getPulse().then((r) => r.data),
    refetchInterval: PULSE_POLL_MS,
  })
}

const VERB: Record<PulseEvent['type'], string> = {
  plant: 'planted in',
  topup: 'topped up in',
  promotion: 'promoted in',
}

function EventIcon({ type }: { type: PulseEvent['type'] }) {
  const cls = 'h-3.5 w-3.5 shrink-0 text-[#FB651E]'
  if (type === 'plant') return <Sprout aria-hidden className={cls} />
  if (type === 'topup') return <TrendingUp aria-hidden className={cls} />
  return <Megaphone aria-hidden className={cls} />
}

function EventLine({ event, now }: { event: PulseEvent; now: number }) {
  return (
    <span className="flex min-w-0 items-center gap-2 font-mono text-xs">
      <EventIcon type={event.type} />
      <span aria-hidden className="shrink-0 leading-none">{isoFlag(event.country_iso)}</span>
      <span className="min-w-0 truncate">
        <span className="font-semibold text-foreground">{event.name}</span>{' '}
        <span className="text-muted-foreground">
          {VERB[event.type]} {event.country_iso}
        </span>{' '}
        <span className="tabular-nums text-[#FB651E]">+{formatDollars(event.amount_cents)}</span>
      </span>
      <span className="shrink-0 tabular-nums text-muted-foreground">{timeAgo(event.at, now)}</span>
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
    <div
      className={cn(
        'overflow-hidden rounded-sm border border-border bg-card/90 px-3 py-2 backdrop-blur-sm dark:bg-black/70',
        className
      )}
      // Rotating content must not spam screen readers (no aria-live); the
      // static PulseList is the accessible surface for the full feed.
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${event.at}-${event.name}-${index}`}
          initial={reduced ? false : { y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduced ? undefined : { y: -12, opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <EventLine event={event} now={now} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/** Stacked pulse feed for drawers / country pages — readable and static. */
export function PulseList({ className, rows = 6 }: { className?: string; rows?: number }) {
  const { data, isLoading } = usePulse()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20_000)
    return () => clearInterval(id)
  }, [])

  if (isLoading) {
    return (
      <p role="status" className={cn('font-mono text-xs text-muted-foreground', className)}>
        $ loading pulse<span className="animate-pulse">…</span>
      </p>
    )
  }
  const events = data?.events?.slice(0, rows) ?? []
  if (events.length === 0) {
    return (
      <p className={cn('font-mono text-xs text-muted-foreground', className)}>
        Nothing planted yet. The first plot takes its country.
      </p>
    )
  }

  return (
    <ul className={cn('flex flex-col gap-1.5', className)}>
      {events.map((event, i) => (
        <li key={`${event.at}-${i}`} className="min-w-0">
          <EventLine event={event} now={now} />
        </li>
      ))}
    </ul>
  )
}

export default PulseTicker
