/**
 * "How many people will actually see my logo?" — answered with measurements.
 *
 * This is the one question a $5 plot is bought to answer, and until now the
 * product refused to answer it, on purpose: we did not track viewers, so
 * printing a viewer count would have been a lie. We track them now, so we can
 * say it — and the whole of this file exists to make sure what we say stays
 * true as the data changes underneath it.
 *
 * TWO NUMBERS, TWO SOURCES:
 *
 *   <AudienceReach>  — unique visitors and countries for exploreyc.com over the
 *     last 30 days, straight from Vercel Web Analytics via
 *     GET /api/world/audience. The backend caches the read; this never causes
 *     an outbound request to Vercel.
 *
 *   <WatchingNow>    — distinct anonymous sessions on a World surface in the
 *     last ~60 seconds, counted from our own presence heartbeats.
 *
 * THE THREE RULES EVERY CALL SITE INHERITS, encoded here rather than left to
 * discipline at four call sites:
 *
 *   1. **A figure we did not measure renders as nothing.** `visitors_30d` is
 *      null when the backend has no VERCEL_ANALYTICS_TOKEN, and
 *      <AudienceReach> returns null in that case. There is no fallback number,
 *      no "—", no "coming soon". The sentence simply is not on the page.
 *   2. **One is not a crowd.** `viewers_now === 1` is the launch-day reality
 *      and it is almost always the reader themselves, so it renders "Just you
 *      here right now" — true, and not a boast. Nothing is ever rounded up.
 *   3. **Provenance travels with the claim.** Every surface carries the same
 *      <InfoTip> naming the source, the window and when it was measured. A
 *      number nobody can check is a number nobody believes.
 *
 * PRESENCE IS ANONYMOUS. The heartbeat carries one opaque id generated in this
 * file, kept in sessionStorage, and thrown away with the tab. No cookie is set,
 * no personal data is collected, and the backend stores the id with a timestamp
 * and nothing else.
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, Users } from 'lucide-react'

import { cn } from '../../../lib/utils'
import worldApi, { type AudienceResponse } from '../../../lib/worldApi'
import { InfoTip, WORLD_OVERLAY_PILL } from '../ui'

/** Where the tab's presence id lives. Session, not local: it must not outlive the tab. */
const SESSION_KEY = 'exploreyc.world.presence'

/** Fallback beat cadence, in seconds, until the server states its own. */
const FALLBACK_BEAT_SECONDS = 20

/**
 * The tab's presence id, or null when we may not store one.
 *
 * Opaque and random — it identifies a TAB for about a minute, and nothing else.
 * Returning null (Safari private mode, storage disabled, an embed with a null
 * origin) is a supported outcome: the surface still reads the audience, it just
 * does not add itself to the count. Better to be missing from a live number
 * than to invent a session that cannot be de-duplicated.
 */
function presenceSessionId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const fresh =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2).padEnd(12, '0') +
          Date.now().toString(36)
    window.sessionStorage.setItem(SESSION_KEY, fresh)
    return fresh
  } catch {
    return null
  }
}

/**
 * One shared audience read for the whole app.
 *
 * Every surface uses the same query key, so React Query collapses them into one
 * request and one interval no matter how many of these components are mounted —
 * the homepage section, /world and the stake modal on top of it do not each
 * beat.
 *
 * The request IS the heartbeat when we have a session id (POST /api/world/beat
 * answers with the same body as the GET), so watching the globe is what puts
 * you in the count — there is no separate ping and no second round trip.
 *
 * `refetchInterval` pauses while the tab is in the background, which is the
 * behaviour we want and not a compromise: somebody who has switched away is not
 * watching, and within ~60s they correctly drop out of "watching now".
 */
export function useWorldAudience(enabled = true) {
  const sessionId = useMemo(presenceSessionId, [])

  return useQuery<AudienceResponse>({
    queryKey: ['world', 'audience'],
    queryFn: () =>
      (sessionId ? worldApi.beat(sessionId) : worldApi.getAudience()).then((r) => r.data),
    enabled,
    staleTime: 10_000,
    // Server-stated cadence, so the client's beat and the server's window can
    // never drift apart into a count that flickers.
    refetchInterval: (query) =>
      (query.state.data?.beat_seconds ?? FALLBACK_BEAT_SECONDS) * 1000,
  })
}

/* ────────────────────────────────────────────────────────────────────────────
   Formatting
   ──────────────────────────────────────────────────────────────────────────── */

function count(n: number): string {
  return n.toLocaleString('en-US')
}

/**
 * "95 countries", or "95+ countries" when the backend flagged the breakdown as
 * capped — in which case the count is a floor and saying it flat would be
 * claiming a total we do not have.
 */
function countriesLabel(data: AudienceResponse): string | null {
  if (data.countries_count == null || data.countries_count <= 0) return null
  return `${count(data.countries_count)}${data.countries_capped ? '+' : ''} countries`
}

