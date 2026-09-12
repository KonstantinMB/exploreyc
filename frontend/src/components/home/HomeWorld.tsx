/**
 * ExploreYC World, on the homepage — the paid surface, sold instead of described.
 *
 * WHAT THIS REPLACES. The old `#world` band was a headline, a paragraph and a
 * numbered list of three sentences. The owner's verdict on it was "the anchors
 * is invisible": a text-only band about a 3D globe, on a page made of other
 * text-only bands, is indistinguishable from the rest of the page. So the band
 * is gone and the thing itself is here — the live globe, the leaderboard of the
 * companies that paid to be on it, and one price.
 *
 * THE GLOBE IS THE SECTION, not a thumbnail beside some copy. The review that
 * produced this shape was "make the map bigger, as it is quite shrinked and
 * people won't see their countries": the stage was capped at 30rem and the
 * canvas gave up its left third to the pitch, so at 1440 the sphere rendered
 * about 430px across and Portugal was four pixels wide. The stage is now
 * `min(78vh, 92vw)` — near-viewport-height on a laptop, square-ish on a phone —
 * and the canvas is full-bleed from `xl`, so the sphere is sized by the stage's
 * SHORT side and nothing is subtracted from it. The pitch and the board float
 * in the margins the sphere cannot use, the way the instruments on /world do.
 * The camera also sits closer (2.85 radii rather than 3.1), which is what moves
 * the label budget off its far-tier floor: more country names, larger, on a
 * bigger sphere. See `countryLabelBudgetAt` in globe/labelLayout.
 *
 * THE THREE-JS BILL IS NEVER PAID BY A BOUNCER. `three` + the scene is a ~1 MB
 * chunk and the coarse world atlas another 108 kB. None of it — and none of the
 * globe feed either — is requested until this section is within 250 px of the
 * viewport:
 *
 *   - `useArmed` is one IntersectionObserver that disconnects after it fires.
 *   - Until it fires, both React Query reads are `enabled: false` (zero
 *     requests) and <LazyWorldGlobe> is not in the tree (zero chunk).
 *   - A blurred crop of `/og-world.png` holds the stage, at `loading="lazy"`,
 *     so even the poster costs nothing above the fold. It fades out once the
 *     globe module has actually resolved, not on a hopeful timer.
 *
 * THE GLOBE IS DISPLAY-ONLY HERE, deliberately. On /world it is an instrument:
 * OrbitControls owns the wheel, and a wheel that zooms is a scroll trap on a
 * landing page. So the canvas is `pointer-events-none` and one full-stage link
 * covers it. Every gesture over the globe either scrolls the page or goes to
 * /world.
 *
 * THE LEADERBOARD IS THE PRODUCT. What a customer buys here is visibility in
 * front of other founders, so the section shows exactly that: a ranked board of
 * who has staked the most, crowned with the platform's own podium. It floats on
 * the globe from `xl` and stacks under it below, which is why the section is
 * barely taller than it was despite the stage growing by half — the board costs
 * no rows on a laptop, and it REPLACED the seven-tile logo grid that used to
 * sit under the stage saying less.
 *
 * HONESTY. Every number on this section is derived from data the API actually
 * returns — plots claimed and dollars staked are counted off the paid layer of
 * /api/world/globe, countries claimed is the row count of /api/world/board,
 * each board row's rank is the server's `rank_world` (falling back to position
 * in the stake-ordered feed, which is the same thing), and its country comes
 * from that plot's own record. And with zero paid plots — the launch-day
 * reality — the board does not render placeholder logos pretending to be
 * customers; it renders the offer.
 *
 * THE AUDIENCE LINE IS THE PITCH, and it is new. This section printed no
 * visitor count at all until now, for the only defensible reason: we did not
 * track one. We do now — Vercel Web Analytics for exploreyc.com, read through
 * /api/world/audience — so the question a $5 plot is actually bought on ("how
 * many people will see my logo?") gets a measured answer, next to the price.
 * Every figure in it comes off that endpoint; not one of them is typed into
 * this file. If the backend has no analytics token the endpoint answers null
 * and <AudienceReach> renders NOTHING, which is the correct amount to say about
 * a number we do not have. Same rule for <WatchingNow>: at one viewer it says
 * "just you", because that viewer is the person reading it. See
 * components/world/audience.
 */

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { Link } from 'react-router-dom'
import { useQueries, useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Earth } from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import { cn } from '../../lib/utils'
import worldApi, { type GlobePin } from '../../lib/worldApi'
import { MIN_STAKE_CENTS, formatDollars } from '../world/constants'
import { CountUp } from '../world/boards/CountUp'
import { TopStakers, type StakerEntry } from '../world/boards/TopStakers'
import { AudienceReach, WatchingNow } from '../world/audience/WorldAudience'
import { LazyWorldGlobe } from '../../pages/world/worldLazy'

