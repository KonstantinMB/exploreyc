// /world/claimed — post-checkout landing. Polls /api/world/claimed every 2s
// (no auth; keyed by the Stripe session id) until the webhook lands the plot.
//
// THIS PAGE IS THE ONE UNAMBIGUOUSLY GOOD MOMENT IN THE PRODUCT, and it used to
// be a grey card that said "Your plot is live" in 14px muted type. Planting is
// the whole game; the screen that confirms it should read like winning a round,
// not like a receipt. So once the webhook lands it now shows: a pop-and-ring
// celebration, the stake as a score, where that stake actually ranks (country
// and world, from the plot payload's own rank fields — never a guess), and the
// two things anyone wants next, which are looking at the thing and showing
// someone else.
//
// Every bit of the celebration is decoration over content that is already
// complete: under prefers-reduced-motion the confetti and the ring are not
// rendered at all and the card is exactly as informative.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { useReducedMotion } from 'framer-motion'
import { ChevronRight, Share2, Sprout } from 'lucide-react'
import worldApi from '../../lib/worldApi'
import { takePendingLogo } from '../../components/world/claim/logoStash'
import {
  Rank,
  WorldButton,
  WorldCard,
  WorldHeading,
  WorldLogo,
  worldButtonClass,
} from '../../components/world/ui'
import WorldChrome from '../../components/world/WorldChrome'
import CountUp from '../../components/world/boards/CountUp'
import { formatDollars } from '../../components/world/constants'

const SLOW_AFTER_MS = 60_000

/**
 * A short, one-shot burst.
 *
 * Fourteen pieces, fixed directions rather than random ones so the burst looks
 * the same every time it is earned (and so this never re-renders differently
 * under React 19's double-invoked effects). Purely decorative: aria-hidden,
 * pointer-events none, and the caller does not render it at all when the
 * visitor has asked for reduced motion.
 */
const CONFETTI = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2 + 0.4
  const reach = 74 + (i % 4) * 22
  return {
    x: `${Math.round(Math.cos(angle) * reach)}px`,
    // Biased upward: confetti thrown at a party goes up before it goes down.
    y: `${Math.round(Math.sin(angle) * reach - 26)}px`,
    rotate: `${(i % 2 ? 1 : -1) * (160 + i * 23)}deg`,
    colour: ['var(--w-accent)', 'var(--w-gold)', 'var(--w-silver)', 'var(--w-bronze)'][i % 4],
    delay: `${(i % 5) * 26}ms`,
  }
})

function Confetti() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className="world-confetti"
          style={
            {
              backgroundColor: c.colour,
              animationDelay: c.delay,
              '--_cx': c.x,
              '--_cy': c.y,
              '--_cr': c.rotate,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  )
}

/** Centred shell so every state of this page sits on the same card. */
function ClaimedShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="world-root min-h-screen">
      <WorldChrome />
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
        <WorldCard className="w-full max-w-md p-6">{children}</WorldCard>
      </div>
    </div>
  )
}

