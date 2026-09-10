/**
 * /world — the merged globe, and the shopfront around it.
 *
 * WHAT CHANGED, AND WHY. This used to be `fixed inset-0`: the map was the page,
 * it carried its own miniature chrome, and every other surface floated over the
 * globe in cards. Two things retired that. ExploreYC now has ONE globe — the
 * deck.gl explorer at /map folded into this one — so this route has to look
 * like part of the platform rather than a separate product, which means the
 * real <Navbar> above it and no bespoke lockup of its own. And the page's job
 * changed: it sells advertising space. A floating dashboard does not sell
 * anything, so the globe became the shopfront window and the things that make
 * the case — the plots people bought, the board they are competing on, the
 * price — became the page under it.
 *
 * THE LAYER MODEL is in components/world/filters/layers.ts and is the whole
 * point of the merge: paid plots always on and always loudest, ~5.5k imported
 * YC pins behind one small pill in the bottom-left corner that most visitors
 * will never press. See YC_LAYER_AUTO_THRESHOLD for the cold-start rule that
 * keeps the globe from looking abandoned while the paid layer is still filling.
 */

import { Suspense, useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import worldApi, { type GlobePin } from '../../lib/worldApi'
import { PageHeader } from '../../components/ui/PageHeader'
import { DotPattern } from '../../components/ui/dot-pattern'
import {
  WorldButton,
  WorldCard,
  WorldChip,
  WorldHeading,
  worldButtonClass,
} from '../../components/world/ui'
import SeedCompanyDialog from '../../components/world/SeedCompanyDialog'
import WorldBoards from '../../components/world/boards/WorldBoards'
import GlobePodium from '../../components/world/boards/GlobePodium'
import FeaturedRail from '../../components/world/featured/FeaturedRail'
import PaidShowcase from '../../components/world/featured/PaidShowcase'
import { PulseList, PulseTicker } from '../../components/world/pulse/PulseTicker'
import { WorldFilterPanel, useWorldLayers } from '../../components/world/filters'
import GlobeControls from '../../components/world/globe/GlobeControls'
// By path, never through `globe/index.ts`: that barrel exports the scene and
// would drag the 1 MB three.js chunk into this page's bundle. `tour` and the
// `hubs` it uses are deliberately three-free.
import { useHubTour, type GlobeFocusPoint } from '../../components/world/globe/tour'
import { formatDollars, MIN_STAKE_CENTS } from '../../components/world/constants'
import { LazyWorldGlobe } from './worldLazy'

/** Stable empty feed, so the layer memos don't churn on every render. */
const NO_PINS: GlobePin[] = []

/**
 * The globe's own band.
 *
 * `svh` rather than `vh`: on a phone the URL bar makes `vh` taller than the
 * screen actually is, which pushed the claim button under the fold on exactly
 * the devices least likely to scroll for it. The clamp keeps a slice of the
 * next section visible at every height — the page has to look like it
 * continues, because it does.
 */
const STAGE_HEIGHT = 'clamp(19rem, calc(100svh - 13rem), 42rem)'

/** The one line of legal honesty that has to survive every layout. */
function NoPrizeNote({ className }: { className?: string }) {
  return (
    <p className={className ?? 'text-[11px] leading-tight text-muted-foreground'}>
      No prize, no payout, no refund.
    </p>
  )
}

function GlobeLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <p role="status" className="text-sm text-muted-foreground">
        Loading the globe…
      </p>
    </div>
  )
}

/** Tabular integer, for the counts that sit beside each other in the legend. */
function Count({ n }: { n: number }) {
  return <span className="world-num">{n.toLocaleString('en-US')}</span>
}

