import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  Sprout,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react'
import { cn } from '../../../lib/utils'
import worldApi, {
  type BoardKind,
  type BoardRow,
  type FounderRow,
  type FoundersBoardKind,
} from '../../../lib/worldApi'
import { formatDollars, MIN_STAKE_CENTS } from '../constants'
import {
  Money,
  Rank,
  WorldButton,
  WorldCard,
  WorldHeading,
  WorldLogo,
  WorldRowButton,
} from '../ui'
import { CountUp } from './CountUp'
import { WorldPodium, type PodiumEntry } from './WorldPodium'
import { countryDisplayName, isoFlag, shortDate } from './format'

const BOARD_POLL_MS = 15_000

type Move = { dir: 'up' | 'down'; key: number }

/**
 * Tracks rank changes between polls so rows can flash a direction arrow.
 * The arrow's *glyph* carries the direction and it has an accessible label —
 * colour is never the only channel (WCAG 1.4.1). Up is the accent, down is
 * muted; there is no second hue in the system to spend on "bad".
 */
function useRankMoves(rows: { id: string; rank: number }[] | undefined) {
  const prev = useRef<Map<string, number>>(new Map())
  const counter = useRef(0)
  const [moves, setMoves] = useState<Record<string, Move>>({})

  useEffect(() => {
    if (!rows) return
    const next: Record<string, Move> = {}
    for (const row of rows) {
      const was = prev.current.get(row.id)
      if (was !== undefined && was !== row.rank) {
        counter.current += 1
        next[row.id] = { dir: row.rank < was ? 'up' : 'down', key: counter.current }
      }
    }
    prev.current = new Map(rows.map((r) => [r.id, r.rank]))
    if (Object.keys(next).length > 0) {
      setMoves((m) => ({ ...m, ...next }))
      const t = setTimeout(() => setMoves({}), 5_000)
      return () => clearTimeout(t)
    }
  }, [rows])

  return moves
}

function MoveArrow({ move }: { move: Move | undefined }) {
  // Reserve the gutter even when a row hasn't moved, so arriving arrows never
  // reflow the name column.
  if (!move) return <span aria-hidden className="w-3.5 shrink-0" />
  const Icon = move.dir === 'up' ? ArrowUp : ArrowDown
  return (
    <Icon
      aria-label={move.dir === 'up' ? 'moved up' : 'moved down'}
      className={cn(
        'h-3.5 w-3.5 shrink-0',
        move.dir === 'up' ? 'text-[#FB651E]' : 'text-muted-foreground'
      )}
    />
  )
}

/**
 * The score cell. `rising` shows a 24h delta, everything else a total.
 *
 * Set in `world-score` — bigger and heavier than the name beside it — because
 * on a leaderboard the number is not a detail of the row, it IS the row. The
 * count-up stays; tabular numerals mean it no longer jitters the column width
 * while it runs.
 */
function RowValue({ kind, row }: { kind: BoardKind; row: BoardRow }) {
  if (kind === 'rising') {
    // delta_cents null = genuinely unknown. Say so — never guess a number.
    if (row.delta_cents == null) return <Money cents={null} />
    return (
      <CountUp
        value={row.delta_cents}
        format={(n) => `+${formatDollars(n)}`}
        className="font-mono text-sm font-bold tabular-nums text-[#FB651E] sm:text-base"
      />
    )
  }
  return (
    <CountUp
      value={row.total_cents}
      format={formatDollars}
      className="font-mono text-sm font-bold tabular-nums text-[#FB651E] sm:text-base"
    />
  )
}

/** Shared shell for the non-row states so they all sit on the same padding. */
function BoardNote({ children, role }: { children: ReactNode; role?: 'status' | 'alert' }) {
  return (
    <p role={role} className="px-4 py-5 text-sm text-muted-foreground">
      {children}
    </p>
  )
}

/**
 * Rows are hairline-divided list items now, not floating cards, so the list
 * carries no gap and no side padding — the row owns both. Same construction as
 * the founders leaderboard, where the whole board is one bordered card and the
 * rows are `border-b` inside it.
 */
const LIST_CLASS = 'world-scroll-list flex flex-col overflow-y-auto overscroll-contain'

