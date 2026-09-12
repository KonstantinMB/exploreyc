/**
 * ExploreYC World, on the homepage — the paid surface, sold instead of described.
 *
 * WHAT THIS REPLACES. The old `#world` band was a headline, a paragraph and a
 * numbered list of three sentences. The owner's verdict on it was "the anchors
 * is invisible": a text-only band about a 3D globe, on a page made of other
 * text-only bands, is indistinguishable from the rest of the page. So the band
 * is gone and the thing itself is here — the live globe, the logos of the
 * companies that paid to be on it, and one price.
 *
 * THE THREE-JS BILL IS NEVER PAID BY A BOUNCER. `three` + the scene is a ~1 MB
 * chunk and the coarse world atlas another 108 kB. None of it — and none of the
 * globe feed either — is requested until this section is within 400 px of the
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
 * HONESTY. Every number on this section is derived from data the API actually
 * returns — plots claimed and dollars staked are counted off the paid layer of
 * /api/world/globe, countries claimed is the row count of /api/world/board.
 * Nothing here prints a visitor count, a view count or a watcher count, because
 * we do not track any of those. And with zero paid plots — the launch-day
 * reality — the billboard does not render placeholder logos pretending to be
 * customers; it renders the offer.
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
import { ArrowRight, Earth, Plus, Trophy } from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import { cn } from '../../lib/utils'
import worldApi, { type GlobePin, type WorldPlot } from '../../lib/worldApi'
import { MIN_STAKE_CENTS, formatDollars } from '../world/constants'
import { CountUp } from '../world/boards/CountUp'
import { Money, Rank, WorldChip, WorldLogo } from '../world/ui'
import { LazyWorldGlobe } from '../../pages/world/worldLazy'

/** How many bought plots get a billboard tile. */
const BILLBOARD_LIMIT = 7

/** Detail reads are cheap and amounts move slowly. */
const DETAIL_STALE_MS = 30_000

/** Empty array identity, so `pins` is stable while the feed is in flight. */
const NO_PINS: GlobePin[] = []

/**
 * ISO-3166 alpha-2 → flag emoji. Returns null rather than a guess for anything
 * that is not two ASCII letters, so a bad code renders no flag instead of a
 * wrong one.
 */
