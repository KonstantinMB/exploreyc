/**
 * /world — the merged globe, and the shopfront around it.
 *
 * WHAT CHANGED, AND WHY (the second time). This page used to sell a COORDINATE.
 * You pressed "Claim your plot", left for /world/claim, hunted for a point with
 * a pulsing target ring, then filled in four steps of form before anybody would
 * take $5 off you. The owner's verdict on that ring was unprintable and his
 * verdict on the flow was clear: "when i click on a country - i want to see the
 * view of the country", and "you can follow the example on functionalities and
 * simplification of the way of bidding and adding your spot".
 *
 * So the unit of this product is now the COUNTRY:
 *
 *   click a country  ->  <CountryPanel>: who owns it, what #1 pays, one button
 *   press the button ->  <StakeModal>: one link, one amount, Stripe
 *
 * The coordinate did not go anywhere — `world_plots` still stores one, and the
 * checkout endpoint still resolves geography from it — it is DERIVED inside the
 * modal from the country's own cities and confirmed against the same server
 * geography (see components/world/stake/derivePoint.ts). Picking an exact point
 * survives at /world/claim as a refinement, which is where a preference belongs:
 * after the purchase, not in front of it.
 *
 * THE PAGE OWNS THE SELECTION. `selectedIso` lives here and nowhere else. The
 * globe reads it and highlights that country; the picker, the activity feed and
 * a click on the sphere all write it through the same setter. One state, one
 * writer per gesture, no second source of truth.
 *
 * THE LAYER MODEL is still in components/world/filters/layers.ts: paid plots
 * always on and always loudest, ~5.5k imported YC pins behind one small pill.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
} from '../../components/world/ui'
import SeedCompanyDialog from '../../components/world/SeedCompanyDialog'
import WorldBoards from '../../components/world/boards/WorldBoards'
import GlobePodium from '../../components/world/boards/GlobePodium'
import FeaturedRail from '../../components/world/featured/FeaturedRail'
import PaidShowcase from '../../components/world/featured/PaidShowcase'
import { PulseTicker } from '../../components/world/pulse/PulseTicker'
import { WorldFilterPanel, useWorldLayers } from '../../components/world/filters'
import GlobeControls from '../../components/world/globe/GlobeControls'
import CountryPanel from '../../components/world/country/CountryPanel'
import CountryPicker from '../../components/world/country/CountryPicker'
import ActivityPanel from '../../components/world/activity/ActivityPanel'
import WorldStats from '../../components/world/activity/WorldStats'
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
   * The region rail, the hub tour, the country picker and (on /world/claim) the
   * city search all produce a fresh focus object; the scene re-arms its flight
   * from that object's identity, so "one state, last writer wins" is the whole
   * protocol.
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
      <div className="container relative mx-auto px-4 pb-2 pt-8">
        <PageHeader
          command="$ exploreyc --world"
          title="World"
          subtitle="Advertising space on a live globe. Stake on a country, put your logo on it, and hold the top spot against anyone who wants it more."
          actions={
            <a href="#pick" className={worldButtonClass('primary', 'md')}>
              Claim a spot
              <ChevronRight className="h-4 w-4" aria-hidden />
            </a>
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

            `container` is the platform's own shell — the exact class, and so
            the exact responsive max-widths, that <Navbar> and <PageHeader> sit
            in. Everything on the stage lives inside it, so the page has one
            column from the nav to the footer and the composition stops growing
            at the width it was designed for.
          */}
          <div className="container relative mx-auto h-full px-0">
            {/*
              The canvas box. Full-bleed inside the column below `xl`, where the
              hero spans the width and the globe is its backdrop; from `xl` up it
              gives up its left 38% and the page becomes a real two-column
              layout — copy on the left, globe on the right, neither on top of
              the other.
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
              Both stop at `xl`, and that is the point of the two-column split:
              a scrim exists to keep copy legible where it lies ON the globe, and
              from `xl` up it no longer does.
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
              className="pointer-events-none absolute inset-0 hidden sm:block xl:hidden"
              style={{
                backgroundImage:
                  'linear-gradient(105deg, hsl(var(--background)) 0%, color-mix(in srgb, hsl(var(--background)) 70%, transparent) 34%, transparent 62%)',
              }}
            />

          {/* Everything on the glass. The wrapper is inert so a drag that
              starts on empty space still spins the globe; each island opts
              back in. `px-4`, not `px-6`, from `sm` up: that is <Navbar>'s and
              <PageHeader>'s gutter inside the same `container`, so the chip,
              the headline and the controls line up with the nav items above
              them to the pixel. */}
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between gap-4 p-4 sm:py-6">
            {/* `flex-1` so this row owns the height the legend row does not
                want, and `xl:self-center` on the copy inside it so the pitch
                sits opposite the middle of the globe rather than stranded at
                the top of a 42rem band. */}
            <div className="flex flex-1 items-start justify-between gap-4">
            {/* `min-w-0` so this column can actually shrink: without it the
                headline's intrinsic width is the flex floor, and the controls
                beside it get squeezed past their own content. From `xl` the
                column is bounded to the left third, which is what makes the
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
                    third of the stage. */}
                <a href="#board" className={worldButtonClass('secondary', 'lg', { className: 'hidden sm:inline-flex' })}>
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

            {/* The totals, and the exploration tools the deck.gl map brought
                with it, in the corner opposite the headline. Desktop only: at
                375px this rail would land on top of the hero, and the phone
                version of this page is a shopfront window, not a flight deck. */}
            <div className="pointer-events-auto hidden shrink-0 flex-col items-end gap-2 sm:flex">
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
                <ActivityPanel
                  rows={3}
                  onSelectCountry={selectCountry}
                  className="hidden w-[20rem] max-w-full xl:flex"
                />
              </div>

              {/* THE PODIUM, ON THE MAP — the top three countries, crowned.
                  Stands down while a country panel is open: they share the
                  right-hand column and the panel is the thing that was asked
                  for. */}
              {selectedIso ? null : (
                <GlobePodium className="pointer-events-auto hidden w-[22rem] max-w-[45%] lg:block" />
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
              className={
                'pointer-events-auto absolute inset-x-2 bottom-2 z-20 max-h-[70%] ' +
                'sm:inset-x-4 sm:bottom-4 ' +
                'lg:inset-x-auto lg:bottom-4 lg:right-4 lg:top-4 lg:w-[22rem] lg:max-h-none'
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
          gets no empty strip. This is also the phone's activity surface: the
          full <ActivityPanel> in the corner starts at `xl`. */}
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
          <p className="mt-3 text-center text-xs text-muted-foreground">
            <Link to="/world/claim" className="world-link">
              Pick an exact coordinate instead
            </Link>
          </p>
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
        {/* The full feed. Named "Just happened" rather than "Live activity" so
            it is a different landmark from the card in the globe's corner,
            which is on screen at the same time from `xl` up. */}
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
          <NoPrizeNote className="mt-3 text-xs text-muted-foreground" />
        </div>
      </section>

      {/* Clicking an unclaimed pin: who that company is, its ExploreYC profile,
          and the claim flow prefilled for it. */}
      <SeedCompanyDialog pin={seedPin} onClose={() => setSeedPin(null)} />

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