export default function WorldPage() {
  const { darkMode } = useApp()
  const navigate = useNavigate()

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

  const pins = useMemo(() => data?.plots ?? NO_PINS, [data])
  const layers = useWorldLayers(pins)

  /**
   * Where the camera is being sent, and the only place anything writes it.
   *
   * The region rail, the hub tour and (on /world/claim) the city search all
   * produce a fresh focus object; the scene re-arms its flight from that
   * object's identity, so "one state, last writer wins" is the whole protocol.
   */
  const [focus, setFocus] = useState<GlobeFocusPoint | null>(null)
  const handleFocus = useCallback((next: GlobeFocusPoint) => setFocus(next), [])
  /*
   * The tour is fed the WHOLE feed, not `visiblePins`. Two reasons: the hubs it
   * flies to are a fact about where companies are, not about which filter is
   * open — and these are the pre-jitter coordinates, which is what computeHubs
   * requires to name a hub after the city it is actually over.
   */
  const tour = useHubTour(pins, { onJump: handleFocus })

  return (
    <div className="world-root relative min-h-screen overflow-x-hidden">
      <Helmet>
        <title>ExploreYC World — claim your startup&apos;s plot on the globe</title>
        <meta
          name="description"
          content="Advertising space on a live globe. Claim a named plot at real coordinates from $5, put your logo on it, and climb the world boards."
        />
      </Helmet>

      {/* The same dotted ground every ExploreYC page sits on. */}
      <DotPattern color="hsl(var(--primary) / 0.12)" size={24} radius={0.5} />

      {/* ── The one terminal eyebrow on this page ─────────────────────────
          House rule: a `$ command` belongs at the top of a ROUTE, once, via
          <PageHeader> — never on every panel. Everything below opens with a
          plain mono heading instead. */}
      <div className="container relative mx-auto px-4 pb-2 pt-8">
        <PageHeader
          command="$ exploreyc --world"
          title="World"
          subtitle="Advertising space on a live globe. Claim a named plot at real coordinates, put your logo on it, and climb the world boards."
          actions={
            <Link to="/world/claim" className={worldButtonClass('primary', 'md')}>
              Claim your plot
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          }
        />
      </div>

      {/* ── The window ───────────────────────────────────────────────────── */}
      <section
        aria-label="The globe"
        className="relative isolate overflow-hidden border-y border-border"
      >
        {/* `minHeight` is not decoration: if a browser ever fails to parse the
            `svh` clamp, `height` drops out entirely and an absolutely-positioned
            canvas inside a zero-height box is an invisible globe. The floor
            keeps a stage no matter what. */}
        <div className="relative w-full" style={{ height: STAGE_HEIGHT, minHeight: '19rem' }}>
          {/*
            THE STAGE IS A BAND; THE COMPOSITION INSIDE IT IS NOT.

            The border-y band still runs edge to edge, because that is how every
            other ExploreYC section marks itself off. What used to run edge to
            edge with it was the *content*: the globe centred in the raw
            viewport, the hero pinned to its left edge and the region rail to
            its right. Past about 1440px that stopped being a layout — at 2560
            the rail sat 24px from the browser edge, roughly 300px outside the
            column the navbar and every section below use, and the space
            between the headline and the globe was simply void.

            `container` is the platform's own shell — the exact class, and so
            the exact responsive max-widths, that <Navbar> and <PageHeader> sit
            in. Everything on the stage now lives inside it, so the page has one
            column from the nav to the footer and the composition stops growing
            at the width it was designed for.
          */}
          <div className="container relative mx-auto h-full px-0">
            {/*
              The canvas box. Full-bleed inside the column below `xl`, where the
              hero spans the width and the globe is its backdrop; from `xl` up it
              gives up its left 38% and the page becomes a real two-column
              layout — copy on the left, globe on the right, neither on top of
              the other. `xl` rather than `lg` because at 1024 the left third is
              only ~360px and the two hero buttons wrap onto separate rows in it;
              1280 is the first width where a real column fits.
            */}
            <div className="absolute inset-y-0 left-0 right-0 xl:left-[38%]">
              <Suspense fallback={<GlobeLoading />}>
                <LazyWorldGlobe
                  plots={layers.visiblePins}
                  darkMode={darkMode}
                  focus={focus}
                  // Touch the controls and the tour is over. An auto-flight that
                  // keeps yanking the camera back is worse than no tour at all.
                  onInteract={tour.stop}
                  onSelectPlot={(id) => navigate(`/world/p/${id}`)}
                  onSelectSeed={setSeedPin}
                  onSelectCountry={(iso) => navigate(`/world/c/${iso}`)}
                  className="absolute inset-0"
                />
              </Suspense>
            </div>

            {/*
              The scrim. The canvas is cleared to transparent, so the globe sits
              directly on the page ground and a gradient in that same ground
              colour reads as depth rather than as a panel laid over the map.
              Written as an inline gradient because Tailwind's opacity modifier
              cannot be applied to a CSS variable colour — `color-mix` can.

              Both stop at `xl`, and that is the point of the two-column split:
              a scrim exists to keep copy legible where it lies ON the globe, and
              from `xl` up it no longer does. Left running, the horizontal one
              would wash out the globe's own left limb for no reason.
            */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 sm:hidden"
              style={{
                /*
                  Stronger through the top half than it used to be (62% at 42%,
                  clear by 74%). On a 375px phone the stage is ~600px and the
                  pitch occupies the top 250 of it, which is exactly where the
                  country pills land — and a pill is a SOLID card with its own
                  border, so at 38% wash it still put a white box and a grey word
                  behind "No prize, no payout, no refund." A label a visitor
                  cannot read anyway is worth less than the one line of legal
                  copy on the page, so the top of the globe goes under the
                  ground and the sphere keeps its bottom two thirds.
                */
                backgroundImage:
                  'linear-gradient(to bottom, hsl(var(--background)) 0%, hsl(var(--background)) 42%, color-mix(in srgb, hsl(var(--background)) 78%, transparent) 55%, color-mix(in srgb, hsl(var(--background)) 30%, transparent) 70%, transparent 84%)',
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 hidden sm:block xl:hidden"
              style={{
                backgroundImage:
                  'linear-gradient(105deg, hsl(var(--background)) 0%, color-mix(in srgb, hsl(var(--background)) 70%, transparent) 34%, transparent 62%)',
              }}
            />

          {/* Everything on the glass. The wrapper is inert so a drag that
              starts on empty space still spins the globe; each island opts
              back in. */}
          {/* `px-4`, not `px-6`, from `sm` up: that is <Navbar>'s and
              <PageHeader>'s gutter inside the same `container`, so the chip,
              the headline and the region rail line up with the nav items above
              them to the pixel rather than to within eight of them. */}
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between gap-4 p-4 sm:py-6">
            {/* `flex-1` so this row owns the height the legend row does not
                want, and `xl:self-center` on the copy inside it so the pitch
                sits opposite the middle of the globe rather than stranded at
                the top of a 42rem band with a column of nothing under it. The
                controls stay pinned to the corner — `items-start` is still the
                row's default. */}
            <div className="flex flex-1 items-start justify-between gap-4">
            {/* `min-w-0` so this column can actually shrink: without it the
                headline's intrinsic width is the flex floor, and the controls
                beside it get squeezed past their own content — which is how a
                row of region chips ends up under the viewport edge. From `xl`
                the column is bounded to the left third, which is what makes the
                globe's half genuinely its own. */}
            <div className="pointer-events-auto min-w-0 max-w-xl xl:max-w-[36%] xl:self-center">
              <WorldChip tone="accent" className="mb-3">
                Advertising space on a live globe
              </WorldChip>
              {/* level 2, not 1: <PageHeader> above the stage owns the page's
                  only <h1>. This is the sales pitch, not the route's title. */}
              <WorldHeading level={2} className="mb-2 text-2xl sm:text-3xl">
                Put your startup on the map.
              </WorldHeading>
              {/* Dropped on a short viewport — a landscape phone gives the
                  stage about 300px, and the headline, the buttons and the
                  no-prize line all outrank a supporting sentence for that
                  space. Keyed on HEIGHT, because that is what is scarce. */}
              <p className="mb-5 max-w-lg text-sm leading-snug text-muted-foreground [@media(max-height:620px)]:hidden sm:text-base">
                Pick a coordinate anywhere on Earth, plant your logo on it, and hold it against
                anyone who wants it more.
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <Link to="/world/claim" className={worldButtonClass('primary', 'lg')}>
                  Claim your plot — from $5
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </Link>
                {/* A real anchor, not a scroll handler: it moves keyboard focus
                    to the board as well as the viewport. Desktop only — on a
                    phone the two `lg` pills wrap onto separate rows and eat a
                    third of the stage to offer a shortcut past one scroll. */}
                <a href="#board" className={worldButtonClass('secondary', 'lg', { className: 'hidden sm:inline-flex' })}>
                  See the board
                </a>
              </div>
              <NoPrizeNote className="mt-2.5 text-xs leading-tight text-muted-foreground" />
            </div>

            {/* The exploration tools the deck.gl map brought with it, in the
                corner opposite the headline. Desktop only: at 375px the rail
                would land on top of the hero, and the phone version of this
                page is a shopfront window, not a flight deck. */}
            <GlobeControls
              onFocus={handleFocus}
              tour={tour}
              className="pointer-events-auto hidden shrink-0 sm:flex"
            />
            </div>

            <div className="flex items-end justify-between gap-3">
              {/* BOTTOM LEFT, and collapsed. The imported layer gets one pill;
                  the paid layer gets the rest of the page. */}
              <div className="pointer-events-auto flex flex-col items-start gap-2">
                {/* The one dead end this page can reach: companies switched off
                    by hand before anybody has bought a plot, i.e. an empty
                    planet. Say so, and hand back the way out — a globe with
                    nothing on it must never look like a failure to load. */}
                {layers.visiblePins.length === 0 && !layers.companiesOn ? (
                  <WorldCard className="max-w-xs px-3 py-2.5">
                    <p className="mb-2 text-xs text-muted-foreground">
                      Nothing to draw: no plots claimed yet, and the imported companies are
                      switched off.
                    </p>
                    <WorldButton
                      variant="secondary"
                      size="sm"
                      onClick={() => layers.setCompaniesOn(true)}
                    >
                      Show companies
                    </WorldButton>
                  </WorldCard>
                ) : null}
                {/* What is actually on the globe, without opening anything.
                    The two dots differ in FILL as well as colour — solid for
                    the paid layer, a ring for the imported one — so the legend
                    survives being read in monochrome. */}
                <WorldCard flat className="hidden px-3 py-2 sm:block">
                  <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#FB651E]"
                    />
                    <Count n={layers.paidCount} /> paid plots
                  </p>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-muted-foreground"
                    />
                    {layers.companiesOn ? (
                      <>
                        <Count n={layers.matchedSeedCount} /> companies
                      </>
                    ) : (
                      <>Companies hidden</>
                    )}
                  </p>
                </WorldCard>
                <WorldFilterPanel layers={layers} />
              </div>

              {/* THE PODIUM, ON THE MAP. This corner used to carry the pulse
                  ticker; the ticker is a one-line footnote and the board is the
                  reason anyone comes back, so the board takes the prime corner
                  and the ticker moved to its own strip directly under the
                  stage. Desktop only — at 375px a three-up podium over a globe
                  is unreadable, and the full one is one scroll away. */}
              <GlobePodium className="pointer-events-auto hidden w-[22rem] max-w-[45%] lg:block" />
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* ── What just happened, as a strip under the map ───────────────────
          Renders nothing at all when there is no activity, so an empty product
          gets no empty strip. */}
      <div className="border-b border-border bg-card/40">
        <div className="container mx-auto px-4 py-2">
          <PulseTicker className="border-0 bg-transparent backdrop-blur-none hover:border-0 hover:shadow-none dark:border-0 dark:bg-transparent" />
        </div>
      </div>

      {/* ── The plots people bought ──────────────────────────────────────
          Fed the WHOLE feed, not `visiblePins`: a filter is a question about
          the imported layer, and it must never be able to empty the window of
          paid placements. */}
      <div className="container mx-auto px-4 py-10 sm:py-14">
        <PaidShowcase pins={pins} />
      </div>

      {/* ── The board, as the centrepiece it is ──────────────────────────── */}
      <section
        id="board"
        aria-label="World leaderboards"
        className="scroll-mt-24 border-y border-border bg-card"
      >
        <div className="mx-auto max-w-3xl px-4 py-10 text-center sm:py-14">
          <WorldHeading level={2} className="justify-center">
            Who is winning the world
          </WorldHeading>
          <p className="mx-auto mb-6 mt-2 max-w-xl text-sm text-muted-foreground">
            Countries rank by what is staked in them. Outstake the plot above you and the board
            moves — that is the entire game.
          </p>
          <div className="text-left">
            <WorldBoards feature />
          </div>
        </div>
      </section>

      {/* ── Paid placements + what just happened ───────────────────────────
          A flex row rather than a two-column grid, because <FeaturedRail>
          renders NOTHING when there are no active promotions — which is the
          state production is in. In a grid that leaves a conspicuous empty
          half; in a flex row the activity card simply takes the width. */}
      <div className="container mx-auto flex flex-col gap-4 px-4 py-10 sm:py-14 lg:flex-row lg:[&>*]:flex-1">
        <FeaturedRail />
        <WorldCard as="section" aria-label="Recent activity" className="px-4 pb-3 pt-4">
          <WorldHeading level={3} className="mb-1">
            Just happened
          </WorldHeading>
          <PulseList rows={8} />
        </WorldCard>
      </div>

      {/* ── The ask, one more time ───────────────────────────────────────── */}
      <section
        aria-label="Claim a plot"
        className="border-t border-border bg-[#FB651E]/[0.05]"
      >
        <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:py-16">
          <WorldHeading level={2} className="justify-center">
            Every coordinate is first come, first served.
          </WorldHeading>
          {/* The floor comes from MIN_STAKE_CENTS, not from a typed "$5": the
              number on this page and the number the server enforces are the
              same constant. Set in ink rather than orange — accent-as-text on
              this tinted band measures 4.31:1 in light, below AA. */}
          <p className="mx-auto mb-6 mt-2 max-w-lg text-base text-muted-foreground">
            <strong className="text-foreground">{formatDollars(MIN_STAKE_CENTS)}</strong> puts
            your logo on the globe. Anyone who wants your spot has to outstake you for it.
          </p>
          <Link to="/world/claim" className={worldButtonClass('primary', 'lg')}>
            Claim your plot — from $5
            <ChevronRight className="h-5 w-5" aria-hidden />
          </Link>
          <NoPrizeNote className="mt-3 text-xs text-muted-foreground" />
        </div>
      </section>

      {/* Clicking an unclaimed pin: who that company is, its ExploreYC profile,
          and the claim flow prefilled for it. */}
      <SeedCompanyDialog pin={seedPin} onClose={() => setSeedPin(null)} />
    </div>
  )
}
