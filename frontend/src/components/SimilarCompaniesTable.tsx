import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  ExternalLink,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Briefcase,
  Users,
  MapPin,
} from 'lucide-react'
import type { SimilarCompany } from '../lib/api'
import { CompanyDetailModal } from './CompanyDetailModal'

type SortKey = 'match' | 'name' | 'batch' | 'team'
type SortDir = 'asc' | 'desc'

const SEASON_ORDER: Record<string, number> = { Winter: 0, Spring: 1, Summer: 2, Fall: 3 }
function batchValue(batch?: string): number {
  if (!batch) return 0
  const parts = batch.split(' ')
  const year = Number(parts[parts.length - 1]) || 0
  const season = SEASON_ORDER[parts[0]] ?? 0
  return year * 10 + season
}

function matchClass(score: number): string {
  if (score >= 0.8) return 'text-red-500 border-red-500/40 bg-red-500/10'
  if (score >= 0.6) return 'text-[#FB651E] border-[#FB651E]/40 bg-[#FB651E]/10'
  return 'text-amber-500 border-amber-500/40 bg-amber-500/10'
}

export function SimilarCompaniesTable({ companies }: { companies: SimilarCompany[] }) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('match')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [active, setActive] = useState<SimilarCompany | null>(null)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? companies.filter((c) =>
          [c.name, c.one_liner, c.industry, c.batch, c.country]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)),
        )
      : companies
    const dir = sortDir === 'asc' ? 1 : -1
    const val = (c: SimilarCompany): number | string => {
      switch (sortKey) {
        case 'name':
          return c.name?.toLowerCase() ?? ''
        case 'batch':
          return batchValue(c.batch)
        case 'team':
          return c.team_size ?? 0
        default:
          return c.similarity_score ?? 0
      }
    }
    return [...filtered].sort((a, b) => {
      const av = val(a)
      const bv = val(b)
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [companies, query, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (col !== sortKey) return <ArrowUpDown className="h-3 w-3 opacity-40" />
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
  }

  const th =
    'px-3 py-2.5 text-left font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'
  const sortableTh = `${th} cursor-pointer select-none hover:text-[#FB651E] transition-colors`

  return (
    <div className="space-y-3">
      {/* toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-mono text-lg font-semibold">
          Similar companies <span className="text-muted-foreground">({companies.length})</span>
        </h2>
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, industry, batch…"
            className="w-full rounded-lg border border-border bg-background/70 py-2 pl-9 pr-3 font-mono text-sm outline-none transition-colors focus:border-[#FB651E]/60"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card/40">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-background/40">
              <th className={`${th} w-10 text-center`}>#</th>
              <th className={sortableTh} onClick={() => toggleSort('name')}>
                <span className="inline-flex items-center gap-1">Company <SortIcon col="name" /></span>
              </th>
              <th className={`${sortableTh} text-right`} onClick={() => toggleSort('match')}>
                <span className="inline-flex items-center gap-1">Match <SortIcon col="match" /></span>
              </th>
              <th className={`${sortableTh} hidden md:table-cell`} onClick={() => toggleSort('batch')}>
                <span className="inline-flex items-center gap-1">Batch <SortIcon col="batch" /></span>
              </th>
              <th className={`${th} hidden lg:table-cell`}>Industry</th>
              <th className={`${sortableTh} hidden lg:table-cell text-right`} onClick={() => toggleSort('team')}>
                <span className="inline-flex items-center gap-1">Team <SortIcon col="team" /></span>
              </th>
              <th className={`${th} hidden xl:table-cell`}>Location</th>
              <th className={`${th} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => (
              <tr
                key={c.id}
                onClick={() => setActive(c)}
                className="group cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-[#FB651E]/[0.04]"
              >
                <td className="px-3 py-3 text-center font-mono text-xs text-muted-foreground/60">{i + 1}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    {c.small_logo_thumb_url ? (
                      <img
                        src={c.small_logo_thumb_url}
                        alt=""
                        className="h-8 w-8 flex-shrink-0 rounded-md bg-muted object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-[#FB651E]/10">
                        <Briefcase className="h-4 w-4 text-[#FB651E]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono font-semibold text-foreground group-hover:text-[#FB651E]">
                          {c.name}
                        </span>
                        {c.is_hiring && (
                          <span className="hidden shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-emerald-500 sm:inline">
                            hiring
                          </span>
                        )}
                      </div>
                      <p className="max-w-[22rem] truncate font-mono text-xs text-muted-foreground">
                        {c.one_liner || '—'}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-right">
                  <span
                    className={`inline-block rounded border px-1.5 py-0.5 font-mono text-xs font-bold ${matchClass(
                      c.similarity_score ?? 0,
                    )}`}
                  >
                    {Math.round((c.similarity_score ?? 0) * 100)}%
                  </span>
                </td>
                <td className="hidden px-3 py-3 font-mono text-xs text-muted-foreground md:table-cell">
                  {c.batch || '—'}
                </td>
                <td className="hidden max-w-[10rem] truncate px-3 py-3 font-mono text-xs text-muted-foreground lg:table-cell">
                  {c.industry || '—'}
                </td>
                <td className="hidden px-3 py-3 text-right font-mono text-xs text-muted-foreground lg:table-cell">
                  {c.team_size ? (
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {c.team_size}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="hidden max-w-[10rem] truncate px-3 py-3 font-mono text-xs text-muted-foreground xl:table-cell">
                  {c.country ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {c.country}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Link
                      to={`/research?q=${encodeURIComponent(c.name)}`}
                      title="AI research on this company"
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-[#FB651E]/50 hover:text-[#FB651E]"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span className="hidden sm:inline">Research</span>
                    </Link>
                    {c.website && (
                      <a
                        href={c.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Visit website"
                        className="inline-flex items-center rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:border-[#FB651E]/50 hover:text-[#FB651E]"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center font-mono text-sm text-muted-foreground">
                  No companies match "{query}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="font-mono text-[11px] text-muted-foreground/60">
        Click a row for full details · Research opens AI intelligence · sorted by {sortKey}
      </p>

      {active && (
        <CompanyDetailModal
          company={active}
          open={!!active}
          onClose={() => setActive(null)}
          showViewFullPage
        />
      )}
    </div>
  )
}
