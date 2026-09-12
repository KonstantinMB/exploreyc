/**
 * "Who is paying the most" — the plot-scoped leaderboard.
 *
 * WHY IT IS NOT <StageBoard>. Every existing world-scope board ranks
 * COUNTRIES: `/api/world/board?scope=world` aggregates stakes per country, and
 * its rows carry no logo and no plot id by construction (see
 * `get_world_country_board`). That is the right board for "which country is
 * winning" and the wrong one for the thing a customer actually buys, which is
 * their own logo in front of other people. The owner's words were "promote
 * people who bid the most" — people, not places — so this board ranks PLOTS.
 *
 * WHERE THE ROWS COME FROM. The paid layer of `/api/world/globe`, ordered by
 * stake, which is exactly the definition of a world plot rank. The caller
 * enriches each row with the per-plot read it was already making for the
 * billboard, so the country line costs no extra request and the rank is the
 * server's own `rank_world` wherever that read has landed. Nothing is computed
 * that the API did not send: a plot whose detail is still in flight shows no
 * country line at all rather than a guessed one, and an absent amount prints
 * "unknown" through <Money> rather than a zero.
 *
 * THE TOP THREE GET THE PLATFORM'S PODIUM — <WorldPodium compact>, the same
 * crown, the same gold/silver/bronze ring and plinth the founders leaderboard
 * and the country boards wear. A board that invented its own #1 treatment would
 * be a fourth leaderboard idiom on a product that already has three.
 *
 * ZERO PLOTS IS THE LAUNCH-DAY TRUTH, and it renders as an invitation with a
 * real price on it — never a greyed-out row, never a placeholder logo, never a
 * fake company. An empty board is the cheapest #1 anyone will ever get and
 * saying so is the best sales line this product has.
 */

import { Link } from 'react-router-dom'
import { Plus, Trophy } from 'lucide-react'

import { cn } from '../../../lib/utils'
import { MIN_STAKE_CENTS, centsToBeat, formatDollars } from '../constants'
import {
  Money,
  Rank,
  WorldCard,
  WorldLogo,
  WorldRowButton,
  WORLD_FOCUS_CLASS,
  WORLD_OVERLAY_SURFACE,
} from '../ui'
import { WorldPodium, type PodiumEntry } from './WorldPodium'
import { countryDisplayName, isoFlag } from './format'

/**
 * One ranked stake. Everything optional is optional because the API genuinely
 * may not have it yet — `null` here always means "we do not know", never "zero".
 */
export interface StakerEntry {
  /** world_plots.id — the row's route and its React key. */
  id: string
  /** `rank_world` when the detail read has landed, else the stake order. */
  rank: number
  name: string
  logoUrl: string | null
  /** Integer cents. null prints "unknown". */
  cents: number | null
  countryIso: string | null
  countryName: string | null
}

export interface TopStakersProps {
  /** Stake-ordered, already sliced to what should be shown. */
  entries: StakerEntry[]
  /** The globe feed has not answered yet — say so instead of saying "empty". */
  pending?: boolean
  className?: string
}

/** The second line of a row: a flag and a country, or nothing at all. */
function placeLine(entry: StakerEntry) {
  if (!entry.countryName) return undefined
  const iso = (entry.countryIso ?? '').toUpperCase()
  return (
    <>
      {iso.length === 2 ? <span aria-hidden>{isoFlag(iso)} </span> : null}
      {countryDisplayName(iso, entry.countryName)}
    </>
  )
}

/**
 * The last row is always the offer.
 *
 * It is a row and not a button because it belongs to the standings: "here is
 * the board, and here is the line you are not on yet". It prints NO rank —
 * this board shows the top few of a longer list, so "you would be #8" is a
 * number nobody can stand behind. The price is the floor the server enforces.
 */
function VacantRow() {
  return (
    <Link
      to="/world"
      className={cn(
        WORLD_FOCUS_CLASS,
        'group flex w-full items-center gap-2.5 border-t border-[#FB651E]/25 bg-[#FB651E]/[0.04] px-3.5 py-2.5',
        'transition-colors duration-150 hover:bg-[#FB651E]/[0.1] motion-reduce:transition-none',
      )}
    >
      <span
        aria-hidden
        className="grid h-6 w-6 flex-none place-items-center rounded-sm border border-dashed border-[#FB651E]/50 text-[color:var(--w-accent-ink)]"
      >
        <Plus className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-foreground">
        Your logo here
      </span>
      <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-[color:var(--w-accent-ink)]">
        {formatDollars(MIN_STAKE_CENTS)}
      </span>
    </Link>
  )
}