/**
 * How many bought plots reach the board: three on the podium and four rows
 * under it. Also the number of per-plot detail reads this section makes, which
 * is why it is a small number and not a page size.
 */
const BOARD_LIMIT = 7

/** Detail reads are cheap and amounts move slowly. */
const DETAIL_STALE_MS = 30_000

/** Empty array identity, so `pins` is stable while the feed is in flight. */
const NO_PINS: GlobePin[] = []

/**
 * The stage's height, and the single most important number in this file.
 *
 * `min(78vh, 92vw)` is one rule doing two jobs. On a laptop the viewport is
 * wider than it is tall, so the `vh` term wins and the stage is near-viewport
 * height — the globe is the screen. On a phone the `vw` term wins, so a 375px
 * device gets a ~345px square rather than a 520px letterbox with a small sphere
 * marooned in the middle of it: a sphere is sized by the SHORT side of its box,
 * so height beyond the box's width buys nothing but scroll.
 *
 * The clamp's floor keeps a very short viewport usable; its ceiling stops a
 * 1440p monitor from handing the section an 1100px stage that pushes the rest
 * of the page below three folds.
 */
const STAGE_HEIGHT = 'clamp(20rem, min(78vh, 92vw), 50rem)'

/**
 * How the globe is framed here, in globe radii from the centre.
 *
 * THE BOX NEVER SIZED THE SPHERE — the camera did. A perspective camera draws
 * the planet at `canvasHeight · tan(asin(1/d)) / tan(fov/2)`, so at the scene's
 * default 3.45 and fov 38 the sphere was 0.88 of the stage's height no matter
 * how large the stage got: a twelfth of the box empty above and below it, on
 * the one section whose entire job is "find your country". 3.15 is ~0.97 of the
 * height — framed, with the poles just inside the edges.
 *
 * `FOCUS` is the arrival height when the camera flies to whoever is paying
 * most. A hair closer than the opening frame, because arriving should feel like
 * arriving; still far enough that no continent leaves the frame. It also sits
 * under the `far` LOD boundary (3.15), which is the tier that rations country
 * names hardest — see `countryLabelBudgetAt`.
 */
const INITIAL_DISTANCE = 3.15
const FOCUS_DISTANCE = 3.0

/**
 * One shot, one boolean — behind TWO gates, because one is not enough.
 *
 *   1. `load` + `requestIdleCallback`. The observer is not even created until
 *      the page has finished loading and the main thread has gone quiet, so a
 *      1 MB WebGL chunk can never be in flight while the hero is still
 *      painting. This is the gate that protects LCP, and it is the one that
 *      matters on a laptop, where a 900 px viewport puts this section at the
 *      fold and an intersection test alone would fire instantly.
 *   2. IntersectionObserver, 250 px of lead-in, disconnected after it fires.
 *      This is the gate that protects the visitor who never scrolls.
 *
 * Falls open where IntersectionObserver does not exist — a missing browser API
 * must not be able to hide the section that sells the product.
 */
