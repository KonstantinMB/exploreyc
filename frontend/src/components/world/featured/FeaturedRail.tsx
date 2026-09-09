import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Sparkles } from 'lucide-react'
import { cn } from '../../../lib/utils'
import worldApi from '../../../lib/worldApi'

const PROMOTIONS_POLL_MS = 60_000

/** Square monogram fallback when a promotion has no logo. */
function Mark({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className="h-8 w-8 shrink-0 rounded-sm border border-border object-cover"
        loading="lazy"
      />
    )
  }
  return (
    <span
      aria-hidden
      className="grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-border bg-secondary font-mono text-xs font-bold text-muted-foreground"
    >
      {(name || '?').slice(0, 1).toUpperCase()}
    </span>
  )
}

/**
 * Honesty labels are non-negotiable: paid placement always says so, plainly.
 * "Promoted" for self-serve featured plots, "Sponsor" for admin sponsor slots.
 */
function PaidLabel({ kind }: { kind: 'Promoted' | 'Sponsor' }) {
  return (
    <span className="shrink-0 rounded-sm border border-[#FB651E]/40 bg-[#FB651E]/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[#FB651E]">
      {kind}
    </span>
  )
}

export interface FeaturedRailProps {
  /** 'world' | 'country:XX' — passed through to /api/world/promotions. */
  scope?: string
  className?: string
}

/**
 * Featured rail: active promoted plots + sponsor slots for a scope.
 * Renders nothing at all when the scope has no active promotions — an empty
 * ad rail is dead weight on a globe overlay.
 */
export function FeaturedRail({ scope = 'world', className }: FeaturedRailProps) {
  const { data } = useQuery({
    queryKey: ['world', 'promotions', scope],
    queryFn: () => worldApi.getPromotions(scope).then((r) => r.data),
    refetchInterval: PROMOTIONS_POLL_MS,
  })

  const featured = data?.featured ?? []
  const sponsors = data?.sponsors ?? []
  if (featured.length === 0 && sponsors.length === 0) return null

  return (
    <section
      aria-label="Featured and sponsored placements"
      className={cn(
        'overflow-hidden rounded-sm border border-border bg-card/90 backdrop-blur-sm dark:bg-black/70',
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 font-mono text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-[#FB651E]" />
        <span className="truncate">$ exploreyc --world --featured</span>
      </div>
      <ul className="flex flex-col">
        {featured.map((f) => (
          <li key={`featured-${f.plot_id}`}>
            <Link
              to={`/world/p/${f.plot_id}`}
              className="flex items-center gap-2.5 border-b border-border/50 px-3 py-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <Mark name={f.name} logoUrl={f.logo_url} />
              <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold text-foreground">
                {f.name}
              </span>
              <PaidLabel kind="Promoted" />
            </Link>
          </li>
        ))}
        {sponsors.map((s, i) => (
          <li key={`sponsor-${i}`}>
            <a
              href={s.url}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="flex items-center gap-2.5 border-b border-border/50 px-3 py-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <Mark name={s.label} logoUrl={s.logo_url} />
              <span className="min-w-0 flex-1 items-center truncate font-mono text-xs font-semibold text-foreground">
                {s.label}
                <ExternalLink aria-hidden className="ml-1 inline h-3 w-3 text-muted-foreground" />
              </span>
              <PaidLabel kind="Sponsor" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default FeaturedRail
