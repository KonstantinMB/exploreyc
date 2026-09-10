// /world/claimed — post-checkout landing. Polls /api/world/claimed every 2s
// (no auth; keyed by the Stripe session id) until the webhook lands the plot.
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, ChevronRight } from 'lucide-react'
import worldApi from '../../lib/worldApi'
import { takePendingLogo } from '../../components/world/claim/logoStash'
import { WorldCard, WorldHeading, worldButtonClass } from '../../components/world/ui'

const SLOW_AFTER_MS = 60_000

export default function WorldClaimedPage() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [slow, setSlow] = useState(false)

  const claimedQuery = useQuery({
    queryKey: ['world', 'claimed', sessionId],
    queryFn: () => worldApi.getClaimed(sessionId!).then((r) => r.data),
    enabled: !!sessionId,
    refetchInterval: (query) => (query.state.data?.status === 'done' ? false : 2_000),
  })
  const claimed = claimedQuery.data
  const done = claimed?.status === 'done' && claimed.plot_id != null

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

  return (
    <div className="world-root flex min-h-screen items-center justify-center p-4">
      <Helmet>
        <title>Confirming your plot — ExploreYC World</title>
      </Helmet>

      <WorldCard className="w-full max-w-md p-6">
        {!sessionId ? (
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
        ) : done ? (
          <div role="status">
            <WorldHeading level={3} className="mb-2">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-[var(--w-accent-text)]" aria-hidden />
                Your plot is live
              </span>
            </WorldHeading>
            <p className="mb-5 text-[0.875rem] text-[var(--w-muted)]">
              Payment confirmed and the plot is planted. Every dollar you staked now counts for
              your country on the world boards.
            </p>
            {logoNote && (
              <p role="status" className="mb-5 text-[0.875rem] text-[var(--w-muted)]">
                {logoNote}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/world/p/${claimed!.plot_id}`}
                className={worldButtonClass('primary', 'md')}
              >
                View your plot
                <ChevronRight className="h-[1.125rem] w-[1.125rem]" aria-hidden />
              </Link>
              <Link to="/world" className={worldButtonClass('secondary', 'md')}>
                Back to the globe
              </Link>
            </div>
          </div>
        ) : claimedQuery.isError ? (
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
        ) : (
          <div role="status">
            <WorldHeading level={3} className="mb-2">
              Confirming your plot…
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
        )}
      </WorldCard>
    </div>
  )
}
