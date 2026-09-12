/**
 * /world — the merged globe, and the shopfront around it.
 *
 * THE UNIT OF THIS PRODUCT IS THE COUNTRY:
 *
 *   click a country  ->  <CountryPanel>: who owns it, what #1 pays, one button
 *   press the button ->  <StakeModal>: one link, one amount, Stripe
 *
 * There is no coordinate-picking wizard any more, and no pulsing orange target
 * ring in front of it — both deleted. The coordinate still exists (`world_plots`
 * stores one and checkout resolves geography from it); it is DERIVED inside the
 * modal from the country's own cities and confirmed against the same server
 * geography (see components/world/stake/derivePoint.ts). The optional fields the
 * wizard used to demand up front — one line, link, logo, founder name, title,
 * founder link — are edited on the plot's own page, after the purchase, by
 * somebody who by then owns something.
 *
 * THE PAGE OWNS THE SELECTION. `selectedIso` lives here and nowhere else. The
 * globe reads it and highlights that country; the picker, the activity feed, the
 * stage board and a click on the sphere all write it through the same setter.
 * One state, one writer per gesture, no second source of truth.
 *
 * THE COMPETITION IS ON THE FIRST SCREEN. <StageBoard> sits in the stage's own
 * column, ranked and always rendered — see that file for why the podium it
 * replaced was invisible in practice. The full <WorldBoards> is still further
 * down under #board; this is the hook, that is the table.
 *
 * EVERY FLOATING ISLAND SHARES ONE SYSTEM. The pills and panels on the glass all
 * take WORLD_OVERLAY_PILL / WORLD_OVERLAY_SURFACE from components/world/ui.tsx —
 * one height, one padding, one radius, one skin — and the two corner stacks are
 * laid out against the overlay's own STAGE_GUTTER so their edges agree with each
 * other and with the country panel.
 *
 * THE LAYER MODEL is still in components/world/filters/layers.ts: paid plots
 * always on and always loudest, ~5.5k imported YC pins behind one small pill.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import worldApi, { type GlobePin } from '../../lib/worldApi'
import { PageHeader } from '../../components/ui/PageHeader'
import { DotPattern } from '../../components/ui/dot-pattern'
import {
  InfoTip,
  WorldButton,
  WorldCard,
  WorldChip,
  WorldHeading,
  worldButtonClass,
  WORLD_OVERLAY_PILL,
} from '../../components/world/ui'
import SeedCompanyDialog from '../../components/world/SeedCompanyDialog'
import WorldBoards from '../../components/world/boards/WorldBoards'
import GlobePodium from '../../components/world/boards/GlobePodium'
import StageBoard from '../../components/world/boards/StageBoard'
import FeaturedRail from '../../components/world/featured/FeaturedRail'
import PaidShowcase from '../../components/world/featured/PaidShowcase'
import { PulseTicker } from '../../components/world/pulse/PulseTicker'
import { WorldFilterPanel, useWorldLayers } from '../../components/world/filters'
import GlobeControls from '../../components/world/globe/GlobeControls'
import CountryPanel from '../../components/world/country/CountryPanel'
import CountryPicker from '../../components/world/country/CountryPicker'
import ActivityPanel from '../../components/world/activity/ActivityPanel'
import WorldStats from '../../components/world/activity/WorldStats'
import {
  AudienceReach,
  WatchingNow,
} from '../../components/world/audience/WorldAudience'
import StakeModal from '../../components/world/stake/StakeModal'
// By path, never through `globe/index.ts`: that barrel exports the scene and
// would drag the 1 MB three.js chunk into this page's bundle. `tour` and the
// `hubs` it uses are deliberately three-free.
import { useHubTour } from '../../components/world/globe/tour'
import { formatDollars, MIN_STAKE_CENTS } from '../../components/world/constants'
import { LazyWorldGlobe, type GlobeFocus } from './worldLazy'

/** Stable empty feed, so the layer memos don't churn on every render. */
const NO_PINS: GlobePin[] = []

