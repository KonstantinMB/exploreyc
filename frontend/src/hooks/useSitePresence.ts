/**
 * Site-wide anonymous presence — the one heartbeat, and the one timer.
 *
 * "How many people are on exploreyc.com right now" is a number the product
 * sells with, so the way it is counted has to be boring and honest. Two hooks
 * split that job, and the split is the whole point of this file:
 *
 *   useSitePresence()  MOUNTED EXACTLY ONCE, in the app shell. It owns the
 *                      interval, and it is the only thing in the app allowed to
 *                      own one. Every page therefore contributes a beat — the
 *                      heartbeat used to live on World surfaces only, so a
 *                      site-wide counter built on it would have under-reported
 *                      every visitor reading the homepage, the database or a
 *                      company page.
 *
 *   useAudience()      READ-ONLY. Any number of components may call it; they
 *                      subscribe to the same React Query cache entry and never
 *                      start a timer of their own, so <WatchingNow>, two
 *                      <AudienceReach>s and <LiveTrafficBadge> on one page
 *                      still produce one request per interval, not four.
 *
 * WHY THE SPLIT AND NOT JUST ONE HOOK: React Query dedupes concurrent fetches
 * but `refetchInterval` is per-observer, so four observers of the same key that
 * mounted a few hundred milliseconds apart beat four times per period, out of
 * phase. Giving exactly one observer the interval is what makes "one beat every
 * 20 seconds per tab" a property of the code rather than a coincidence.
 *
 * (Even if a second beat did slip through it could not inflate the count: the
 * backend upserts on the session id, so a session is one row no matter how
 * often it beats. The count is distinct sessions, not requests.)
 *
 * PAUSED WHEN THE TAB IS HIDDEN. A backgrounded tab is not a viewer. We watch
 * `document.visibilityState` ourselves rather than leaning on React Query's
 * `refetchIntervalInBackground` default, because this is a truthfulness rule
 * and it should be visible in the file that makes the claim. Coming back to the
 * tab beats immediately, so you re-enter the count in one round trip instead of
 * waiting out the interval.
 *
 * ANONYMOUS. The beat carries one opaque random id, generated here, kept in
 * sessionStorage, thrown away with the tab. No cookie, no IP, no user agent —
 * the backend stores the id and a timestamp and nothing else.
 */

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import worldApi, { type AudienceResponse } from '../lib/worldApi'

/** Every audience reader and the beat share this key, so they share one cache entry. */
export const AUDIENCE_QUERY_KEY = ['world', 'audience'] as const

/** Where the tab's presence id lives. Session, not local: it must not outlive the tab. */
const SESSION_KEY = 'exploreyc.world.presence'

/** Fallback beat cadence, in seconds, until the server states its own. */
const FALLBACK_BEAT_SECONDS = 20

/**
 * How long a fetched audience payload is considered fresh.
 *
 * Deliberately under the beat interval: a reader that mounts mid-period should
 * show the count the last beat returned, not trigger a fetch of its own.
 */
const AUDIENCE_STALE_MS = 15_000

/**
 * The tab's presence id, or null when we may not store one.
 *
 * Opaque and random — it identifies a TAB for about a minute, and nothing else.
 * Returning null (Safari private mode, storage disabled, an embed with a null
 * origin) is a supported outcome: the surface still reads the audience, it just
 * does not add itself to the count. Better to be missing from a live number
 * than to invent a session that cannot be de-duplicated.
 */
export function presenceSessionId(): string | null {
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
 * The request IS the heartbeat: POST /api/world/beat answers with exactly the
 * body GET /api/world/audience returns, so being counted and reading the count
 * are one round trip. With no session id to send we fall back to the plain
 * read — present on the page, absent from the tally, which is the honest
 * outcome for a browser that will not give us storage.
 */
function fetchAudience(sessionId: string | null): Promise<AudienceResponse> {
  return (sessionId ? worldApi.beat(sessionId) : worldApi.getAudience()).then((r) => r.data)
}

/** True while the document is not hidden (and on any browser too old to say). */
function documentVisible(): boolean {
  if (typeof document === 'undefined') return true
  return document.visibilityState !== 'hidden'
}

/**
 * Read the shared audience payload. No timer, no request of its own.
 *
 * `data` is undefined until the site-wide beat lands — which every consumer
 * already has to handle, because the figures inside it can be null too.
 */
export function useAudience(enabled = true) {
  const sessionId = useMemo(() => presenceSessionId(), [])

  return useQuery<AudienceResponse>({
    queryKey: AUDIENCE_QUERY_KEY,
    // Same function as the beat's, so if this observer ever does fetch (the
    // cache is empty and nothing else has asked yet) the request still counts
    // the visitor instead of silently dropping them from the tally.
    queryFn: () => fetchAudience(sessionId),
    enabled,
    staleTime: AUDIENCE_STALE_MS,
    // THE TIMER LIVES IN useSitePresence, AND NOWHERE ELSE.
    refetchInterval: false,
    refetchOnMount: false,
    retry: false,
  })
}

/**
 * Beat once now and every `beat_seconds` while the tab is visible.
 *
 * Mount this EXACTLY ONCE, at the top of the app. Mounting it twice is a second
 * timer and a second set of requests (not a second viewer — see the upsert note
 * above), which is precisely what this hook exists to prevent.
 */
export function useSitePresence() {
  const sessionId = useMemo(() => presenceSessionId(), [])
  const [visible, setVisible] = useState(documentVisible)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const onChange = () => setVisible(documentVisible())
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])

  return useQuery<AudienceResponse>({
    queryKey: AUDIENCE_QUERY_KEY,
    queryFn: () => fetchAudience(sessionId),
    // Disabled while hidden: no interval, no in-flight request, and React Query
    // fetches again the moment it flips back to true because the cached row is
    // older than AUDIENCE_STALE_MS by then. Unmounting stops it for the same
    // reason — the observer, and its interval, go with the component.
    enabled: visible,
    staleTime: AUDIENCE_STALE_MS,
    // Server-stated cadence, so the client's beat and the server's presence
    // window can never drift apart into a count that flickers.
    refetchInterval: visible
      ? (query) => (query.state.data?.beat_seconds ?? FALLBACK_BEAT_SECONDS) * 1000
      : false,
    refetchIntervalInBackground: false,
    // A failed beat is a missed beat and nothing more; the next one is 20s
    // away. Retrying would only stack requests against a backend that is
    // already unhappy.
    retry: false,
  })
}