/** "12 Sep 2026", or null if the backend sent nothing parseable. */
function measuredOn(at: string | null): string | null {
  if (!at) return null
  const when = new Date(at)
  if (Number.isNaN(when.getTime())) return null
  return when.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * The provenance note, identical on every surface that prints a figure.
 *
 * Says the source, the window and the date, and separates the two numbers —
 * because "2,329 in 30 days" and "3 watching now" are measured completely
 * differently and blurring them would be the easiest way to mislead here.
 */
export function AudienceInfoTip({
  data,
  align = 'start',
}: {
  data: AudienceResponse
  align?: 'start' | 'center' | 'end'
}) {
  const on = measuredOn(data.updated_at)
  return (
    <InfoTip label="Where these audience numbers come from" align={align}>
      Unique visitors and countries are Vercel Web Analytics for exploreyc.com
      over the last {data.window_days ?? 30} days
      {on ? `, measured ${on}` : ''}. “Watching now” is live presence — distinct
      anonymous sessions on a World page in the last {data.window_seconds}{' '}
      seconds. Nothing here is estimated.
    </InfoTip>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   Watching now
   ──────────────────────────────────────────────────────────────────────────── */

export interface WatchingNowProps {
  className?: string
  /** Render as a floating overlay pill (the globe stage) rather than bare text. */
  pill?: boolean
}

/**
 * "3 watching now", live.
 *
 * The dot is the ACCENT, not green. A live indicator is green by convention
 * everywhere else on the web, and it was tempting here — but this product has
 * exactly one hue, and spending a second one on a status dot is how a design
 * system starts leaking. Liveness is carried by the pulse and by the word
 * "now", both of which survive being read in monochrome, which green does not.
 *
 * At one viewer the pulse stops and the copy changes. That reading is almost
 * always the visitor themselves, and "1 watching now" over their own screen is
 * the exact moment a proof number turns into a joke.
 */
export function WatchingNow({ className, pill = false }: WatchingNowProps) {
  const { data } = useWorldAudience()
  if (!data) return null

  const n = data.viewers_now
  // Zero means our own heartbeat has not landed yet (or storage is blocked).
  // Saying "0 watching" over a page somebody is looking at is just wrong.
  if (n <= 0) return null

  const alone = n === 1

  return (
    <p
      className={cn(
        pill ? WORLD_OVERLAY_PILL : 'flex items-center gap-2',
        'font-mono text-[11px] leading-tight',
        className,
      )}
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        {alone ? null : (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FB651E] opacity-60 motion-reduce:hidden" />
        )}
        <span
          className={cn(
            'relative inline-flex h-2 w-2 rounded-full',
            alone ? 'bg-muted-foreground' : 'bg-[#FB651E]',
          )}
        />
      </span>
      {alone ? (
        <span className="text-muted-foreground">Just you here right now</span>
      ) : (
        <>
          <span className="world-num font-bold text-foreground">{count(n)}</span>
          <span className="-ml-1 text-muted-foreground">watching now</span>
        </>
      )}
    </p>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   Reach
   ──────────────────────────────────────────────────────────────────────────── */

export type ReachTone = 'fact' | 'pitch'

export interface AudienceReachProps {
  className?: string
  /** Render as a floating overlay pill (the globe stage) rather than bare text. */
  pill?: boolean
  /**
   * `fact` states the measurement. `pitch` says the same measurement as what
   * the buyer gets — same figures, same source, aimed at the decision.
   */
  tone?: ReachTone
  /** Where the InfoTip bubble hangs. `end` in a right-hand rail. */
  align?: 'start' | 'center' | 'end'
  /** Drop the ⓘ where a neighbouring element already carries one. */
  hideTip?: boolean
}

/**
 * "2,329 visitors in the last 30 days · from 95 countries".
 *
 * VISITORS, not founders. The measurement Vercel hands us is unique visitors to
 * exploreyc.com; how many of them are founders is not something we counted, and
 * the whole value of this line is that every word in it is checkable.
 *
 * Returns null — renders nothing at all — whenever `visitors_30d` is null. That
 * is the no-token path, and it is the reason this component exists as a
 * component rather than as four copies of a template string: there is exactly
 * one place that decides whether the claim may be made.
 */
export function AudienceReach({
  className,
  pill = false,
  tone = 'fact',
  align = 'start',
  hideTip = false,
}: AudienceReachProps) {
  const { data } = useWorldAudience()
  if (!data || data.visitors_30d == null) return null

  const visitors = count(data.visitors_30d)
  const countries = countriesLabel(data)
  const days = data.window_days ?? 30
  const Icon = tone === 'pitch' ? Eye : Users

  return (
    <p
      className={cn(
        // A PILL IS A FLEX ROW; A SENTENCE IS NOT. As a flex item the whole
        // sentence is one box, so at any width where it wraps the icon is
        // pushed onto a line of its own and reads as an orphan — the exact bug
        // <StakeModal> documents beside its own explainer line. Inline, both
        // marks trail the text the way a footnote does.
        pill ? WORLD_OVERLAY_PILL : 'text-muted-foreground',
        'font-mono text-[11px] leading-tight',
        className,
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          'h-3.5 w-3.5 shrink-0 text-[#FB651E]',
          pill ? '' : 'mr-1.5 inline align-[-2px]',
        )}
      />
      {tone === 'pitch' ? (
        <span className="text-muted-foreground">
          Your logo, in front of{' '}
          <span className="world-num font-bold text-foreground">{visitors} visitors</span>
          {countries ? (
            <>
              {' '}
              from <span className="world-num font-bold text-foreground">{countries}</span>
            </>
          ) : null}{' '}
          — the last {days} days on exploreyc.com.{' '}
        </span>
      ) : (
        <span className="text-muted-foreground">
          <span className="world-num font-bold text-foreground">{visitors}</span> visitors
          in the last {days} days
          {countries ? (
            <>
              <span aria-hidden className="mx-1.5">
                ·
              </span>
              from <span className="world-num font-bold text-foreground">{countries}</span>
            </>
          ) : null}{' '}
        </span>
      )}
      {hideTip ? null : <AudienceInfoTip data={data} align={align} />}
    </p>
  )
}

export default AudienceReach