/**
 * The tallest a board list may grow before it starts scrolling, in CSS pixels.
 * A ceiling, not the height: the real height is snapped down from here to a
 * whole number of rows (see `useBoardViewport`).
 *
 * Raised from 304 with the medals. Two reasons, and the second is the real one:
 * a row is taller now (the top-three disc is 26px where a bare numeral was ~20)
 * so 304 would have shown one FEWER name than before; and the leaderboard is
 * the reason anyone comes back, so it should be the biggest thing in the rail
 * rather than a five-line teaser. 352 lands the boards card at ~542px which,
 * with the featured rail under it, still fits the 724px the globe rail has
 * between `top-28` and `bottom-16` on a 900px viewport — i.e. more board, and
 * the paid placements below it still do not need scrolling to reach.
 */
const LIST_MAX_PX = 352

/**
 * The same ceiling for the board in its `feature` size.
 *
 * On /world the leaderboard is no longer a 400px rail floating over the globe —
 * it is a centred section with the page to itself, and a five-row teaser in the
 * middle of a 768px column reads as a widget rather than as the thing the page
 * is about. 560px is about ten whole rows, which is enough to show a real
 * standings table without the section outgrowing a laptop viewport.
 */
const FEATURE_LIST_MAX_PX = 560

/**
 * Sizes a board list to a WHOLE number of rows, and says whether more remain.
 *
 * The old rule was a flat `max-h-[19rem]`, which is not a multiple of anything:
 * six 47px rows plus their gaps come to 337px, so the sixth row was sliced
 * through its middle and the board read as a rendering fault rather than as
 * "there is more". A half row is not a scroll affordance — a fade, a real
 * scrollbar and a clean edge between two rows are.
 *
 * Everything is MEASURED, never arithmetic on an assumed row height: rows are
 * one line on the country boards and two on the founders boards, and the type
 * scale is free to move. The first child's box, the flex gap and the list's own
 * padding all come from the live layout, so this stays correct if any of them
 * change. Recomputed on scroll, on resize, and on the 15s poll's row churn; it
 * settles to "no cap, no fade" the moment every row fits.
 */
function useBoardViewport<T extends HTMLElement>(maxPx: number) {
  const [more, setMore] = useState(false)
  // undefined = the list fits, so it keeps its natural height.
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined)
  const teardown = useRef<(() => void) | undefined>(undefined)

  // A CALLBACK ref, not useRef + useEffect. These lists render a "Loading the
  // board…" paragraph first and only swap in the <ol> when the query resolves,
  // so a mount effect with an empty dep array runs while ref.current is still
  // null and then never runs again — the fade silently never appeared. A
  // callback ref fires exactly when the element enters and leaves the DOM.
  const ref = useCallback((el: T | null) => {
    teardown.current?.()
    teardown.current = undefined
    if (!el) {
      setMore(false)
      setMaxHeight(undefined)
      return
    }

    const measure = () => {
      const rows = Array.from(el.children) as HTMLElement[]
      const first = rows[0]
      if (!first) {
        setMaxHeight(undefined)
        setMore(false)
        return
      }
      const style = getComputedStyle(el)
      const gap = parseFloat(style.rowGap) || 0
      const padTop = parseFloat(style.paddingTop) || 0
      const padBottom = parseFloat(style.paddingBottom) || 0
      const rowH = first.getBoundingClientRect().height
      if (rowH <= 0) return

      // Does the whole board fit? Then it keeps its natural height and there
      // is nothing to fade.
      const natural = padTop + rows.length * rowH + (rows.length - 1) * gap + padBottom
      if (natural <= maxPx) {
        setMaxHeight(undefined)
        setMore(false)
        return
      }

      // How many whole rows fit under the ceiling. At least one, always: a
      // board that can only show a single row still shows a whole one.
      //
      // The cut lands in the GAP after the last visible row — hence `fit * gap`
      // and not `(fit - 1) * gap`, and no `padBottom`: bottom padding sits at
      // the far end of the scroll content, not at the viewport's edge, so
      // counting it here left ~6px of the next row's border poking out. Six
      // pixels of a row is still a sliced row.
      const fit = Math.max(1, Math.min(rows.length - 1, Math.floor((maxPx - padTop) / (rowH + gap))))
      setMaxHeight(Math.floor(padTop + fit * rowH + fit * gap))
      // `more` is the live scroll position, not just "it is capped" — scrolling
      // to the bottom must retire the shade, or it reads as content that never
      // ends.
      setMore(el.scrollTop + el.clientHeight < el.scrollHeight - 2)
    }

    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    // Rows arrive and leave with the 15s poll, so watch the subtree too.
    const mo = new MutationObserver(measure)
    mo.observe(el, { childList: true, subtree: true })
    teardown.current = () => {
      el.removeEventListener('scroll', measure)
      ro.disconnect()
      mo.disconnect()
    }
    // `maxPx` is a dependency, not a captured constant: changing the board's
    // size has to re-measure, and a callback ref identity change is exactly
    // how React re-runs one (old(null), then new(el)).
  }, [maxPx])

  return { ref, more, maxHeight }
}

