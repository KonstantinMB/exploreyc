/**
 * The podium, ON the globe.
 *
 * The owner asked for the leaderboard's podium to reach the 3D map surface, and
 * this is it: the three countries with the most staked in them, crowned and
 * medalled, sitting on the glass in the corner of the globe stage. It is the
 * loudest thing on the map after the pins themselves, which is the point — the
 * board is what people come back for, so the map should show who is winning it
 * without anyone having to scroll.
 *
 * It renders NOTHING until there are three ranked countries. An empty or
 * half-full podium floating over a globe reads as a rendering fault, and the
 * page already has an honest empty state further down.
 */

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { cn } from '../../../lib/utils'
import worldApi from '../../../lib/worldApi'
import { formatDollars } from '../constants'
import { WorldCard, WORLD_OVERLAY_SURFACE } from '../ui'
import { WorldPodium, type PodiumEntry } from './WorldPodium'
import { countryDisplayName, isoFlag } from './format'

const POLL_MS = 30_000

export function GlobePodium({ className }: { className?: string }) {
  const { data } = useQuery({
    queryKey: ['world', 'board', 'richest', 'world'],
    queryFn: () => worldApi.getBoard('richest', 'world').then((r) => r.data),
    refetchInterval: POLL_MS,
  })

  const rows = data?.rows ?? []
  if (rows.length < 3) return null

  const entries: PodiumEntry[] = rows.slice(0, 3).map((row) => ({
    key: row.plot_id ?? row.iso,
    rank: row.rank,
    to: row.plot_id ? `/world/p/${row.plot_id}` : `/world/c/${row.iso}`,
    name: row.plot_id ? row.name : countryDisplayName(row.iso, row.name),
    value: formatDollars(row.total_cents),
    valueLabel: 'Staked',
    flag: row.plot_id ? undefined : isoFlag(row.iso),
    logoUrl: row.logo_url,
  }))

  return (
    <WorldCard
      flat
      aria-label="Top three countries"
      className={cn('overflow-hidden', WORLD_OVERLAY_SURFACE, className)}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold">
          <Trophy className="h-3.5 w-3.5 text-[#FB651E]" aria-hidden />
          Top of the world
        </span>
        <Link
          to="#board"
          className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground transition-colors hover:text-[#FB651E]"
        >
          Full board
        </Link>
      </div>
      <WorldPodium entries={entries} compact className="border-b-0" />
    </WorldCard>
  )
}

export default GlobePodium