function useArmed<T extends HTMLElement>(rootMargin = '250px'): {
  ref: RefObject<T | null>
  armed: boolean
} {
  const ref = useRef<T | null>(null)
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (armed) return
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setArmed(true)
      return
    }

    let io: IntersectionObserver | null = null
    let cancelled = false

    const observe = () => {
      if (cancelled) return
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            setArmed(true)
            io?.disconnect()
          }
        },
        { rootMargin },
      )
      io.observe(el)
    }

    const whenIdle = () => {
      const ric = (
        window as typeof window & {
          requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
        }
      ).requestIdleCallback
      if (ric) ric(observe, { timeout: 2500 })
      else window.setTimeout(observe, 800)
    }

    if (document.readyState === 'complete') whenIdle()
    else window.addEventListener('load', whenIdle, { once: true })

    return () => {
      cancelled = true
      io?.disconnect()
      window.removeEventListener('load', whenIdle)
    }
  }, [armed, rootMargin])

  return { ref, armed }
}

/* ────────────────────────────────────────────────────────────────────────────
   The stage
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The poster.
 *
 * A blurred, zoomed crop of the real /world screenshot — the sphere only, with
 * the page chrome in that shot cropped away by the scale/offset. It is a
 * placeholder for well under a second, so a low-fidelity blur is the right
 * fidelity; the wash over it is what keeps a light-background screenshot from
 * reading as a bright rectangle in dark mode.
 *
 * The zoom came down from 2.1 with the taller stage: `object-cover` already
 * upscales a 1200×630 source by ~2.2 to fill a 1368×800 box, and stacking the
 * old scale on top of that turned a soft blur into a smear of four pixels.
 */
function StagePoster({ hidden }: { hidden: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-700 ease-out motion-reduce:transition-none',
        hidden ? 'opacity-0' : 'opacity-100',
      )}
    >
      <img
        src="/og-world.png"
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full scale-[1.55] object-cover blur-[3px] opacity-70 dark:opacity-30"
        style={{ objectPosition: '44% 46%' }}
      />
      <div className="absolute inset-0 bg-background/35 dark:bg-background/55" />
    </div>
  )
}

