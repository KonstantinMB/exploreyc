import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowDown, ArrowUp, Terminal } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs'
import { cn } from '../../../lib/utils'
import worldApi, {
  type BoardKind,
  type BoardRow,
  type FounderRow,
  type FoundersBoardKind,
} from '../../../lib/worldApi'
import { centsToBeat as centsToBeatFromLeader, formatDollars } from '../constants'
import { CountUp } from './CountUp'
import { isoFlag, shortDate } from './format'

const BOARD_POLL_MS = 15_000

type Move = { dir: 'up' | 'down'; key: number }

/**
 * Tracks rank changes between polls so rows can flash a direction arrow.
 * The arrow + slide together say "moved"; the arrow's direction says which
 * way — never colour alone (WCAG 1.4.1).
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
  if (!move) return <span aria-hidden className="w-3.5 shrink-0" />
  const Icon = move.dir === 'up' ? ArrowUp : ArrowDown
  return (
    <Icon
      aria-label={move.dir === 'up' ? 'moved up' : 'moved down'}
      className={cn(
        'h-3.5 w-3.5 shrink-0',
        move.dir === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
      )}
    />
  )
}

/** Rank numeral; joint ranks (real ties from rank()) print as "=N". */
function RankCell({ rank, joint }: { rank: number; joint: boolean }) {
  return (
    <span className="w-7 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
      {joint ? `=${rank}` : rank}
    </span>
  )
}

function rowValue(kind: BoardKind, row: BoardRow) {
  if (kind === 'rising') {
    // delta_cents null = unknown. Say so — never guess a number.
    if (row.delta_cents == null) {
      return <span className="font-mono text-xs text-muted-foreground">unknown</span>
    }
    return (
      <CountUp
        value={row.delta_cents}
        format={(n) => `+${formatDollars(n)}`}
        className="font-mono text-xs tabular-nums text-[#FB651E]"
      />
    )
  }
  return (
    <CountUp
      value={row.total_cents}
      format={formatDollars}
      className="font-mono text-xs tabular-nums text-foreground"
    />
  )
}

