/**
 * "Live activity" — the corner of the globe that proves the thing is alive.
 *
 * Shape taken from the reference: a green dot, a heading, then rows of logo,
 * name, what happened and where, the amount, and how long ago. It is the
 * cheapest possible argument that other people are buying this, which is the
 * only argument that matters on a page selling a rank.
 *
 * TWO THINGS THE REFERENCE DOES THAT THIS DOES NOT, on purpose:
 *
 *   1. It labels every row "#1 in 🇨🇱 Chile". Our pulse feed does not say that.
 *      `GET /api/world/pulse` returns a type ('plant' | 'topup' | 'promotion'),
 *      a name, a country and an amount — it does NOT say the payment took the
 *      top spot, and most of them did not. So the rows say what actually
 *      happened: planted, topped up, promoted. Same shape, true sentence.
 *   2. It has a footer reading "4,460 visitors · 72h   6 watching". We do not
 *      count visitors and we do not track who is watching, so there is no
 *      honest number to put there and none is invented. The footer says how
 *      often the feed refreshes, which is a fact we do hold.
 */

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { cn } from '../../../lib/utils'
import worldApi, { type PulseEvent } from '../../../lib/worldApi'
import { InfoTip, Money, WorldCard, WorldLogo, WORLD_PANEL_SURFACE } from '../ui'
import { isoFlag, timeAgo } from '../boards/format'
import { nameFor } from '../country/names'

/** Same cadence the strip under the globe polls at. */
const PULSE_POLL_MS = 15_000

/**
 * What each event type did — in two grammars, because the country is optional.
 *
 * A global `featured` promotion has no country at all (see PulseEvent), and
 * "promoted in" followed by nothing is a broken sentence with a fallback globe
 * glyph where a flag should be. So a country-less row simply drops the
 * preposition and stands on its own verb.
 */
const VERB: Record<PulseEvent['type'], { in: string; alone: string }> = {
  plant: { in: 'planted in', alone: 'planted a plot' },
  topup: { in: 'topped up in', alone: 'topped up' },
  promotion: { in: 'promoted in', alone: 'promoted worldwide' },
}

/** Two letters, or nothing. Anything else is not a country we can name. */
function isoOf(value: string | null | undefined): string | null {
  const code = (value ?? '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) ? code : null
}

export interface ActivityPanelProps {
  /** How many rows to show. The reference shows five. */
  rows?: number
  /**
   * The panel's name — its heading AND its landmark label.
   *
   * It is a prop because /world renders this twice at `xl`: once on the glass
   * in the globe's corner and once further down the page. Two landmarks called
   * the same thing is a maze to anybody navigating by region, so the second one
   * is named for where it is rather than for what it is.
   */
  label?: string
  /** A country in the feed was clicked — the page opens its panel. */
  onSelectCountry?: (iso: string) => void
  className?: string
}

export function ActivityPanel({
  rows = 5,
  label = 'Live activity',
  onSelectCountry,
  className,
}: ActivityPanelProps) {
  const { data, isPending } = useQuery({
    queryKey: ['world', 'pulse'],
    queryFn: () => worldApi.getPulse().then((r) => r.data),
    refetchInterval: PULSE_POLL_MS,
  })

  // One clock for the whole list, ticking a third as often as the feed polls —
  // "20h ago" does not need per-second precision and a timer per row is waste.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20_000)
    return () => clearInterval(id)
  }, [])

  const events = data?.events?.slice(0, rows) ?? []

  return (
    <WorldCard
      as="section"
      aria-label={label}
      flat
      className={cn('flex flex-col overflow-hidden', WORLD_PANEL_SURFACE, className)}
    >
      <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full bg-[#FB651E] shadow-[0_0_0_3px_rgba(251,101,30,0.18)]"
        />
        <h2 className="font-mono text-xs font-bold">{label}</h2>
        <InfoTip label="What this feed shows" align="start" className="ml-auto">
          Every stake, top-up and promotion on the globe, newest first. It refreshes on its own
          every 15 seconds.
        </InfoTip>
      </div>

      {/* No aria-live: this list rewrites itself every 15 seconds and a polite
          region that re-reads five rows on a timer is unusable. The feed is
          static content a visitor can read at their own pace. */}
      {isPending ? (
        <p role="status" className="px-3.5 py-4 text-xs text-muted-foreground">
          Loading recent activity…
        </p>
      ) : events.length === 0 ? (
        // No prose lecture — the shape of a row, dimmed and labelled, so an
        // empty feed still shows what a busy one looks like.
        <div className="px-3.5 py-3.5">
          <p className="mb-2.5 text-xs leading-snug text-foreground">
            Nothing yet. The first stake shows up here.
          </p>
          <div
            aria-hidden="true"
            className="flex items-center gap-2.5 rounded-sm border border-dashed border-border px-2.5 py-2 opacity-70"
          >
            <span className="grid h-6 w-6 flex-none place-items-center rounded-sm border border-border bg-muted/50 font-mono text-[10px] font-bold text-muted-foreground">
              Y
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-xs font-semibold">
                yourstartup.com
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                Example
              </span>
            </span>
            <span className="world-num text-xs font-bold text-muted-foreground">$5</span>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col">
          {events.map((event, index) => {
            const iso = isoOf(event.country_iso)
            return (
            <li
              key={`${event.at}-${event.name}-${index}`}
              className="flex items-center gap-2.5 border-b border-border/50 px-3.5 py-2 last:border-b-0"
            >
              {/* The pulse feed ships no logo, so every row gets the same
                  letter tile rather than some rows being a pixel taller. */}
              <WorldLogo name={event.name} size={24} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs font-semibold text-foreground">
                  {event.name}
                </span>
                <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
                  {iso ? (
                    <>
                      <span className="shrink-0">{VERB[event.type].in}</span>
                      <span aria-hidden className="shrink-0 leading-none">
                        {isoFlag(iso)}
                      </span>
                      {onSelectCountry ? (
                        <button
                          type="button"
                          onClick={() => onSelectCountry(iso)}
                          className="world-focus min-w-0 cursor-pointer truncate rounded-sm text-left transition-colors hover:text-[#FB651E] motion-reduce:transition-none"
                        >
                          {nameFor(iso)}
                        </button>
                      ) : (
                        <span className="min-w-0 truncate">{nameFor(iso)}</span>
                      )}
                    </>
                  ) : (
                    // No country on this event, so no flag and no place name —
                    // the verb carries the row on its own.
                    <span className="min-w-0 truncate">{VERB[event.type].alone}</span>
                  )}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <Money cents={event.amount_cents} plus className="text-xs text-[#FB651E]" />
                <span className="world-num text-[10px] text-muted-foreground">
                  {timeAgo(event.at, now)} ago
                </span>
              </span>
            </li>
            )
          })}
        </ul>
      )}

      {/* The only footer figure we actually hold. Visitor and watcher counts
          are not measured anywhere in this product, so they are absent rather
          than approximated. */}
      <p className="border-t border-border px-3.5 py-1.5 font-mono text-[10px] text-muted-foreground">
        Refreshes every 15s
      </p>
    </WorldCard>
  )
}

export default ActivityPanel
