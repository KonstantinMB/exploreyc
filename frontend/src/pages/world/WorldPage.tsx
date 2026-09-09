// /world — globe home. The map is the page; everything floats over it.
import { Suspense, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, LayoutList, Terminal } from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import worldApi from '../../lib/worldApi'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Button } from '../../components/ui/button'
import WorldBoards from '../../components/world/boards/WorldBoards'
import FeaturedRail from '../../components/world/featured/FeaturedRail'
import { PulseList, PulseTicker } from '../../components/world/pulse/PulseTicker'
import { LazyWorldGlobe } from './worldLazy'

function GlobeLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <p role="status" className="font-mono text-sm text-muted-foreground">
        $ exploreyc --world <span className="animate-pulse">loading globe…</span>
      </p>
    </div>
  )
}

export default function WorldPage() {
  const { darkMode } = useApp()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { data } = useQuery({
    queryKey: ['world', 'globe'],
    queryFn: () => worldApi.getGlobe().then((r) => r.data),
    refetchInterval: 60_000,
  })
  const plots = data?.plots ?? []

  return (
    <div className="fixed inset-0 overflow-hidden bg-background font-mono">
      <Helmet>
        <title>ExploreYC World — claim your startup&apos;s plot on the globe</title>
        <meta
          name="description"
          content="A live globe of startups. Claim a named plot at real coordinates, stake for your country, climb the world boards."
        />
      </Helmet>

      <Suspense fallback={<GlobeLoading />}>
        <LazyWorldGlobe
          plots={plots}
          darkMode={darkMode}
          onSelectPlot={(id) => navigate(`/world/p/${id}`)}
          onSelectCountry={(iso) => navigate(`/world/c/${iso}`)}
          className="absolute inset-0"
        />
      </Suspense>

      {/* Top bar: back control + command line + desktop claim CTA */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto rounded-sm border border-border bg-card/90 px-3 py-2 backdrop-blur-sm dark:bg-black/70">
          <Link
            to="/"
            className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            exploreyc
          </Link>
          <h1 className="flex items-center gap-2 text-sm font-bold">
            <Terminal className="h-4 w-4 text-[#FB651E]" aria-hidden />
            <span>
              <span className="text-[#FB651E]">$</span> exploreyc --world
            </span>
          </h1>
        </div>

        <div className="pointer-events-auto hidden flex-col items-end gap-1.5 lg:flex">
          <Button asChild>
            <Link to="/world/claim">claim your plot — from $5</Link>
          </Button>
          <p className="rounded-sm bg-background/70 px-1.5 text-[11px] text-muted-foreground backdrop-blur-sm">
            No prize, no payout, no refund.
          </p>
        </div>
      </header>

      {/* Desktop floating rail: boards + featured */}
      <aside
        aria-label="World boards and featured placements"
        className="absolute bottom-16 right-4 top-24 z-10 hidden w-[360px] lg:block"
      >
        <div className="flex max-h-full flex-col gap-3 overflow-y-auto pr-0.5">
          <WorldBoards />
          <FeaturedRail />
        </div>
      </aside>

      {/* Desktop pulse strip */}
      <div className="absolute bottom-4 left-4 z-10 hidden w-[440px] max-w-[calc(100vw-26rem)] lg:block">
        <PulseTicker />
      </div>

      {/* Mobile: pulse + fixed bottom CTA bar */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
        <PulseTicker />
        <div className="flex gap-2">
          <Button asChild className="flex-1">
            <Link to="/world/claim">claim your plot — $5+</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => setDrawerOpen(true)}
            className="bg-card/90 backdrop-blur-sm dark:bg-black/70"
          >
            <LayoutList className="mr-1.5 h-4 w-4" aria-hidden />
            boards
          </Button>
        </div>
        <p className="text-center text-[11px] text-muted-foreground">
          No prize, no payout, no refund.
        </p>
      </div>

      {/* Mobile bottom-sheet drawer: boards, featured rail, pulse feed */}
      <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[1001] bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none" />
          <DialogPrimitive.Content className="fixed inset-x-0 bottom-0 z-[1001] flex max-h-[82vh] flex-col gap-3 overflow-y-auto rounded-t-lg border-t border-border bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] font-mono focus:outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom motion-reduce:animate-none">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogPrimitive.Title className="font-mono text-sm font-bold">
                  <span className="text-[#FB651E]">$</span> exploreyc --world --boards
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="font-mono text-xs text-muted-foreground">
                  Live world boards, featured placements, and the pulse feed.
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close asChild>
                <Button variant="outline" size="sm">
                  close
                </Button>
              </DialogPrimitive.Close>
            </div>
            <WorldBoards />
            <FeaturedRail />
            <section aria-label="World pulse">
              <h3 className="mb-1.5 font-mono text-xs text-muted-foreground">recent activity</h3>
              <PulseList />
            </section>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  )
}