/**
 * The globe's own band — now everything under the platform chrome.
 *
 * THE OWNER'S REPORT WAS "i just see some small world view, i want it bigger
 * and utilizing more space in general", and the old value is the whole story:
 * `clamp(19rem, calc(100svh - 13rem), 42rem)`. On a 1440×900 laptop the middle
 * term came to 692px and the 42rem CEILING cut it to 672 — the stage was
 * capped 20px below what the viewport was already offering, and on a 1440p
 * monitor it threw away 560px. Then the canvas gave up its left 38% to a copy
 * column, so the globe got 868px of a 2,560px screen.
 *
 * Both are gone. The subtrahend is the real chrome above the stage — the
 * announcement bar, the navbar and one tight header line, measured, not
 * guessed — and the ceiling is now high enough that no ordinary monitor
 * reaches it. Everything that used to flank the globe floats ON it.
 *
 * `svh` rather than `vh`: on a phone the URL bar makes `vh` taller than the
 * screen actually is, which pushed the claim button under the fold on exactly
 * the devices least likely to scroll for it.
 */
const STAGE_HEIGHT = 'clamp(19rem, calc(100svh - 12.5rem), 78rem)'

/**
 * Where the camera starts on this page, in globe radii.
 *
 * The stage is now the viewport, so the globe should be too. At the scene's
 * default 3.45 the sphere renders at 0.88 of the canvas height — a 1,250px
 * stage with 150px of empty sky top and bottom. 3.15 puts it at ~0.97: framed
 * edge to edge with the poles just inside, which is what "bigger" actually
 * means for a sphere, and it is also the point where the label ladder stops
 * sitting on its far-tier floor. See WorldGlobe's `initialDistance`.
 */
const GLOBE_DISTANCE = 3.15

/**
 * THE ONE INSET every floating island on the stage is measured from.
 *
 * Tailwind's `4`, i.e. 16px — the same `container px-4` that <Navbar> and
 * <PageHeader> sit in, so the overlay's left edge lines up with the nav items
 * above it to the pixel. Named once and spent in exactly two places: the
 * overlay wrapper's padding, and the country panel, which is positioned
 * OUTSIDE that wrapper and so has to be told the number rather than inheriting
 * it. Those two used to disagree — `p-4 sm:py-6` against `inset-x-2 sm:inset-x-4`
 * — which is how a panel ends up 8px out of step with the pills beside it.
 */
const STAGE_GUTTER = 'p-4'

/** The same inset, as the four edges a positioned panel needs. */
const STAGE_PANEL_INSET =
  'inset-x-4 bottom-4 lg:inset-x-auto lg:right-4 lg:top-4'

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

/** What the stake modal is open for. Null when it is closed. */
interface StakeTarget {
  iso: string
  name: string
  centsToBeat: number | null
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

  /** The country whose panel is open. THE page's state, read by the globe. */
  const [selectedIso, setSelectedIso] = useState<string | null>(null)
  /** The country the stake modal is buying into. */
  const [stake, setStake] = useState<StakeTarget | null>(null)

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
   * The region rail, the hub tour and the country picker all produce a fresh
   * focus object; the scene re-arms its flight from that object's identity, so
   * "one state, last writer wins" is the whole protocol.
   *
   * Typed as the WIDER `GlobeFocus` rather than the rail's `GlobeFocusPoint`,
   * because selecting a country now sends the camera to a COUNTRY (`{ iso }`)
   * and not to a coordinate. A coordinate is still one of the two shapes, so
   * every existing writer — the rail, the tour — is unaffected.
   */
  const [focus, setFocus] = useState<GlobeFocus>(null)
  const handleFocus = useCallback((next: GlobeFocus) => setFocus(next), [])
  /*
   * The tour is fed the WHOLE feed, not `visiblePins`. Two reasons: the hubs it
   * flies to are a fact about where companies are, not about which filter is
   * open — and these are the pre-jitter coordinates, which is what computeHubs
   * requires to name a hub after the city it is actually over.
   */
  const tour = useHubTour(pins, { onJump: handleFocus })