export function TopStakers({ entries, pending = false, className }: TopStakersProps) {
  // Three is the podium's own floor (<WorldPodium> renders nothing below it),
  // and the same rule the country and founders boards use.
  const showPodium = entries.length >= 3
  const podium: PodiumEntry[] = showPodium
    ? entries.slice(0, 3).map((e) => ({
        key: e.id,
        rank: e.rank,
        to: `/world/p/${e.id}`,
        name: e.name,
        caption: e.countryName
          ? countryDisplayName(e.countryIso, e.countryName)
          : undefined,
        // A plain string: the podium owns the figure's type and colour, and
        // <Money>'s own classes would fight it. "unknown" is a word, not a
        // number, exactly as <Money cents={null}> would print.
        value: e.cents == null ? 'unknown' : formatDollars(e.cents),
        valueLabel: 'Total staked',
        logoUrl: e.logoUrl,
      }))
    : []
  const rows = showPodium ? entries.slice(3) : entries

  // What a challenger must stake to take rank 1 among plots. Mirrors the
  // server's OVERTAKE_MARGIN_CENTS rule; a null leader amount gives null, and
  // the line simply does not render rather than guessing a price. The empty
  // board never shows it either — the invitation above already carries the
  // one price there is, and printing it twice reads as two different offers.
  const toBeat = entries.length > 0 ? centsToBeat(entries[0].cents) : null

  return (
    <WorldCard
      as="section"
      flat
      aria-label="Biggest stakes on the globe"
      className={cn('flex min-h-0 flex-col overflow-hidden', WORLD_OVERLAY_SURFACE, className)}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2">
        <h3 className="inline-flex items-center gap-1.5 font-mono text-xs font-bold">
          <Trophy className="h-3.5 w-3.5 text-[#FB651E]" aria-hidden />
          Biggest stakes on Earth
        </h3>
        <Link
          to="/world"
          className={`${WORLD_FOCUS_CLASS} rounded-sm font-mono text-[10px] uppercase tracking-wide text-muted-foreground transition-colors hover:text-[#FB651E] motion-reduce:transition-none`}
        >
          Full board
        </Link>
      </div>

      {pending && entries.length === 0 ? (
        <p role="status" className="px-3.5 py-4 font-mono text-xs text-muted-foreground">
          Counting the money…
        </p>
      ) : entries.length === 0 ? (
        /* Invite, don't report. The price is the floor the server enforces,
           not a rounded promise — and there is no fake row anywhere near it. */
        <div className="px-3.5 py-4">
          <p className="font-mono text-sm font-bold leading-snug">
            No logos on the globe yet.
          </p>
          <p className="mt-1.5 font-mono text-xs leading-snug text-muted-foreground">
            Nobody has staked a cent anywhere on Earth.{' '}
            <Money cents={MIN_STAKE_CENTS} className="text-[color:var(--w-accent-ink)]" /> takes #1 — and holds it
            until somebody outstakes you.
          </p>
          <Link
            to="/world"
            className={`${WORLD_FOCUS_CLASS} mt-3 inline-flex items-center gap-1.5 rounded-sm border border-[#FB651E]/50 bg-[#FB651E]/[0.06] px-3 py-2 font-mono text-xs font-bold text-[color:var(--w-accent-ink)] transition-colors hover:bg-[#FB651E]/[0.12] motion-reduce:transition-none`}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Be the first on the board
          </Link>
        </div>
      ) : (
        <>
          {showPodium ? <WorldPodium entries={podium} compact className="border-b-0" /> : null}
          <ol className="flex min-h-0 flex-col overflow-y-auto overscroll-contain">
            {rows.map((e, i) => {
              const joint = i > 0 && rows[i - 1].rank === e.rank
              return (
                <li key={e.id}>
                  <WorldRowButton
                    to={`/world/p/${e.id}`}
                    className="gap-2.5 border-t border-border/50 border-b-0 px-3.5 py-2 sm:gap-2.5 sm:px-3.5"
                    leading={
                      <>
                        <Rank
                          n={e.rank}
                          joint={joint}
                          className="h-6 min-w-6 text-[11px] sm:h-6 sm:min-w-6 sm:text-[11px]"
                        />
                        <WorldLogo src={e.logoUrl} name={e.name} size={22} />
                      </>
                    }
                    title={e.name}
                    subtitle={placeLine(e)}
                    showChevron={false}
                    trailing={<Money cents={e.cents} score className="text-sm sm:text-sm" />}
                  />
                </li>
              )
            })}
          </ol>
          <VacantRow />
        </>
      )}

      {toBeat != null ? (
        <p className="border-t border-border px-3.5 py-1.5 font-mono text-[11px] text-muted-foreground">
          <Money cents={toBeat} className="text-[color:var(--w-accent-ink)]" /> takes #1 in the world
        </p>
      ) : null}
    </WorldCard>
  )
}

export default TopStakers