export default function WorldClaimedPage() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [slow, setSlow] = useState(false)
  const reduced = useReducedMotion()

  const claimedQuery = useQuery({
    queryKey: ['world', 'claimed', sessionId],
    queryFn: () => worldApi.getClaimed(sessionId!).then((r) => r.data),
    enabled: !!sessionId,
    refetchInterval: (query) => (query.state.data?.status === 'done' ? false : 2_000),
  })
  const claimed = claimedQuery.data
  const done = claimed?.status === 'done' && claimed.plot_id != null
  const plotId = done ? String(claimed!.plot_id) : null

  /**
   * The plot itself, fetched once it exists.
   *
   * This is what turns "it worked" into a result: the payload carries the
   * stake, the name, the country and — only on this endpoint — `rank_world`
   * and `rank_country`. Those are the numbers that make a plant feel like a
   * move in a game rather than a completed transaction. If the fetch fails the
   * page degrades to the plain confirmation; it never invents a standing.
   */
  const plotQuery = useQuery({
    queryKey: ['world', 'plot', plotId],
    queryFn: () => worldApi.getPlot(plotId!).then((r) => r.data),
    enabled: !!plotId,
  })
  const plot = plotQuery.data

  useEffect(() => {
    if (done) return
    const t = setTimeout(() => setSlow(true), SLOW_AFTER_MS)
    return () => clearTimeout(t)
  }, [done])

  // A logo chosen in the claim wizard is stashed in sessionStorage (the
  // checkout API carries no logo field — the plot doesn't exist until the
  // webhook lands). Upload it once, best-effort, as soon as the plot is live.
  const [logoNote, setLogoNote] = useState<string | null>(null)
  const logoAttempted = useRef(false)
  useEffect(() => {
    if (!done || logoAttempted.current) return
    logoAttempted.current = true
    const pending = takePendingLogo()
    if (!pending) return
    worldApi.uploadPlotLogo(String(claimed!.plot_id), pending).catch(() => {
      setLogoNote(
        'Your logo could not be attached automatically — you can add it from your plot page.'
      )
    })
  }, [done, claimed])

  // ---- share ---------------------------------------------------------------
  const shareUrl = useMemo(
    () => (plotId ? `${window.location.origin}/world/p/${plotId}` : ''),
    [plotId]
  )
  const [shareNote, setShareNote] = useState<string | null>(null)

  const share = async () => {
    setShareNote(null)
    // Nothing in this text claims a prize, a payout or a return — it says where
    // the plot is and what is staked on it, which is all that is true.
    const payload = {
      title: plot ? `${plot.name} on ExploreYC World` : 'My plot on ExploreYC World',
      text: plot
        ? `${plot.name} is planted in ${plot.country_name} with ${formatDollars(plot.total_cents)} staked.`
        : 'I just planted a plot on the ExploreYC World globe.',
      url: shareUrl,
    }
    if (navigator.share) {
      try {
        await navigator.share(payload)
        return
      } catch {
        // Cancelled or unsupported for this payload — fall through to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareNote('Link copied.')
    } catch {
      setShareNote(shareUrl)
    }
  }

  // ---- states --------------------------------------------------------------

  if (!sessionId) {
    return (
      <ClaimedShell>
        <Helmet>
          <title>Confirming your plot — ExploreYC World</title>
        </Helmet>
        <div role="alert">
          <WorldHeading level={3} className="mb-2">
            Missing session id
          </WorldHeading>
          <p className="mb-5 text-[0.875rem] text-[var(--w-muted)]">
            This page confirms a checkout and needs the{' '}
            <span className="world-tokens world-num">session_id</span> Stripe sends back. If you
            just paid, use the link Stripe redirected you to.
          </p>
          <Link to="/world" className={worldButtonClass('secondary', 'md')}>
            Back to the globe
          </Link>
        </div>
      </ClaimedShell>
    )
  }

  if (done) {
    return (
      <ClaimedShell>
        <Helmet>
          <title>
            {plot ? `${plot.name} is planted — ExploreYC World` : 'Planted — ExploreYC World'}
          </title>
        </Helmet>
        <div role="status" className="text-center">
          {/* The medal-sized mark, popped in with a shockwave ring. The plot's
              own logo when it has one, its initial when it doesn't, and a
              sprout while the plot payload is still on its way — so the burst
              never waits on a second request to happen. */}
          <div className="relative mx-auto mb-5 grid h-20 w-20 place-items-center">
            {!reduced && <Confetti />}
            {!reduced && <span className="world-ring" />}
            <span
              className={`relative grid h-20 w-20 place-items-center rounded-full border border-[var(--w-gold-edge)] bg-[var(--w-gold)] text-[var(--w-medal-ink)] shadow-[0_3px_0_var(--w-gold-edge)] ${
                reduced ? '' : 'world-pop'
              }`}
            >
              {plot ? (
                <WorldLogo
                  src={plot.logo_url ?? plot.company?.logo_url}
                  name={plot.name}
                  size={52}
                  className="rounded-full border-0 bg-transparent text-[var(--w-medal-ink)]"
                />
              ) : (
                <Sprout className="h-8 w-8" aria-hidden />
              )}
            </span>
          </div>

          <WorldHeading level={1} className="mb-1 justify-center text-center">
            {plot ? `${plot.name} is planted.` : 'Planted.'}
          </WorldHeading>
          <p className="text-[0.9375rem] text-[var(--w-muted)]">
            {plot
              ? `On the globe at ${plot.city_name ? `${plot.city_name}, ` : ''}${plot.country_name} — and every dollar of it counts for the country.`
              : 'Payment confirmed and the plot is planted. Every dollar you staked now counts for your country on the world boards.'}
          </p>

          {plot ? (
            <>
              {/* The score. Counts up from zero on arrival — the one place in
                  the product where a count-up is a flourish rather than a
                  live update, and it has earned it. */}
              <p className="mt-5">
                <CountUp
                  value={plot.total_cents}
                  format={formatDollars}
                  duration={900}
                  className="world-tokens world-money world-score world-score--xl text-[var(--w-accent-text)]"
                />
              </p>
              <p className="text-[0.8125rem] font-semibold text-[var(--w-muted)]">staked</p>

              {/* Where that lands. Both ranks come straight from the plot
                  payload; a null one (a plot still pending review has no
                  standing) simply isn't rendered rather than showing a zero. */}
              {plot.rank_country != null || plot.rank_world != null ? (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {plot.rank_country != null && (
                    <span className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--w-border)] px-2.5 py-1.5 text-[0.8125rem]">
                      <span className="text-[var(--w-muted)]">{plot.country_name}</span>
                      {plot.rank_country <= 3 ? (
                        <Rank n={plot.rank_country} />
                      ) : (
                        <span className="world-tokens world-num text-[0.9375rem] font-extrabold text-[var(--w-ink)]">
                          #{plot.rank_country}
                        </span>
                      )}
                    </span>
                  )}
                  {plot.rank_world != null && (
                    <span className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--w-border)] px-2.5 py-1.5 text-[0.8125rem]">
                      <span className="text-[var(--w-muted)]">World</span>
                      {plot.rank_world <= 3 ? (
                        <Rank n={plot.rank_world} />
                      ) : (
                        <span className="world-tokens world-num text-[0.9375rem] font-extrabold text-[var(--w-ink)]">
                          #{plot.rank_world}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              ) : null}
            </>
          ) : null}

          {logoNote && (
            <p role="status" className="mt-4 text-[0.875rem] text-[var(--w-muted)]">
              {logoNote}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-2">
            <Link
              to={`/world/p/${claimed!.plot_id}`}
              className={worldButtonClass('primary', 'lg', { block: true })}
            >
              See your plot
              <ChevronRight className="h-5 w-5" aria-hidden />
            </Link>
            {/* Stacked, not a two-up row. Side by side inside a 28rem card,
                "Show someone" wrapped onto two lines against a single-line
                neighbour — and the fix is not to shorten the words to fit a
                layout the screen does not need. Three full-width buttons read
                as an ordered list of what to do next, and they are the same
                shape on a phone. */}
            <WorldButton
              variant="secondary"
              block
              onClick={() => {
                void share()
              }}
            >
              <Share2 className="h-4 w-4" aria-hidden />
              Show someone
            </WorldButton>
            <Link
              to="/world"
              className={worldButtonClass('ghost', 'md', { block: true })}
            >
              Back to the globe
            </Link>
          </div>

          {shareNote && (
            <p role="status" className="mt-3 break-all text-[0.8125rem] text-[var(--w-muted)]">
              {shareNote}
            </p>
          )}

          {/* Unchanged, and it stays on the happiest screen in the product
              precisely because that is where it matters most. */}
          <p className="mt-4 text-[0.6875rem] text-[var(--w-muted)]">
            No prize, no payout, no refund.
          </p>
        </div>
      </ClaimedShell>
    )
  }

  if (claimedQuery.isError) {
    return (
      <ClaimedShell>
        <Helmet>
          <title>Confirming your plot — ExploreYC World</title>
        </Helmet>
        <div role="alert">
          <WorldHeading level={3} className="mb-2">
            Can&apos;t reach the confirmation service
          </WorldHeading>
          <p className="mb-5 text-[0.875rem] text-[var(--w-muted)]">
            Your payment is safe with Stripe — this page just can&apos;t check its status right
            now. It keeps retrying automatically; you can also come back later via &ldquo;my
            plots&rdquo;.
          </p>
          <Link to="/world" className={worldButtonClass('secondary', 'md')}>
            Back to the globe
          </Link>
        </div>
      </ClaimedShell>
    )
  }

  return (
    <ClaimedShell>
      <Helmet>
        <title>Confirming your plot — ExploreYC World</title>
      </Helmet>
      <div role="status">
        <WorldHeading level={3} className="mb-2">
          Planting…
        </WorldHeading>
        <p className="mb-2 text-[0.875rem] text-[var(--w-muted)]">
          Payment received by Stripe. We&apos;re waiting for the confirmation webhook to plant
          your plot — this usually takes a few seconds. This page checks every 2 seconds.
        </p>
        {slow && (
          <p className="text-[0.875rem] text-[var(--w-muted)]">
            Still confirming — webhooks can take a minute or two. Your payment is safe and this
            page keeps checking; the plot will also appear under your account once it lands.
          </p>
        )}
      </div>
    </ClaimedShell>
  )
}
