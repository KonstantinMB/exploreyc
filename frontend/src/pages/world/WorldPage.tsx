// /world — globe home. The map is the page; everything floats over it.
import { Suspense, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ChevronRight, Trophy } from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import worldApi, { type GlobePin } from '../../lib/worldApi'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  WorldButton,
  WorldCard,
  WorldHeading,
  worldButtonClass,
  WORLD_FOCUS_CLASS,
} from '../../components/world/ui'
import SeedCompanyDialog from '../../components/world/SeedCompanyDialog'
import WorldBoards from '../../components/world/boards/WorldBoards'
import FeaturedRail from '../../components/world/featured/FeaturedRail'
import { PulseList, PulseTicker } from '../../components/world/pulse/PulseTicker'
import { Logo } from '../../components/ui/Logo'
import { LazyWorldGlobe } from './worldLazy'

/** The one line of legal honesty that has to survive every layout. */
function NoPrizeNote({ className }: { className?: string }) {
  return (
    <p className={className ?? 'text-[0.6875rem] leading-tight text-[var(--w-muted)]'}>
      No prize, no payout, no refund.
    </p>
  )
}

function GlobeLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <p role="status" className="text-sm text-[var(--w-muted)]">
        Loading the globe…
      </p>
    </div>
  )
}

export default function WorldPage() {
  const { darkMode } = useApp()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)
  /**
   * The unclaimed pin somebody clicked. Every pale dot on this globe is a real
   * ExploreYC company, and a click on one used to fall through to its country
   * page — so the company behind the dot, and its profile two clicks away at
   * /company/<slug>, were both invisible. See SeedCompanyDialog.
   */
  const [seedPin, setSeedPin] = useState<GlobePin | null>(null)

  const { data } = useQuery({
    queryKey: ['world', 'globe'],
    queryFn: () => worldApi.getGlobe().then((r) => r.data),
    refetchInterval: 60_000,
  })
  const plots = data?.plots ?? []

  return (
    <div className="world-root fixed inset-0 overflow-hidden">
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
          onSelectSeed={setSeedPin}
          onSelectCountry={(iso) => navigate(`/world/c/${iso}`)}
          className="absolute inset-0"
        />
      </Suspense>

      {/* Top bar: back control + title card + desktop claim CTA */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3 sm:p-4">
        {/* The brand lockup, as a floating card rather than a bar. This page
            gets no nav — the map is the page — but it still has to say whose
            product it is, and the mark is the app's real <Logo>, the same one
            on every other ExploreYC page, not a World-only redraw. */}
        <WorldCard className="pointer-events-auto flex items-center gap-3 px-3.5 py-2.5">
          <Logo size={34} />
          <div className="min-w-0">
            <Link
              to="/"
              className={`${WORLD_FOCUS_CLASS} mb-0.5 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-[var(--w-muted)] transition-colors hover:text-[var(--w-accent-text)]`}
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              ExploreYC
            </Link>
            <WorldHeading level={1} className="text-[1.375rem] sm:text-2xl">
              World
            </WorldHeading>
          </div>
        </WorldCard>

        <div className="pointer-events-auto hidden flex-col items-end gap-1.5 lg:flex">
          <Link to="/world/claim" className={worldButtonClass('primary', 'lg')}>
            Claim your plot — from $5
            <ChevronRight className="h-5 w-5" aria-hidden />
          </Link>
          <WorldCard className="px-2 py-1" flat>
            <NoPrizeNote />
          </WorldCard>
        </div>
      </header>

      {/* Desktop floating rail: boards + featured */}
      <aside
        aria-label="World boards and featured placements"
        // 400px, not 368px. The board row spends its width on a rank, a move
        // arrow, a flag, a money column and a chevron before the country name
        // gets any, and at 368px the name column came to ~129px — enough to
        // ship "United States o…" as row 1. The extra 32px goes entirely to
        // the name, and the globe behind it loses nothing a visitor aims at.
        className="absolute bottom-16 right-4 top-28 z-10 hidden w-[400px] lg:block"
      >
        <div className="flex max-h-full flex-col gap-3 overflow-y-auto px-1 pb-1">
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
          {/* "Claim a plot", not "Claim your plot". Measured at 375px: the row
              leaves ~225px for this button beside "Boards", and the longer
              label needs ~237px at the md size — so it wrapped onto two lines
              and the bar grew a row. The shorter label is the same words the
              board footer already uses, and it keeps the price on the button,
              which is the part worth protecting. */}
          <Link
            to="/world/claim"
            className={worldButtonClass('primary', 'md', { className: 'flex-1' })}
          >
            Claim a plot — $5+
          </Link>
          <WorldButton variant="secondary" onClick={() => setDrawerOpen(true)}>
            <Trophy className="h-4 w-4" aria-hidden />
            Boards
          </WorldButton>
        </div>
        <WorldCard className="px-2 py-1" flat>
          <NoPrizeNote className="text-center text-[0.6875rem] leading-tight text-[var(--w-muted)]" />
        </WorldCard>
      </div>

      {/* Mobile bottom-sheet drawer: boards, featured rail, pulse feed */}
      <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[1001] bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none" />
          {/*
            Header pinned, body scrolled — and the split is load-bearing rather
            than cosmetic.

            This was one `flex flex-col overflow-y-auto` box holding all four
            children. Under `max-h-[82vh]` a flex child shrinks before its
            parent overflows, so on any phone shorter than about 810px the
            boards table collapsed to a single row, the featured rail vanished
            entirely, and the pulse list ran off the bottom edge — with
            `scrollHeight === clientHeight`, so there was nothing to scroll
            back. Measured on a 360px-tall frame: content squashed to exactly
            the 294px cap.

            A block-flow scroll region cannot do that: its children keep their
            natural height, the region overflows, and it scrolls. Keeping the
            title and the close control out of that region also means the way
            out never scrolls off screen.

            `world-root` is on the Content itself, not inherited: Radix portals
            this to document.body, outside the page tree, so the tokens have to
            be re-established here or every child falls back to unstyled type.
          */}
          <DialogPrimitive.Content className="world-root fixed inset-x-0 bottom-0 z-[1001] flex max-h-[82vh] flex-col rounded-t-2xl border-t border-[var(--w-border)] focus:outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom motion-reduce:animate-none">
            <div className="flex shrink-0 items-start justify-between gap-3 p-4 pb-3">
              <div className="min-w-0">
                {/* Styled directly rather than via <WorldHeading asChild>:
                    Radix needs to put its generated id on this node to wire
                    aria-labelledby, and routing that through a Slot into a
                    wrapper component is a fragile way to earn the same type. */}
                <DialogPrimitive.Title className="world-tokens world-heading world-heading--3">
                  Boards
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-[0.8125rem] text-[var(--w-muted)]">
                  Who is winning, who paid to be seen, and what just happened.
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close asChild>
                <WorldButton variant="secondary" size="sm">
                  Close
                </WorldButton>
              </DialogPrimitive.Close>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <WorldBoards />
              <FeaturedRail />
              <WorldCard as="section" aria-label="Recent activity" className="px-4 pb-3 pt-4">
                <WorldHeading level={3} className="mb-1">
                  Just happened
                </WorldHeading>
                <PulseList />
              </WorldCard>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Clicking an unclaimed pin: who that company is, its ExploreYC profile,
          and the claim flow prefilled for it. */}
      <SeedCompanyDialog pin={seedPin} onClose={() => setSeedPin(null)} />
    </div>
  )
}
