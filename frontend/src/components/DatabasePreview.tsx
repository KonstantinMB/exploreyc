import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Database, ExternalLink, CheckCircle2 } from 'lucide-react';
import { apiClient, type Company } from '../lib/api';
import { CompanyLogo } from './ui/CompanyLogo';
import { HackerCard } from './ui/hacker-card';

const PREVIEW_LIMIT = 8;

// A lean, non-interactive teaser of the /database table — most recent YC
// companies. No filters or pagination; the CTA drives users to the full page.
export function DatabasePreview() {
  const { data, isLoading } = useQuery({
    queryKey: ['database-preview'],
    // No `source` param => YC-only (backend default); has_logo keeps rows tidy.
    queryFn: () =>
      apiClient.getCompanies({ limit: PREVIEW_LIMIT, has_logo: true }).then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });

  const companies: Company[] = data?.companies ?? [];
  const total = data?.total ?? 0;

  return (
    <HackerCard className="overflow-hidden" glowColor="orange">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2 font-mono text-sm">
          <Database className="w-4 h-4 text-[#FB651E]" />
          <span className="font-semibold">Latest YC companies</span>
          {total > 0 && (
            <span className="text-muted-foreground text-xs">
              {total.toLocaleString()} total
            </span>
          )}
        </div>
        <Link
          to="/database"
          className="group inline-flex items-center gap-1.5 text-xs font-mono text-[#FB651E] hover:underline"
        >
          Open full database
          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <table className="w-full text-xs font-mono border-collapse" style={{ minWidth: 'max-content' }}>
          <thead>
            <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2.5 text-left font-semibold">Company</th>
              <th className="px-3 py-2.5 text-left font-semibold">Batch</th>
              <th className="px-3 py-2.5 text-left font-semibold hidden sm:table-cell">Industry</th>
              <th className="px-3 py-2.5 text-left font-semibold hidden md:table-cell">Location</th>
              <th className="px-3 py-2.5 text-right font-semibold hidden md:table-cell">Team</th>
              <th className="px-3 py-2.5 text-center font-semibold">Hiring</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && companies.length === 0
              ? Array.from({ length: PREVIEW_LIMIT }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-3 py-2.5" colSpan={6}>
                      <div className="h-4 bg-muted/40 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              : companies.map((c, i) => (
                  <tr
                    key={c.id}
                    className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${
                      i % 2 === 0 ? '' : 'bg-muted/5'
                    }`}
                  >
                    <td className="px-3 py-2">
                      <Link to={`/company/${c.slug}`} className="flex items-center gap-2 min-w-0 group">
                        <CompanyLogo
                          src={c.small_logo_thumb_url}
                          name={c.name}
                          className="w-5 h-5"
                          rounded="rounded-sm"
                          letterClass="text-[8px]"
                        />
                        <span className="font-medium truncate group-hover:text-[#FB651E] transition-colors max-w-[160px]">
                          {c.name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{c.batch || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                      <span className="truncate block max-w-[130px]">{c.industry || '—'}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">
                      <span className="truncate block max-w-[120px]">
                        {c.all_locations ? c.all_locations.split(';')[0].trim() : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell">
                      {c.team_size ? c.team_size.toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {c.is_hiring ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Footer CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border bg-muted/10">
        <span className="text-xs text-muted-foreground font-mono">
          Sortable, filterable, {total > 0 ? total.toLocaleString() : ''} companies — batch, industry, funding & more.
        </span>
        <Link
          to="/database"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#FB651E] hover:bg-[#E65C00] text-white text-xs font-semibold font-mono transition-colors rounded-sm"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Explore the database
        </Link>
      </div>
    </HackerCard>
  );
}
