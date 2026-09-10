/**
 * The top-three podium — the World's half of the platform's leaderboard idiom.
 *
 * This is deliberately a near-copy of <FounderPodium> in
 * src/pages/FounderLeaderboardPage.tsx, which is the page the owner named as
 * the reference: classic 2-1-3 ordering, a crown over #1, a medal-gradient ring
 * around the mark, a small numbered badge on its corner, the name, a mono
 * caption, a big orange figure, a tiny uppercase label under it, and a
 * gold/silver/bronze bar beneath the whole tile. The two boards have to be
 * recognisably the same object or the "one product" illusion breaks on exactly
 * the screen where somebody compares them.
 *
 * It is generic over what a "row" is, because the World ranks three different
 * things with it — countries (a flag), plots (a company mark) and founders (a
 * company mark) — and all three deserve the same treatment. The caller
 * normalises into <PodiumEntry>; nothing here knows about the board APIs.
 *
 * `compact` is the version that sits on the 3D map: same anatomy, smaller
 * marks, no bar, tuned to survive on top of a spinning globe.
 */

import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Crown } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { Avatar } from '../../ui/Avatar'
import { MEDALS } from '../ui'

/** Render 2nd, 1st, 3rd — the classic podium, same as the founders board. */
const PODIUM_ORDER = [1, 0, 2]

export interface PodiumEntry {
  /** React key + identity. */
  key: string
  /** 1, 2 or 3. Drives the metal, the crown and the badge. */
  rank: number
  /** Where the tile navigates. */
  to: string
  /** Primary line. */
  name: string
  /** Mono second line — a role, a country, a plot count. */
  caption?: string
  /** The headline figure. Already formatted; usually a <Money> or a <CountUp>. */
  value: React.ReactNode
  /** The tiny uppercase label under the figure. */
  valueLabel: string
  /** A company/plot mark, when there is one. */
  logoUrl?: string | null
  /** A flag emoji, for a country. Takes precedence over `logoUrl`. */
  flag?: string
}

/** The circular mark: a flag tile for a country, the platform Avatar otherwise. */
function PodiumMark({ entry, size }: { entry: PodiumEntry; size: number }) {
  if (entry.flag) {
    return (
      <span
        aria-hidden
        className="grid place-items-center rounded-full border border-border bg-muted/40 leading-none"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.52) }}
      >
        {entry.flag}
      </span>
    )
  }
  return <Avatar src={entry.logoUrl ?? undefined} name={entry.name} size={size} />
}

export interface WorldPodiumProps {
  /** Exactly the top three, in rank order. Fewer than three renders nothing. */
  entries: PodiumEntry[]
  /** The globe-overlay size: smaller marks, no plinth bar. */
  compact?: boolean
  className?: string
}

export function WorldPodium({ entries, compact = false, className }: WorldPodiumProps) {
  // The rise-and-settle is a flourish over content that is already complete, so
  // with reduced motion the tiles simply appear. (The platform's own founders
  // podium does not gate this; the World's does.)
  const reduced = useReducedMotion()
  if (entries.length < 3) return null

  return (
    <div
      className={cn(
        'border-b border-border/60 bg-gradient-to-b from-[#FB651E]/[0.05] to-transparent',
        compact ? 'px-3 pb-3 pt-7' : 'px-4 pb-5 pt-9',
        className
      )}
    >
      <div
        className={cn(
          'mx-auto grid grid-cols-3 items-end',
          compact ? 'max-w-sm gap-1.5' : 'max-w-2xl gap-2 sm:gap-4'
        )}
      >
        {PODIUM_ORDER.map((idx, i) => {
          const entry = entries[idx]
          if (!entry) return <div key={i} />
          const rank = entry.rank
          const isFirst = rank === 1
          const medal = MEDALS[Math.min(Math.max(rank, 1), 3) - 1]
          const markSize = compact ? (isFirst ? 40 : 32) : isFirst ? 66 : 50
          return (
            <motion.div
              key={entry.key}
              initial={reduced ? false : { opacity: 0, y: 26, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { delay: 0.1 + i * 0.1, type: 'spring', stiffness: 220, damping: 20 }
              }
              className={cn(
                'relative flex flex-col items-center',
                isFirst && !compact && 'sm:-mt-6',
                isFirst && compact && '-mt-4'
              )}
            >
              <Link
                to={entry.to}
                className={cn(
                  'group flex w-full flex-col items-center rounded-sm border bg-background/70 text-center',
                  'transition-all duration-300 hover:-translate-y-1 motion-reduce:hover:translate-y-0',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FB651E] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  compact ? 'px-1.5 pb-2 pt-4' : 'px-2 pb-3 pt-5'
                )}
                style={{
                  borderColor: isFirst ? medal : 'hsl(var(--border))',
                  boxShadow: isFirst
                    ? `0 0 0 1px ${medal}55, 0 14px 44px -14px ${medal}88`
                    : undefined,
                }}
              >
                {isFirst && (
                  <Crown
                    className={cn('absolute drop-shadow', compact ? '-top-2.5 h-4 w-4' : '-top-3.5 h-6 w-6')}
                    style={{ color: medal, fill: `${medal}33` }}
                    aria-hidden
                  />
                )}
                <div className="relative">
                  {isFirst && (
                    <span
                      aria-hidden
                      className="absolute inset-0 -m-1 animate-ping rounded-full motion-reduce:animate-none"
                      style={{ backgroundColor: `${medal}22` }}
                    />
                  )}
                  <div
                    className="rounded-full p-[2px]"
                    style={{ background: `linear-gradient(135deg, ${medal}, transparent)` }}
                  >
                    <PodiumMark entry={entry} size={markSize} />
                  </div>
                  <span
                    className={cn(
                      'absolute -bottom-1 -right-1 flex items-center justify-center rounded-full font-mono font-black text-black shadow',
                      compact ? 'h-4 w-4 text-[9px]' : 'h-5 w-5 text-[10px]'
                    )}
                    style={{ backgroundColor: medal }}
                  >
                    <span className="sr-only">Rank </span>
                    {rank}
                  </span>
                </div>
                {/* Two lines, not one. A podium tile is a third of its
                    container, and at 375px (or in the compact map card) that is
                    ~110px — "United Kingdom" ellipsed to "United…" on both,
                    which makes the top of the board unreadable on exactly the
                    surfaces that most need it. Wrapping costs a row of height
                    and keeps the name whole. */}
                <div
                  className={cn(
                    'mt-2.5 line-clamp-2 w-full font-bold leading-tight group-hover:text-[#FB651E]',
                    compact ? 'text-[11px]' : 'text-sm'
                  )}
                >
                  {entry.name}
                </div>
                {entry.caption ? (
                  <div className="mb-1 line-clamp-1 w-full font-mono text-[10px] text-muted-foreground">
                    {entry.caption}
                  </div>
                ) : (
                  <div className="mb-1 h-[15px]" aria-hidden />
                )}
                <div
                  className={cn(
                    'font-mono font-black tabular-nums',
                    compact ? 'text-xs' : 'text-base',
                    isFirst ? 'text-[#FB651E]' : 'text-foreground'
                  )}
                >
                  {entry.value}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">
                  {entry.valueLabel}
                </div>
              </Link>
              {compact ? null : (
                <div
                  aria-hidden
                  className="mt-1.5 w-full rounded-b-sm"
                  style={{
                    height: isFirst ? 24 : 14,
                    background: `linear-gradient(${medal}, ${medal}99)`,
                  }}
                />
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

export default WorldPodium