  /**
   * Selecting a country does three things, in this order, every time — whether
   * the gesture was a click on the sphere, a row in the picker or a country in
   * the activity feed. Keeping them together here is what makes those three
   * entry points feel like one feature.
   */
  const selectCountry = useCallback(
    (iso: string) => {
      const code = iso.trim().toUpperCase()
      if (code.length !== 2) return
      tour.stop()
      setSelectedIso(code)
      setFocus({ iso: code })
    },
    [tour],
  )

  // Escape puts the panel away, from anywhere on the page. Suppressed while the
  // stake modal is open: that dialog owns Escape, and closing the country
  // underneath it as well would leave a buyer looking at nothing.
  useEffect(() => {
    if (!selectedIso || stake) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedIso(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIso, stake])

  return (
    <div className="world-root relative min-h-screen overflow-x-hidden">
      <Helmet>
        <title>ExploreYC World — claim your startup&apos;s spot on the globe</title>
        <meta
          name="description"
          content="Advertising space on a live globe. Stake on a country from $5, put your logo on it, and hold #1 against anyone who wants it more."
        />
      </Helmet>

      {/* The same dotted ground every ExploreYC page sits on. */}
      <DotPattern color="hsl(var(--primary) / 0.12)" size={24} radius={0.5} />

      {/* ── The one terminal eyebrow on this page ─────────────────────────
          House rule: a `$ command` belongs at the top of a ROUTE, once, via
          <PageHeader> — never on every panel. Everything below opens with a
          plain mono heading instead. */}
      {/* ONE TIGHT LINE, and nothing else.
          What was here — a two-line description of the globe and a second
          "Claim a spot" button — cost 146px above a stage that was being
          capped for want of 20. Both were duplicates: the sentence is said
          again by the pitch card ON the globe, and the button is said again by
          the pitch card, by the country panel and by the closing section. The
          <h1> stays, because the route needs one; `mb-0` because the gap below
          a header is this wrapper's job, not the component's. */}
      <div className="container relative mx-auto px-4 pb-3 pt-4">
        {/* `!mb-0`, with the bang. <PageHeader> concatenates `className` onto a
            raw string that already contains `mb-6` — no tailwind-merge — and
            Tailwind emits `.mb-0` BEFORE `.mb-6`, so a plain `mb-0` loses the
            cascade and silently leaves 24px of the gap this header is here to
            remove. Measured, not assumed: the stage started 24px lower than
            the constant below says it should. */}
        <PageHeader command="$ exploreyc --world" title="World" className="!mb-0" />
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

            `container` is the platform's own shell — the exact class, and so
            the exact responsive max-widths, that <Navbar> and <PageHeader> sit
            in. Everything on the stage lives inside it, so the page has one
            column from the nav to the footer and the composition stops growing
            at the width it was designed for.
          */}
          <div className="container relative mx-auto h-full px-0">
            {/*
              The canvas box, and it is the whole stage at every width now.

              It used to give up its left 38% from `xl` so a copy column could
              sit beside the globe rather than on it. That is a reasonable way
              to lay out a landing page and a bad way to lay out a MAP: the
              column took 532px of a 1,400px stage, and because a perspective
              camera sizes the sphere by the canvas's HEIGHT, the page paid for
              that width without the globe ever being able to spend it. The
              panels float on the glass instead — see the overlay wrapper below,
              which is the system they already shared.
            */}
            <div className="absolute inset-0">
              <Suspense fallback={<GlobeLoading />}>
                <LazyWorldGlobe
                  plots={layers.visiblePins}
                  darkMode={darkMode}
                  focus={focus}
                  initialDistance={GLOBE_DISTANCE}
                  // Touch the controls and the tour is over. An auto-flight that
                  // keeps yanking the camera back is worse than no tour at all.
                  onInteract={tour.stop}
                  onSelectPlot={(id) => navigate(`/world/p/${id}`)}
                  onSelectSeed={setSeedPin}
                  // A country click opens its panel HERE. It used to navigate
                  // away to /world/c/:iso, which is a page — a different place
                  // with a different globe-less layout — for what the owner
                  // wanted to be a look at the country he was already on.
                  onSelectCountry={selectCountry}
                  selectedIso={selectedIso}
                  className="absolute inset-0"
                />
              </Suspense>
            </div>

            {/*
              The scrim. The canvas is cleared to transparent, so the globe sits
              directly on the page ground and a gradient in that same ground
              colour reads as depth rather than as a panel laid over the map.
              A scrim exists to keep copy legible where it lies ON the globe. It
              stops at `lg`, which is where the pitch stops being bare text on
              the glass and becomes one of the overlay cards — and a card brings
              its own 95% fill and its own blur, so a page-wide wash on top of
              that would only be a veil over the map.
            */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 sm:hidden"
              style={{
                backgroundImage:
                  'linear-gradient(to bottom, hsl(var(--background)) 0%, hsl(var(--background)) 42%, color-mix(in srgb, hsl(var(--background)) 78%, transparent) 55%, color-mix(in srgb, hsl(var(--background)) 30%, transparent) 70%, transparent 84%)',
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 hidden sm:block lg:hidden"
              style={{
                backgroundImage:
                  'linear-gradient(105deg, hsl(var(--background)) 0%, color-mix(in srgb, hsl(var(--background)) 70%, transparent) 34%, transparent 62%)',
              }}
            />

          {/* Everything on the glass. The wrapper is inert so a drag that
              starts on empty space still spins the globe; each island opts
              back in.

              ONE GUTTER, on all four sides, at every width — STAGE_GUTTER,
              which is <Navbar>'s and <PageHeader>'s own `px-4` inside the same
              `container`. It used to be `p-4 sm:py-6`, i.e. a vertical inset
              that changed at `sm` while the horizontal one did not, and the
              country panel outside this wrapper used a third value again. */}
          <div
            className={`pointer-events-none absolute inset-0 z-10 flex flex-col justify-between gap-4 ${STAGE_GUTTER}`}
          >
            {/* `flex-1` so this row owns the height the legend row does not
                want, and `lg:self-center` on the copy inside it so the pitch
                sits opposite the middle of the globe rather than stranded at
                the top of a full-viewport stage. */}
            <div className="flex flex-1 items-start justify-between gap-4">
            {/* THE LEFT RAIL — inert itself, so a drag that lands in the gap
                between the pitch and the board still spins the globe. Each
                island opts back in. It used to be one `pointer-events-auto`
                block bounded to 36% of the stage, which meant a 500px-wide
                invisible rectangle over the map swallowed every gesture that
                started in it.

                `min-w-0` so the column can actually shrink: without it the
                headline's intrinsic width is the flex floor and the controls
                opposite get squeezed past their own content. */}
            <div className="pointer-events-none flex min-w-0 max-w-xl flex-col gap-3 lg:max-w-[22rem] lg:self-center">
            {/* From `lg` the pitch stops being bare text on the glass and
                becomes one of the overlay cards — same hairline, same 95% fill,
                same blur, same radius as every other island. That is what lets
                the scrim behind it retire and the globe run the full width of
                the stage underneath. Below `lg` it stays plain copy on the
                scrim: a phone's stage is a shopfront window, not a flight
                deck, and a card inside a 343px column is a box around a box. */}
            <div className="pointer-events-auto min-w-0 lg:rounded-sm lg:border lg:border-border/80 lg:bg-card/95 lg:p-4 lg:backdrop-blur-md lg:dark:border-white/10">
              <WorldChip tone="accent" className="mb-3">
                Advertising space on a live globe
              </WorldChip>
              {/* level 2, not 1: <PageHeader> above the stage owns the page's
                  only <h1>. This is the sales pitch, not the route's title. */}
              <WorldHeading level={2} className="mb-2 text-2xl sm:text-3xl lg:text-2xl">
                Put your startup on the map.
              </WorldHeading>
              {/* Dropped on a short viewport — a landscape phone gives the
                  stage about 300px, and the headline, the buttons and the
                  no-prize line all outrank a supporting sentence for that
                  space. Keyed on HEIGHT, because that is what is scarce.
                  Dropped from `lg` too: inside a 22rem card on top of the map
                  this sentence is the third time the page says the same thing,
                  and the board under it is worth more than the repetition. */}
              <p className="mb-5 max-w-lg text-sm leading-snug text-muted-foreground [@media(max-height:620px)]:hidden sm:text-base lg:hidden">
                Pick a country, plant your logo in it, and hold the top spot against anyone who
                wants it more.
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                {/* The primary path, and it is an in-page anchor rather than a
                    route: the thing it moves you to is on this screen. */}
                <a href="#pick" className={worldButtonClass('primary', 'lg')}>
                  Claim a spot — from $5
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </a>
                {/* A real anchor, not a scroll handler: it moves keyboard focus
                    to the board as well as the viewport. Desktop only — on a
                    phone the two `lg` pills wrap onto separate rows and eat a
                    third of the stage — and it stands down again from `lg`,
                    where the board it points at is on the glass right below
                    with its own "Full board" link. */}
                <a href="#board" className={worldButtonClass('secondary', 'lg', { className: 'hidden sm:inline-flex lg:hidden' })}>
                  See the board
                </a>
              </div>
              <p className="mt-2.5 flex items-center gap-1.5 text-xs leading-tight text-muted-foreground">
                No prize, no payout, no refund.
                {/* Mid-line and inside a column that is 343px on a phone, so
                    the bubble opens from its middle — the only alignment that
                    fits either side of a trigger sitting near the centre. */}
                <InfoTip label="What claiming a spot gets you" align="center">
                  A named plot on the globe with your logo on it, and a rank in the country you
                  stake on for as long as nobody outstakes you. It is an ad buy, not a bet.
                </InfoTip>
              </p>
            </div>

              {/* THE BOARD, IN THE FIRST VIEWPORT.
                  Here rather than in the opposite corner, and that is the whole
                  point: the right-hand rail is where the country panel opens,
                  so a board parked there is a board that disappears the moment
                  anybody uses the product.

                  From `lg` now rather than `xl`. It used to need `xl` because
                  below that the copy column lay ON the globe and a second card
                  under it would have been a wall of text over the map; the copy
                  is a bounded 22rem card from `lg` and the board is simply the
                  next island beneath it. */}
              <StageBoard
                onSelectCountry={selectCountry}
                className="pointer-events-auto hidden max-w-[22rem] lg:flex"
              />
            </div>

            {/* The totals, and the exploration tools the deck.gl map brought
                with it, in the corner opposite the headline. Desktop only: at
                375px this rail would land on top of the hero, and the phone
                version of this page is a shopfront window, not a flight deck. */}
            <div className="pointer-events-auto hidden shrink-0 flex-col items-end gap-2 sm:flex">
              {/* WHO IS ACTUALLY LOOKING — the proof a paid plot is bought on,
                  and the two figures the owner asked for, in the corner that
                  already carries totals.

                  Two separate pills rather than one two-line card, because
                  WORLD_OVERLAY_PILL is a one-line geometry and these have to
                  share an edge with <WorldStats> under them. Both render
                  NOTHING when there is nothing real to say: no reach line
                  without a completed Vercel read, no "watching" before our own
                  heartbeat lands. See components/world/audience. */}
              <WatchingNow pill />
              {/* `lg` and up only. The reach pill is a ~26rem single line; on
                  the 640–1024px band where this rail is already visible it
                  would reach across the stage and into the hero copy. The same
                  figure is on this page at every width, in the closing CTA. */}
              <AudienceReach pill align="end" className="hidden lg:flex" />
              <WorldStats />
              <GlobeControls onFocus={handleFocus} tour={tour} />
            </div>
            </div>

            <div className="flex items-end justify-between gap-3">
              {/* BOTTOM LEFT. The imported layer gets one pill; the live feed
                  gets the corner the reference gives it. */}
              <div className="pointer-events-auto flex min-w-0 flex-col items-start gap-2">
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
                {/* ONE LINE, ONE PILL. This was a two-line card at
                    `px-3 py-2` sitting directly on top of the `min-h-[2rem]`
                    Layers button — two stacked pills of two different heights,
                    two different paddings and two different surfaces, which is
                    the pair the owner photographed. Both are
                    WORLD_OVERLAY_PILL now, so they are the same object twice.
                    The two dots still differ in FILL as well as colour — solid
                    for the paid layer, a ring for the imported one — so the
                    legend survives being read in monochrome. */}
                <div
                  aria-label="What is on the globe"
                  className={`${WORLD_OVERLAY_PILL} hidden sm:flex`}
                >
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#FB651E]"
                    />
                    <Count n={layers.paidCount} /> paid
                  </span>
                  <span aria-hidden className="text-muted-foreground">
                    ·
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
                  </span>
                </div>
                <WorldFilterPanel layers={layers} />
                {/* LIVE ACTIVITY, per the reference's bottom-left card. `xl`
                    rather than `lg`: below 1280 the country panel and this card
                    are both on the glass and a 22rem feed leaves the globe a
                    letterbox.

                    THREE rows, not five, and the number is measured rather than
                    chosen. On a 1280x720 laptop the stage is 512px: the hero
                    row will not shrink below its own content (~250px), so
                    whatever the bottom row costs above ~200px is clipped off
                    the foot of the stage. Three rows plus the header and the
                    footer come to ~198px — the same footprint the podium has
                    always had in the opposite corner. The full feed, eight rows
                    deep, is further down the page. */}
                {/* LIVE ACTIVITY used to sit here, three rows deep, from
                    `xl` up — which is exactly and only the breakpoint where
                    <StageBoard> now occupies the copy column. Two stacked cards
                    in one 672px stage do not fit: measured at 1440x900 the
                    bottom row was pushed 110px past the stage's own bottom edge
                    and the feed was sliced through the middle by the section's
                    `overflow-hidden`. Between a ranked board and a feed, the
                    board is what the owner said was missing and the feed is
                    what <PulseTicker> carries immediately below the globe — so
                    the feed steps back from the glass and keeps both of its
                    other homes. */}
              </div>

              {/* THE PODIUM, ON THE MAP — the top three countries, crowned.
                  `md` to `lg` ONLY, which is the window <StageBoard> does not
                  cover: from `lg` the board is in the left rail, always on
                  screen and never fighting the country panel for the right-hand
                  side, and two ranked cards at once would be the same list
                  twice. Below `md` the stage is a phone shopfront and a 22rem
                  podium would be most of it. Still stands down while a panel is
                  open, because at these widths they share a column. */}
              {selectedIso ? null : (
                <GlobePodium className="pointer-events-auto hidden w-[22rem] max-w-[45%] md:block lg:hidden" />
              )}
            </div>
          </div>

          {/* ── THE COUNTRY VIEW ────────────────────────────────────────────
              One instance, two shapes. A bottom sheet on a phone (where a right
              rail would be a 200px column), a full-height rail from `lg`. It
              sits OUTSIDE the overlay flex column above so its height is its
              own rather than a share of a row, which is what lets its list
              scroll instead of the card growing past the stage. */}
          {selectedIso ? (
            <div
              // The SAME inset the overlay wrapper uses, so the panel's edges
              // are the edges the pills already sit on. It used to be
              // `inset-x-2` on a phone and `inset-x-4` from `sm`, against an
              // overlay that was `p-4` throughout — 8px out of step at exactly
              // the width where it is most obvious.
              className={
                'pointer-events-auto absolute z-20 max-h-[70%] ' +
                `${STAGE_PANEL_INSET} lg:w-[22rem] lg:max-h-none`
              }
            >
              <CountryPanel
                iso={selectedIso}
                onClose={() => setSelectedIso(null)}
                onClaim={setStake}
                className="h-full"
              />
            </div>
          ) : null}
          </div>
        </div>
      </section>

      {/* ── What just happened, as a strip under the map ───────────────────
          Renders nothing at all when there is no activity, so an empty product
          gets no empty strip. Since the glass card was retired this is the
          activity surface at EVERY width — it sits directly under the globe,
          which is where a ticker belongs. The full feed is further down. */}
      <div className="border-b border-border bg-card/40">
        <div className="container mx-auto px-4 py-2">
          <PulseTicker className="border-0 bg-transparent backdrop-blur-none hover:border-0 hover:shadow-none dark:border-0 dark:bg-transparent" />
        </div>
      </div>

      {/* ── PICK A COUNTRY ────────────────────────────────────────────────
          The keyboard route into the whole feature, and the target of every
          "claim a spot" on this page. A WebGL canvas is not a gesture everybody
          has; this list is the same feature without one.

          `tabIndex={-1}` so the in-page anchors above actually move FOCUS here
          and not just the viewport — otherwise a keyboard user presses the call
          to action and their next Tab continues from the top of the page. */}
      <section
        id="pick"
        tabIndex={-1}
        aria-label="Pick a country to stake on"
        className="scroll-mt-24 border-b border-border focus:outline-none"
      >
        <div className="mx-auto max-w-lg px-4 py-10 sm:py-14">
          <WorldHeading level={2} className="justify-center text-center">
            Pick a country
          </WorldHeading>
          <p className="mx-auto mb-5 mt-2 max-w-sm text-center text-sm text-muted-foreground">
            Or click one on the globe. Either way you land on the same panel.
          </p>
          <CountryPicker onSelect={selectCountry} className="max-h-[26rem]" />
        </div>
      </section>

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
            {/* The board's conversion button is an intent now, not a route —
                the wizard it used to link to is deleted. On this page "claim a
                plot" means the country picker above, so send focus there. */}
            <WorldBoards
              feature
              onClaim={() => {
                const pick = document.getElementById('pick')
                pick?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                pick?.focus({ preventScroll: true })
              }}
            />
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
        {/* The full feed, and now the only <ActivityPanel> on the page — so it
            keeps the "Just happened" name it was given to distinguish it from
            the retired corner card, which reads better here anyway. */}
        <ActivityPanel rows={8} label="Just happened" onSelectCountry={selectCountry} />
      </div>

      {/* ── The ask, one more time ───────────────────────────────────────── */}
      <section
        aria-label="Claim a spot"
        className="border-t border-border bg-[#FB651E]/[0.05]"
      >
        <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:py-16">
          <WorldHeading level={2} className="justify-center">
            Every country is first come, first served.
          </WorldHeading>
          {/* The floor comes from MIN_STAKE_CENTS, not from a typed "$5": the
              number on this page and the number the server enforces are the
              same constant. Set in ink rather than orange — accent-as-text on
              this tinted band measures 4.31:1 in light, below AA. */}
          <p className="mx-auto mb-6 mt-2 max-w-lg text-base text-muted-foreground">
            <strong className="text-foreground">{formatDollars(MIN_STAKE_CENTS)}</strong> puts
            your logo on the globe. Anyone who wants your spot has to outstake you for it.
          </p>
          <a href="#pick" className={worldButtonClass('primary', 'lg')}>
            Claim a spot — from $5
            <ChevronRight className="h-5 w-5" aria-hidden />
          </a>
          {/* The reach, at the second price on this page — and the only place a
              phone sees it, because the stage rail that carries it above is
              desktop-only. Centred here, so the InfoTip bubble opens from the
              middle rather than off the edge of a 320px screen. */}
          <AudienceReach className="mt-4 justify-center" align="center" />
          <NoPrizeNote className="mt-3 text-xs text-muted-foreground" />
        </div>
      </section>

      {/* Clicking an unclaimed pin: who that company is, its ExploreYC profile,
          and the claim flow prefilled for it. */}
      <SeedCompanyDialog
        pin={seedPin}
        onClaimCountry={(iso) => {
          setSeedPin(null)
          selectCountry(iso)
        }}
        onClose={() => setSeedPin(null)}
      />

      {/* THE PURCHASE. One link, one amount, Stripe — see StakeModal. */}
      {stake ? (
        <StakeModal
          iso={stake.iso}
          countryName={stake.name}
          centsToBeat={stake.centsToBeat}
          onClose={() => setStake(null)}
        />
      ) : null}
    </div>
  )
}