function GlobeStage({
  pins,
  armed,
  focus,
}: {
  pins: GlobePin[]
  armed: boolean
  focus: { lat: number; lng: number; distance: number } | undefined
}) {
  const { darkMode } = useApp()
  const reduced = useReducedMotion()
  const [painted, setPainted] = useState(false)

  // The poster comes off when the globe module has genuinely resolved, plus a
  // beat for the first frame — not on a hopeful timer that would strand a slow
  // connection looking at an empty box. Same specifier as pages/world/worldLazy,
  // so both resolve to the one already-cached chunk.
  useEffect(() => {
    if (!armed) return
    let cancelled = false
    let timer = 0
    import('../world/globe')
      .then(() => {
        timer = window.setTimeout(() => {
          if (!cancelled) setPainted(true)
        }, reduced ? 0 : 900)
      })
      .catch(() => {
        /* WebGL or the chunk failed — the poster stays, which is the fallback. */
      })
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [armed, reduced])

  return (
    <>
      {armed ? (
        <Suspense fallback={null}>
          {/* pointer-events-none: see the file header — the wheel belongs to
              the page here, never to OrbitControls. */}
          <div className="pointer-events-none absolute inset-0">
            <LazyWorldGlobe
              plots={pins}
              darkMode={darkMode}
              focus={focus}
              initialDistance={INITIAL_DISTANCE}
              logoMarkers
              className="absolute inset-0"
            />
          </div>
        </Suspense>
      ) : null}

      <StagePoster hidden={painted} />

      {!painted ? (
        <p role="status" className="sr-only">
          Loading the live globe…
        </p>
      ) : null}
    </>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   The section
   ──────────────────────────────────────────────────────────────────────────── */

/** One live figure over the globe. Snaps instead of counting under reduced motion. */
function StagePill({
  value,
  label,
  format,
}: {
  value: number
  label: string
  format?: (n: number) => string
}) {
  return (
    <span className="inline-flex min-h-[2.25rem] items-center gap-1.5 rounded-sm border border-border/80 bg-card/90 px-3 font-mono text-xs backdrop-blur-md dark:border-white/10">
      <CountUp value={value} format={format} className="font-bold tabular-nums text-[#FB651E]" />
      <span className="text-muted-foreground">{label}</span>
    </span>
  )
}

export function HomeWorld() {
  const { ref, armed } = useArmed<HTMLElement>()

  const { data: globe, isPending: globePending } = useQuery({
    queryKey: ['world', 'globe'],
    queryFn: () => worldApi.getGlobe().then((r) => r.data),
    enabled: armed,
    staleTime: 60_000,
  })

  // World scope ranks COUNTRIES, so the row count is exactly "countries with a
  // plot in them" — the one fact the globe feed cannot cheaply give us.
  const { data: board } = useQuery({
    queryKey: ['world', 'board', 'richest', 'world'],
    queryFn: () => worldApi.getBoard('richest', 'world').then((r) => r.data),
    enabled: armed,
    staleTime: 60_000,
  })

  const pins = globe?.plots ?? NO_PINS

  const paid = useMemo(
    () =>
      pins
        .filter((p) => p.kind === 'plot')
        .sort(
          (a, b) =>
            (b.total_cents ?? 0) - (a.total_cents ?? 0) ||
            b.tier - a.tier ||
            Number(b.promoted) - Number(a.promoted) ||
            a.name.localeCompare(b.name),
        ),
    [pins],
  )

  const shown = useMemo(() => paid.slice(0, BOARD_LIMIT), [paid])

  const details = useQueries({
    queries: shown.map((pin) => ({
      queryKey: ['world', 'plot', pin.id],
      queryFn: () => worldApi.getPlot(pin.id).then((r) => r.data),
      staleTime: DETAIL_STALE_MS,
    })),
  })

  /**
   * The board's rows.
   *
   * Two sources, and the split matters: the globe feed is what ORDERS them (it
   * is the only read that has every paid plot in it), and the per-plot detail
   * read is what NAMES the country. A row whose detail has not landed yet
   * renders with no country line rather than an invented one, and its rank is
   * its position in the stake order — which is what a world rank is — until the
   * server's own `rank_world` arrives to confirm it.
   */
  const entries: StakerEntry[] = useMemo(
    () =>
      shown.map((pin, i) => {
        const plot = details[i]?.data
        return {
          id: pin.id,
          rank: plot?.rank_world ?? i + 1,
          name: plot?.name ?? pin.name,
          logoUrl: plot?.logo_url ?? pin.logo_url ?? null,
          cents: plot?.total_cents ?? pin.total_cents ?? null,
          countryIso: plot?.country_iso ?? null,
          countryName: plot?.country_name ?? null,
        }
      }),
    // `details` is a fresh array identity every render (useQueries), so the
    // memo keys on the payloads it actually reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shown, details.map((d) => d.dataUpdatedAt).join(',')],
  )

  const stakedCents = useMemo(
    () => paid.reduce((sum, p) => sum + (p.total_cents ?? 0), 0),
    [paid],
  )
  const countries = board?.rows.length ?? 0

  /**
   * The camera opens on whoever is paying most.
   *
   * A globe that lands facing an empty ocean is an advertisement for nothing.
   * Memoised on the leader's id so the object identity is stable — the scene
   * re-arms its flight whenever `focus` changes identity, and a fresh object
   * every render would fly the camera on every poll.
   */
  const leader = paid[0]
  const focus = useMemo(
    () => (leader ? { lat: leader.lat, lng: leader.lng, distance: FOCUS_DISTANCE } : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leader?.id],
  )

  return (
    <motion.section
      id="world"
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5 }}
      className="border-t border-border py-10"
      aria-label="ExploreYC World"
    >
      {/*
        THREE CHILDREN, ONE CELL, THREE COMPOSITIONS.

        Everything below is placed in row 1 / column 1 of a single-column grid
        at the breakpoint where it should float ON the stage, and auto-placed
        into its own row below that. So the same markup is:

          < lg   pitch, then globe, then board — a phone reading top to bottom.
          lg     pitch floats in the stage's left margin (the canvas gives up
                 22% so the sphere clears it); board still stacks underneath,
                 because 992px cannot carry two 21rem rails and a sphere.
          xl +   canvas full-bleed, sphere centred and sized by the stage's
                 short side, pitch and board floating in the margins a sphere
                 in a wide box cannot use.

        One set of markup, no duplicated CTA, and the board costs zero page
        height on the screens that have room for it.
      */}
      <div className="grid">
        <div className="relative z-20 mb-4 min-w-0 lg:col-start-1 lg:row-start-1 lg:mb-0 lg:max-w-[20rem] lg:self-center lg:p-6 xl:max-w-[22rem]">
          <div className="mb-2 flex items-center gap-2 font-mono text-sm text-muted-foreground">
            <Earth className="h-4 w-4 text-[#FB651E]" />
            <span>$ exploreyc --world</span>
          </div>
          <h2 className="font-mono text-2xl font-bold leading-tight md:text-3xl">
            <span className="text-[#FB651E]">&gt;</span> Put your startup on the globe
          </h2>
          <div className="mt-4">
            <Link
              to="/world"
              className="group inline-flex items-center gap-2 rounded-sm border border-[#FB651E] bg-[#FB651E] px-5 py-3 font-mono text-sm font-bold text-white shadow-[0_0_24px_rgba(251,101,30,0.25)] transition-colors hover:bg-[#E65C00] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FB651E] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Claim your plot — {formatDollars(MIN_STAKE_CENTS)}
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </Link>
          </div>
          {/* WHAT THE $5 ACTUALLY BUYS, immediately under the price — the one
              question this section exists to answer, and the first time the
              product has been able to answer it with a measurement rather than
              an adjective. Gated on `armed` with everything else, so it costs
              no request until the section is approached; renders nothing at all
              when the backend has no analytics token. */}
          {armed ? <AudienceReach tone="pitch" className="mt-3" align="start" /> : null}
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">
            No prize, no payout, no refund.
          </p>
        </div>

        {/* The stage. */}
        <div
          className="relative isolate overflow-hidden rounded-sm border border-border bg-muted/20 lg:col-start-1 lg:row-start-1 dark:border-white/10"
          style={{ height: STAGE_HEIGHT }}
        >
          {/* At `lg` the canvas gives up the left 22% so the sphere clears the
              pitch. From `xl` there is enough margin either side of a
              height-sized sphere for both overlays, so the canvas takes the
              whole stage and the sphere is as large as the box allows. */}
          <div className="absolute inset-0 lg:left-[22%] xl:left-0">
            <GlobeStage pins={pins} armed={armed} focus={focus} />
          </div>

          {/* One full-stage target. The canvas underneath takes no pointer
              events, so this is the only thing a click over the globe can hit. */}
          <Link
            to="/world"
            aria-label="Open the live globe"
            className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FB651E]"
          />

          {/* Live figures, bottom-left; the invitation, bottom-right. The right
              edge stops short of the board's rail from `xl` so the two can
              never share a pixel. */}
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex flex-wrap items-end justify-between gap-2 lg:bottom-6 lg:left-6 lg:right-6 xl:right-[24rem]">
            <div className="flex flex-wrap gap-2">
              <StagePill value={paid.length} label="plots claimed" />
              <StagePill value={countries} label="countries" />
              <StagePill value={stakedCents} label="staked" format={formatDollars} />
              {/* The live one. Same 2.25rem geometry as the pills beside it, so
                  it reads as a fourth figure rather than a badge stuck on —
                  and it disappears entirely rather than printing a zero. */}
              {armed ? (
                <WatchingNow className="min-h-[2.25rem] rounded-sm border border-border/80 bg-card/90 px-3 backdrop-blur-md dark:border-white/10" />
              ) : null}
            </div>
            <span className="hidden items-center gap-1.5 rounded-sm border border-border/80 bg-card/90 px-3 py-2 font-mono text-xs text-muted-foreground backdrop-blur-md sm:inline-flex dark:border-white/10">
              Explore the live globe
              <ArrowRight className="h-3.5 w-3.5 text-[#FB651E]" aria-hidden="true" />
            </span>
          </div>
        </div>

        {/* The board. Floats in the stage's right margin from `xl`; a plain
            full-width card under the globe below that. */}
        <TopStakers
          entries={entries}
          pending={globePending}
          className="z-20 mt-3 xl:col-start-1 xl:row-start-1 xl:mr-5 xl:mt-0 xl:max-h-[calc(100%_-_2.5rem)] xl:w-[21rem] xl:self-center xl:justify-self-end"
        />
      </div>
    </motion.section>
  )
}

export default HomeWorld