/**
 * The "there is more below" shade.
 *
 * Was a gradient in `var(--w-card)` — a white veil over a white card, which
 * drew nothing at all, so the only thing telling anyone the list continued was
 * the half-row poking out from under the button. Now it is a real scroll
 * shadow (see `.world-scroll-shade`), and it pairs with a visible scrollbar
 * thumb rather than standing in for one.
 *
 * Shorter than it was, too: 32px rather than a whole 48px row. The list now
 * stops on a row boundary, so the shade only has to darken the last row's
 * lower edge; veiling an entire legible row made it look disabled.
 */
function ScrollShade({ show }: { show: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'world-scroll-shade pointer-events-none absolute inset-x-px bottom-0 flex h-8 items-end justify-center',
        'transition-opacity duration-200 motion-reduce:transition-none',
        show ? 'opacity-100' : 'opacity-0'
      )}
    >
      {/* The chevron, and it is doing real work rather than decorating.
          A scrollbar cannot be the signal here: src/index.css hides scrollbars
          app-wide, and even with that overridden macOS draws an OVERLAY bar
          that is invisible until you are already scrolling — which is exactly
          when you no longer need telling. A shade plus a glyph reads as "more
          below" in a still frame, on every platform, in both themes. */}
      <ChevronDown className="mb-0.5 h-3.5 w-3.5 text-muted-foreground" />
    </div>
  )
}