function flagFor(iso: string | null | undefined): string | null {
  if (!iso || iso.length !== 2) return null
  const cc = iso.toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return null
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

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
        className="h-full w-full scale-[2.1] object-cover blur-[3px] opacity-70 dark:opacity-30"
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
   The billboard
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * One company that paid, at billboard size.
 *
 * The mark is 56 px and it is the first thing in the tile, because the logo is
 * the thing being bought. Rank, country and stake are printed only where the
 * API gave them: rank falls back to the plot's position in the stake-ordered
 * feed (which is what a world rank is), the flag row disappears entirely when
 * the detail read has not landed, and <Money> prints "unknown" rather than a
 * guess if an amount is ever missing.
 */
function BillboardTile({
  pin,
  plot,
  fallbackRank,
}: {
  pin: GlobePin
  plot: WorldPlot | undefined
  fallbackRank: number
}) {
  const name = plot?.name ?? pin.name
  const logo = plot?.logo_url ?? pin.logo_url ?? null
  const cents = plot?.total_cents ?? pin.total_cents ?? null
  const rank = plot?.rank_world ?? fallbackRank
  const flag = flagFor(plot?.country_iso)
  const place = plot?.city_name || plot?.country_name || null
  const promoted = plot?.promoted ?? pin.promoted

  return (
    <Link
      to={`/world/p/${pin.id}`}
      className={cn(
        'group flex h-full w-full min-w-0 flex-col gap-3 rounded-sm border border-border bg-card/50 p-4',
        'transition-all duration-300 hover:-translate-y-0.5 hover:border-[#FB651E]/60',
        'hover:shadow-[0_0_24px_rgba(251,101,30,0.16)] motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FB651E] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'dark:border-white/10 dark:bg-white/[0.02]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <WorldLogo src={logo} name={name} size={56} />
        <Rank n={rank} />
      </div>
      <div className="min-w-0">
        <p className="truncate font-mono text-sm font-bold leading-tight transition-colors group-hover:text-[#FB651E] sm:text-base">
          {name}
        </p>
        {place ? (
          <p className="truncate font-mono text-xs text-muted-foreground">
            {flag ? <span aria-hidden="true">{flag} </span> : null}
            {place}
          </p>
        ) : null}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
        <Money cents={cents} score />
        {promoted ? (
          <WorldChip tone="promoted" />
        ) : (
          <ArrowRight
            className="h-4 w-4 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-[#FB651E] motion-reduce:transition-none"
            aria-hidden="true"
          />
        )}
      </div>
    </Link>
  )
}

/** The one empty pitch that always ends the billboard. Never a fake company. */
function VacantTile() {
  return (
    <Link
      to="/world"
      className={cn(
        'group flex h-full w-full min-w-0 flex-col gap-3 rounded-sm border border-dashed border-[#FB651E]/45 bg-[#FB651E]/[0.04] p-4',
        'transition-colors duration-200 hover:border-[#FB651E] hover:bg-[#FB651E]/[0.09] motion-reduce:transition-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FB651E] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      )}
    >
      <span
        aria-hidden="true"
        className="grid h-14 w-14 place-items-center rounded-sm border-2 border-dashed border-[#FB651E]/50 text-[#FB651E]"
      >
        <Plus className="h-6 w-6" />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-mono text-sm font-bold leading-tight text-foreground sm:text-base">
          Your logo here
        </span>
        <span className="block truncate font-mono text-xs text-muted-foreground">
          Any country on Earth
        </span>
      </span>
      <span className="mt-auto flex items-center justify-between gap-2 border-t border-[#FB651E]/25 pt-3 font-mono text-sm font-bold text-[#FB651E]">
        {formatDollars(MIN_STAKE_CENTS)}
        <ArrowRight
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </span>
    </Link>
  )
}

/**
 * Launch day: nobody has bought anything.
 *
 * Three grey ghosts in a grid would read as a page that failed to load. One
 * deliberate offer does not — and it says only what is true, which is that the
 * planet is empty and the first plot is #1 until it is outstaked.
 */
function FirstPlotPanel() {
  return (
    <div className="rounded-sm border border-[#FB651E]/40 bg-[#FB651E]/[0.05] p-5 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <WorldChip tone="accent" className="mb-3">
            Every country still open
          </WorldChip>
          <p className="font-mono text-xl font-bold leading-tight sm:text-2xl">
            No logos on the globe yet.
          </p>
          <p className="mt-1.5 font-mono text-sm text-muted-foreground">
            The first one is #1 until somebody outstakes it.
          </p>
        </div>
        <Link
          to="/world"
          className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-sm border border-[#FB651E] bg-[#FB651E] px-5 py-3 font-mono text-sm font-bold text-white transition-colors hover:bg-[#E65C00] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FB651E] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Be the first — {formatDollars(MIN_STAKE_CENTS)}
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </Link>
      </div>
    </div>
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

  const { data: globe } = useQuery({
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

  const shown = useMemo(() => paid.slice(0, BILLBOARD_LIMIT), [paid])

  const details = useQueries({
    queries: shown.map((pin) => ({
      queryKey: ['world', 'plot', pin.id],
      queryFn: () => worldApi.getPlot(pin.id).then((r) => r.data),
      staleTime: DETAIL_STALE_MS,
    })),
  })

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
    () => (leader ? { lat: leader.lat, lng: leader.lng, distance: 3.1 } : undefined),
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
        THE PITCH AND THE GLOBE SHARE ONE CELL FROM `lg`.

        Both children are placed in row 1 / column 1 of a single-column grid, so
        above `lg` they occupy the same box and the copy sits in the stage's
        left margin — which is dead space otherwise, because a sphere in a wide,
        short box is sized by the box's HEIGHT and leaves a third of the width
        empty on each side. Below `lg` the grid auto-places them as two rows and
        the copy is simply a heading above a globe. One set of markup, two
        compositions, no duplicated CTA.
      */}
      <div className="grid">
        <div className="relative z-20 mb-4 min-w-0 lg:col-start-1 lg:row-start-1 lg:mb-0 lg:max-w-[22rem] lg:self-center lg:p-6 xl:max-w-sm">
          <div className="mb-2 flex items-center gap-2 font-mono text-sm text-muted-foreground">
            <Earth className="h-4 w-4 text-[#FB651E]" />
            <span>$ exploreyc --world</span>
          </div>
          <h2 className="font-mono text-2xl font-bold leading-tight md:text-3xl">
            <span className="text-[#FB651E]">&gt;</span> Put your startup on the globe
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
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
            <Link
              to="/world"
              className="inline-flex items-center gap-2 rounded-sm border border-border bg-background/70 px-4 py-3 font-mono text-sm backdrop-blur transition-colors hover:border-[#FB651E]/50 motion-reduce:transition-none"
            >
              <Trophy className="h-4 w-4 text-[#FB651E]" aria-hidden="true" />
              See the board
            </Link>
          </div>
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">
            No prize, no payout, no refund.
          </p>
        </div>

        {/* The stage. */}
        <div
          className="relative isolate overflow-hidden rounded-sm border border-border bg-muted/20 lg:col-start-1 lg:row-start-1 dark:border-white/10"
          style={{ height: 'clamp(17rem, 44vw, 30rem)' }}
        >
          {/* The canvas gives up the left third from `lg`, so the sphere
              centres in what is left rather than under the copy. */}
          <div className="absolute inset-0 lg:left-[30%]">
            <GlobeStage pins={pins} armed={armed} focus={focus} />
          </div>

          {/* One full-stage target. The canvas underneath takes no pointer
              events, so this is the only thing a click over the globe can hit. */}
          <Link
            to="/world"
            aria-label="Open the live globe"
            className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FB651E]"
          />

          {/* Live figures, bottom-left; the invitation, bottom-right. */}
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex flex-wrap items-end justify-between gap-2 lg:bottom-6 lg:left-[32%] lg:right-6">
            <div className="flex flex-wrap gap-2">
              <StagePill value={paid.length} label="plots claimed" />
              <StagePill value={countries} label="countries" />
              <StagePill value={stakedCents} label="staked" format={formatDollars} />
            </div>
            <span className="hidden items-center gap-1.5 rounded-sm border border-border/80 bg-card/90 px-3 py-2 font-mono text-xs text-muted-foreground backdrop-blur-md sm:inline-flex dark:border-white/10">
              Explore the live globe
              <ArrowRight className="h-3.5 w-3.5 text-[#FB651E]" aria-hidden="true" />
            </span>
          </div>
        </div>
      </div>

      {/* The billboard. */}
      <div className="mt-4">
        {shown.length === 0 ? (
          <FirstPlotPanel />
        ) : (
          <ul className="grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((pin, i) => (
              <li key={pin.id} className="flex min-w-0">
                <BillboardTile pin={pin} plot={details[i]?.data} fallbackRank={i + 1} />
              </li>
            ))}
            <li className="flex min-w-0">
              <VacantTile />
            </li>
          </ul>
        )}
      </div>
    </motion.section>
  )
}

export default HomeWorld