function CountryBoardList({ kind, scope }: { kind: BoardKind; scope: string }) {
  const reduced = useReducedMotion()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['world', 'board', kind, scope],
    queryFn: () => worldApi.getBoard(kind, scope).then((r) => r.data),
    refetchInterval: BOARD_POLL_MS,
  })

  const rows = data?.rows
  const keyed = rows?.map((r) => ({ id: r.plot_id ?? r.iso, rank: r.rank })) ?? undefined
  const moves = useRankMoves(keyed)

  if (isLoading) {
    return (
      <p role="status" className="px-3 py-4 font-mono text-xs text-muted-foreground">
        $ loading board<span className="animate-pulse">…</span>
      </p>
    )
  }
  if (isError || !data) {
    return (
      <p role="alert" className="px-3 py-4 font-mono text-xs text-muted-foreground">
        board unavailable — retrying
      </p>
    )
  }
  if (data.rows.length === 0) {
    return (
      <p className="px-3 py-4 font-mono text-xs text-muted-foreground">
        Nothing staked yet. The first plot takes #1.
      </p>
    )
  }

  return (
    <div>
      <ol className="max-h-64 overflow-y-auto">
        <AnimatePresence initial={false}>
          {data.rows.map((row, i) => {
            const id = row.plot_id ?? row.iso
            const joint = i > 0 && data.rows[i - 1].rank === row.rank
            const to = row.plot_id ? `/world/p/${row.plot_id}` : `/world/c/${row.iso}`
            return (
              <motion.li
                key={id}
                layout={!reduced}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduced ? undefined : { opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <Link
                  to={to}
                  className="flex items-center gap-2 border-b border-border/50 px-3 py-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <RankCell rank={row.rank} joint={joint} />
                  <MoveArrow move={moves[id]} />
                  <span aria-hidden className="shrink-0 text-sm leading-none">
                    {isoFlag(row.iso)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                    {row.name}
                  </span>
                  {rowValue(kind, row)}
                </Link>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ol>
      <div className="border-t border-border px-3 py-2 font-mono text-[11px] text-muted-foreground">
        {kind === 'richest' && (
          data.cents_to_beat != null ? (
            <Link
              to="/world/claim"
              className="text-[#FB651E] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {formatDollars(data.cents_to_beat)} takes #1 →
            </Link>
          ) : (
            <span>price to take #1: unknown</span>
          )
        )}
        {kind === 'planted' && <span>every plot counts — small countries can win this</span>}
        {kind === 'rising' && <span>stakes gained in the last 24h</span>}
      </div>
    </div>
  )
}

function FoundersBoardList({ kind }: { kind: FoundersBoardKind }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['world', 'founders', kind],
    queryFn: () => worldApi.getFounders(kind).then((r) => r.data),
    refetchInterval: BOARD_POLL_MS,
  })

  if (isLoading) {
    return (
      <p role="status" className="px-3 py-4 font-mono text-xs text-muted-foreground">
        $ loading founders<span className="animate-pulse">…</span>
      </p>
    )
  }
  if (isError || !data) {
    return (
      <p role="alert" className="px-3 py-4 font-mono text-xs text-muted-foreground">
        board unavailable — retrying
      </p>
    )
  }
  if (data.rows.length === 0) {
    return (
      <p className="px-3 py-4 font-mono text-xs text-muted-foreground">
        No founders on the board yet. Plant a plot to appear here.
      </p>
    )
  }

  return (
    <ol className="max-h-64 overflow-y-auto">
      {data.rows.map((row: FounderRow, i: number) => {
        const joint = i > 0 && data.rows[i - 1].rank === row.rank
        return (
          <li key={row.plot_id}>
            <Link
              to={`/world/p/${row.plot_id}`}
              className="flex items-center gap-2 border-b border-border/50 px-3 py-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RankCell rank={row.rank} joint={joint} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs font-semibold text-foreground">
                  {row.founder_name || row.name}
                </span>
                <span className="block truncate font-mono text-[11px] leading-tight text-muted-foreground">
                  {row.name}
                </span>
              </span>
              {kind === 'pioneers' ? (
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {shortDate(row.created_at)}
                </span>
              ) : (
                <CountUp
                  value={row.total_cents}
                  format={formatDollars}
                  className="shrink-0 font-mono text-xs tabular-nums text-foreground"
                />
              )}
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

export interface WorldBoardsProps {
  /** 'world' | 'country:XX' — passed through to /api/world/board. */
  scope?: string
  /** Founders tabs are global; hide them on country-scoped panels. */
  includeFounders?: boolean
  className?: string
}

/**
 * Leaderboard panel: countries (richest / planted / rising 24h) and, when
 * global, founders (staked / pioneers). Terminal voice, live rank-slide.
 */
export function WorldBoards({ scope = 'world', includeFounders = true, className }: WorldBoardsProps) {
  return (
    <section
      aria-label="World leaderboards"
      className={cn(
        'overflow-hidden rounded-sm border border-border bg-card/90 backdrop-blur-sm dark:bg-black/70',
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 font-mono text-xs text-muted-foreground">
        <Terminal className="h-3.5 w-3.5 text-[#FB651E]" />
        <span className="truncate">$ exploreyc --world --boards</span>
      </div>
      <Tabs defaultValue="richest">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-0.5 rounded-none border-b border-border bg-transparent p-1">
          <TabsTrigger value="richest" className="px-2 py-1 font-mono text-[11px]">
            richest
          </TabsTrigger>
          <TabsTrigger value="planted" className="px-2 py-1 font-mono text-[11px]">
            planted
          </TabsTrigger>
          <TabsTrigger value="rising" className="px-2 py-1 font-mono text-[11px]">
            rising 24h
          </TabsTrigger>
          {includeFounders && (
            <>
              <TabsTrigger value="staked" className="px-2 py-1 font-mono text-[11px]">
                staked
              </TabsTrigger>
              <TabsTrigger value="pioneers" className="px-2 py-1 font-mono text-[11px]">
                pioneers
              </TabsTrigger>
            </>
          )}
        </TabsList>
        <TabsContent value="richest" className="mt-0">
          <CountryBoardList kind="richest" scope={scope} />
        </TabsContent>
        <TabsContent value="planted" className="mt-0">
          <CountryBoardList kind="planted" scope={scope} />
        </TabsContent>
        <TabsContent value="rising" className="mt-0">
          <CountryBoardList kind="rising" scope={scope} />
        </TabsContent>
        {includeFounders && (
          <>
            <TabsContent value="staked" className="mt-0">
              <FoundersBoardList kind="staked" />
            </TabsContent>
            <TabsContent value="pioneers" className="mt-0">
              <FoundersBoardList kind="pioneers" />
            </TabsContent>
          </>
        )}
      </Tabs>
    </section>
  )
}

/** Re-exported so pages can print the same conversion line the boards use. */
export const centsToBeat = centsToBeatFromLeader

export default WorldBoards