function CountryBoardList({
  kind,
  scope,
  maxPx,
  onClaim,
}: {
  kind: BoardKind
  scope: string
  maxPx: number
  onClaim?: () => void
}) {
  const reduced = useReducedMotion()
  const { ref: listRef, more, maxHeight } = useBoardViewport<HTMLOListElement>(maxPx)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['world', 'board', kind, scope],
    queryFn: () => worldApi.getBoard(kind, scope).then((r) => r.data),
    refetchInterval: BOARD_POLL_MS,
  })

  const rows = data?.rows
  const keyed = rows?.map((r) => ({ id: r.plot_id ?? r.iso, rank: r.rank })) ?? undefined
  const moves = useRankMoves(keyed)

  if (isLoading) return <BoardNote role="status">Counting the money…</BoardNote>
  if (isError || !data) return <BoardNote role="alert">Board unavailable — retrying.</BoardNote>
  if (data.rows.length === 0) {
    // Invite, don't report. An empty board is the cheapest #1 anyone will ever
    // get, and the price is real — MIN_STAKE_CENTS, not a rounded promise.
    return (
      <BoardNote>
        Nobody has staked a cent here yet. {formatDollars(MIN_STAKE_CENTS)} takes #1.
      </BoardNote>
    )
  }

  // The top three come out of the list and onto a podium — crowned #1, medal
  // rings, gold/silver/bronze plinths — exactly as /founders/leaderboard does
  // it. This is the centrepiece of the board, so it only stands down when there
  // are fewer than three rows to put on it.
  const showPodium = data.rows.length >= 3
  const podium: PodiumEntry[] = showPodium
    ? data.rows.slice(0, 3).map((row) => ({
        key: row.plot_id ?? row.iso,
        rank: row.rank,
        to: row.plot_id ? `/world/p/${row.plot_id}` : `/world/c/${row.iso}`,
        name: row.plot_id ? row.name : countryDisplayName(row.iso, row.name),
        caption: row.plot_id ? row.iso : undefined,
        // Plain formatted text: the podium sets the figure's own type and
        // colour, and a delta board still shows a delta.
        value:
          kind === 'rising'
            ? row.delta_cents == null
              ? 'unknown'
              : `+${formatDollars(row.delta_cents)}`
            : formatDollars(row.total_cents),
        valueLabel: kind === 'rising' ? 'Last 24 hours' : 'Total staked',
        flag: row.plot_id ? undefined : isoFlag(row.iso),
        logoUrl: row.logo_url,
      }))
    : []
  const listRows = showPodium ? data.rows.slice(3) : data.rows

  return (
    <div>
      {showPodium ? <WorldPodium entries={podium} /> : null}
      <div className="relative">
      <ol ref={listRef} className={LIST_CLASS} style={{ maxHeight }}>
        <AnimatePresence initial={false}>
          {listRows.map((row, i) => {
            const id = row.plot_id ?? row.iso
            const joint = i > 0 && listRows[i - 1].rank === row.rank
            const to = row.plot_id ? `/world/p/${row.plot_id}` : `/world/c/${row.iso}`
            // Country rows carry no plot_id; those are the ones whose stored
            // name can overflow the column, and the only ones it is ours to
            // shorten — a plot's name belongs to the buyer who typed it.
            const label = row.plot_id ? row.name : countryDisplayName(row.iso, row.name)
            return (
              <motion.li
                key={id}
                layout={!reduced}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduced ? undefined : { opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <WorldRowButton
                  to={to}
                  leading={
                    <>
                      <Rank n={row.rank} joint={joint} />
                      <MoveArrow move={moves[id]} />
                      {/* A country row identifies itself with its flag; a plot
                          row is a company, so it gets the company's real mark
                          when the API has one (plot logo, falling back to the
                          imported ExploreYC thumb) and a letter tile when it
                          does not. Same 24px box either way — see WorldLogo —
                          so a board with mixed artwork keeps one name column. */}
                      {row.plot_id ? (
                        <WorldLogo src={row.logo_url} name={row.name} size={24} />
                      ) : (
                        <span aria-hidden className="text-base leading-none">
                          {isoFlag(row.iso)}
                        </span>
                      )}
                    </>
                  }
                  title={label}
                  trailing={<RowValue kind={kind} row={row} />}
                />
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ol>
        <ScrollShade show={more} />
      </div>

      <div className="border-t border-border p-3">
        {/* THE CONVERSION LINE IS A BUTTON, NOT A ROUTE.
            It used to be a link to the coordinate-picking
            wizard at /world/claim, now deleted. The page that owns this board owns the way in
            instead: on /world that is the country picker below the globe, on a
            country page it is that country's stake modal. */}
        {kind === 'richest' &&
          (data.cents_to_beat != null ? (
            <WorldButton variant="primary" size="md" block onClick={onClaim}>
              <Money cents={data.cents_to_beat} /> takes #1
              <ChevronRight className="h-[1.125rem] w-[1.125rem]" aria-hidden />
            </WorldButton>
          ) : (
            // No leader figure from the API means no price. We say "unknown"
            // and still offer the way in — we do not invent a number to put on
            // a button.
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                Price to take #1: <Money cents={null} />
              </p>
              <WorldButton variant="secondary" size="md" block onClick={onClaim}>
                Claim a plot — from $5
                <ChevronRight className="h-[1.125rem] w-[1.125rem]" aria-hidden />
              </WorldButton>
            </div>
          ))}
        {kind === 'planted' && (
          <p className="text-xs text-muted-foreground">
            One plot, one point. Small countries win this one.
          </p>
        )}
        {kind === 'rising' && (
          <p className="text-xs text-muted-foreground">
            Who moved in the last 24 hours.
          </p>
        )}
      </div>
    </div>
  )
}

function FoundersBoardList({ kind, maxPx }: { kind: FoundersBoardKind; maxPx: number }) {
  const { ref: listRef, more, maxHeight } = useBoardViewport<HTMLOListElement>(maxPx)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['world', 'founders', kind],
    queryFn: () => worldApi.getFounders(kind).then((r) => r.data),
    refetchInterval: BOARD_POLL_MS,
  })

  if (isLoading) return <BoardNote role="status">Rounding up the founders…</BoardNote>
  if (isError || !data) return <BoardNote role="alert">Board unavailable — retrying.</BoardNote>
  if (data.rows.length === 0) {
    return <BoardNote>Nobody is on this board yet. Plant something and it is yours.</BoardNote>
  }

  // Same podium as the countries board and as /founders/leaderboard — the top
  // three founders get the crown, the medals and the big orange figure.
  const showPodium = data.rows.length >= 3
  const podium: PodiumEntry[] = showPodium
    ? data.rows.slice(0, 3).map((row) => ({
        key: row.plot_id,
        rank: row.rank,
        to: `/world/p/${row.plot_id}`,
        name: row.founder_name || row.name,
        caption: row.name,
        value: kind === 'pioneers' ? shortDate(row.created_at) : formatDollars(row.total_cents),
        valueLabel: kind === 'pioneers' ? 'Planted' : 'Total staked',
        logoUrl: row.logo_url,
      }))
    : []
  const listRows = showPodium ? data.rows.slice(3) : data.rows

  return (
    <div>
      {showPodium ? <WorldPodium entries={podium} /> : null}
    <div className="relative">
    <ol ref={listRef} className={LIST_CLASS} style={{ maxHeight }}>
      {listRows.map((row: FounderRow, i: number) => {
        const joint = i > 0 && listRows[i - 1].rank === row.rank
        return (
          <li key={row.plot_id}>
            <WorldRowButton
              to={`/world/p/${row.plot_id}`}
              leading={
                <>
                  <Rank n={row.rank} joint={joint} />
                  <WorldLogo src={row.logo_url} name={row.name} size={24} />
                </>
              }
              title={row.founder_name || row.name}
              subtitle={row.name}
              trailing={
                kind === 'pioneers' ? (
                  <span className="world-num text-xs text-muted-foreground">
                    {shortDate(row.created_at)}
                  </span>
                ) : (
                  <CountUp
                    value={row.total_cents}
                    format={formatDollars}
                    className="font-mono text-sm font-bold tabular-nums text-[#FB651E] sm:text-base"
                  />
                )
              }
            />
          </li>
        )
      })}
    </ol>
      <ScrollShade show={more} />
    </div>
    </div>
  )
}

const COUNTRY_TABS = [
  { id: 'richest', label: 'Richest', icon: DollarSign },
  { id: 'planted', label: 'Planted', icon: Sprout },
  // "Rising", not "Rising 24h": the window is spelled out in the note under the
  // board itself, and the shorter label is what lets all three country tabs sit
  // on one line in the 368px globe rail.
  { id: 'rising', label: 'Rising', icon: TrendingUp },
] as const

const FOUNDER_TABS = [
  { id: 'staked', label: 'Staked', icon: Users },
  { id: 'pioneers', label: 'Pioneers', icon: Clock },
] as const

type TabId = (typeof COUNTRY_TABS)[number]['id'] | (typeof FOUNDER_TABS)[number]['id']

/**
 * One captioned row of the segmented control.
 *
 * The tabs themselves are the platform's segmented control, lifted verbatim
 * from the metric switcher on /founders/leaderboard: an equal-width grid of
 * bordered `rounded-sm` cells with a lucide glyph, muted until selected, and
 * orange-on-orange-tint when it is.
 */
function TabRow({
  label,
  cols,
  children,
}: {
  label: string | null
  cols: 2 | 3
  children: ReactNode
}) {
  return (
    <div>
      {label ? (
        // aria-hidden: the group is a visual affordance, and the tabs already
        // name themselves. Announcing "Countries" between tabs would break the
        // "tab 1 of 5" reading a tablist is supposed to give.
        <span
          aria-hidden="true"
          className="mb-1 block font-mono text-[10px] uppercase tracking-wide text-muted-foreground"
        >
          {label}
        </span>
      ) : null}
      <div className={cn('grid gap-2', cols === 3 ? 'grid-cols-3' : 'grid-cols-2')}>{children}</div>
    </div>
  )
}

export interface WorldBoardsProps {
  /** 'world' | 'country:XX' — passed through to /api/world/board. */
  scope?: string
  /** Founders tabs are global; hide them on country-scoped panels. */
  includeFounders?: boolean
  /**
   * Centrepiece size: a taller list, for the pages where the board has a
   * section to itself rather than a 400px rail beside the globe.
   */
  feature?: boolean
  /**
   * Press on the board's conversion button. The board never navigates on its
   * own any more — the page decides what "claim a plot" means where it stands.
   */
  onClaim?: () => void
  className?: string
}

/**
 * Leaderboard panel: countries (richest / planted / rising 24h) and, when
 * global, founders (staked / pioneers).
 *
 * The tabs are the platform's own segmented control — the one on
 * /founders/leaderboard — so the two leaderboards switch metrics with the same
 * gesture and the same glyph vocabulary.
 */
export function WorldBoards({
  scope = 'world',
  includeFounders = true,
  feature = false,
  onClaim,
  className,
}: WorldBoardsProps) {
  const [tab, setTab] = useState<TabId>('richest')
  const maxPx = feature ? FEATURE_LIST_MAX_PX : LIST_MAX_PX

  // Guard against a founders tab staying selected if the panel is re-rendered
  // country-scoped, which would leave Radix with no matching content.
  const isFounderTab = FOUNDER_TABS.some((t) => t.id === tab)
  const active: TabId = !includeFounders && isFounderTab ? 'richest' : tab

  // The platform's segmented cell, verbatim from FounderLeaderboardPage.
  const tabClass = (id: TabId) =>
    cn(
      'relative flex h-10 items-center justify-center gap-1.5 overflow-hidden rounded-sm border px-2 font-mono text-xs transition-colors sm:gap-2 sm:px-3 sm:text-sm',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FB651E] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      id === active
        ? 'border-[#FB651E]/50 bg-[#FB651E]/[0.12] font-semibold text-[#FB651E]'
        : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
    )

  return (
    <WorldCard as="section" aria-label="World leaderboards" className={cn('overflow-hidden', className)}>
      <TabsPrimitive.Root value={active} onValueChange={(v) => setTab(v as TabId)}>
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4">
          {/* A trophy, because this is a scoreboard and it should say so at a
              glance. aria-hidden: the word "Leaderboard" is right there. */}
          <WorldHeading level={3}>
            <span className="inline-flex items-center gap-2">
              <Trophy className="h-[1.125rem] w-[1.125rem] text-[#FB651E]" aria-hidden />
              Leaderboard
            </span>
          </WorldHeading>
          {/* Two captioned grids rather than one flat strip: countries and
              founders rank different things, which the flat strip never
              admitted. Radix keeps its roving arrow keys across both rows
              because every trigger is still a descendant of the one List. */}
          <TabsPrimitive.List aria-label="Choose a leaderboard" className="flex flex-col gap-2">
            <TabRow label={includeFounders ? 'Countries' : null} cols={3}>
              {COUNTRY_TABS.map((t) => (
                <TabsPrimitive.Trigger key={t.id} value={t.id} className={tabClass(t.id)}>
                  <t.icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">{t.label}</span>
                </TabsPrimitive.Trigger>
              ))}
            </TabRow>
            {includeFounders ? (
              <TabRow label="Founders" cols={2}>
                {FOUNDER_TABS.map((t) => (
                  <TabsPrimitive.Trigger key={t.id} value={t.id} className={tabClass(t.id)}>
                    <t.icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{t.label}</span>
                  </TabsPrimitive.Trigger>
                ))}
              </TabRow>
            ) : null}
          </TabsPrimitive.List>
        </div>

        {COUNTRY_TABS.map((t) => (
          <TabsPrimitive.Content key={t.id} value={t.id} className="mt-0 focus:outline-none">
            <CountryBoardList
              kind={t.id as BoardKind}
              scope={scope}
              maxPx={maxPx}
              onClaim={onClaim}
            />
          </TabsPrimitive.Content>
        ))}
        {includeFounders &&
          FOUNDER_TABS.map((t) => (
            <TabsPrimitive.Content key={t.id} value={t.id} className="mt-0 focus:outline-none">
              <FoundersBoardList kind={t.id as FoundersBoardKind} maxPx={maxPx} />
            </TabsPrimitive.Content>
          ))}
      </TabsPrimitive.Root>
    </WorldCard>
  )
}

export default WorldBoards
