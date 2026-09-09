// /world/claimed — post-checkout landing. Polls /api/world/claimed every 2s
// (no auth; keyed by the Stripe session id) until the webhook lands the plot.
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Terminal } from 'lucide-react'
import worldApi from '../../lib/worldApi'
import { takePendingLogo } from '../../components/world/claim/logoStash'
import { Button } from '../../components/ui/button'
import { HackerCard } from '../../components/ui/hacker-card'
import { DotPattern } from '../../components/ui/dot-pattern'

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
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4 font-mono">
      <Helmet>
        <title>Confirming your plot — ExploreYC World</title>
      </Helmet>
      <DotPattern />

      <HackerCard className="w-full max-w-md p-6">
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Terminal className="h-4 w-4 text-[#FB651E]" aria-hidden />
          <span>$ exploreyc --world --claimed</span>
        </div>

        {!sessionId ? (
          <div role="alert">
            <p className="mb-2 text-sm font-bold">missing session id</p>
            <p className="mb-4 text-xs text-muted-foreground">
              This page confirms a checkout and needs the <code>session_id</code> Stripe sends
              back. If you just paid, use the link Stripe redirected you to.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/world">back to the globe</Link>
            </Button>
          </div>
        ) : done ? (
          <div role="status">
            <p className="mb-2 flex items-center gap-2 text-sm font-bold">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
              your plot is live
            </p>
            <p className="mb-4 text-xs text-muted-foreground">
              Payment confirmed and the plot is planted. Every dollar you staked now counts for
              your country on the world boards.
            </p>
            {logoNote && (
              <p role="status" className="mb-4 text-xs text-muted-foreground">
                {logoNote}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to={`/world/p/${claimed!.plot_id}`}>view your plot →</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/world">back to the globe</Link>
              </Button>
            </div>
          </div>
        ) : claimedQuery.isError ? (
          <div role="alert">
            <p className="mb-2 text-sm font-bold">can&apos;t reach the confirmation service</p>
            <p className="mb-4 text-xs text-muted-foreground">
              Your payment is safe with Stripe — this page just can&apos;t check its status right
              now. It keeps retrying automatically; you can also come back later via
              &ldquo;my plots&rdquo;.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/world">back to the globe</Link>
            </Button>
          </div>
        ) : (
          <div role="status">
            <p className="mb-2 text-sm font-bold">
              confirming your plot<span className="animate-pulse">…</span>
            </p>
            <p className="mb-2 text-xs text-muted-foreground">
              Payment received by Stripe. We&apos;re waiting for the confirmation webhook to plant
              your plot — this usually takes a few seconds. This page checks every 2 seconds.
            </p>
            {slow && (
              <p className="text-xs text-muted-foreground">
                Still confirming — webhooks can take a minute or two. Your payment is safe and
                this page keeps checking; the plot will also appear under your account once it
                lands.
              </p>
            )}
          </div>
        )}
      </HackerCard>
    </div>
  )
}
