import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { cn } from '../../../lib/utils'
import worldApi from '../../../lib/worldApi'
import { WorldCard, WorldChip, WorldHeading, WorldRowButton } from '../ui'

const PROMOTIONS_POLL_MS = 60_000

/** Square monogram fallback when a promotion has no logo. */
function Mark({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className="h-8 w-8 shrink-0 rounded-[8px] border border-[var(--w-border)] object-cover"
        loading="lazy"
      />
    )
  }
  return (
    <span
      aria-hidden
      className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] border border-[var(--w-border)] bg-[var(--w-ground)] text-sm font-bold text-[var(--w-muted)]"
    >
      {(name || '?').slice(0, 1).toUpperCase()}
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
 *
 * Disclosure is structural, not a call-site convention: <WorldChip> supplies
 * its own "Promoted"/"Sponsor" copy, so there is no way to render one of these
 * rows without the label appearing on it.
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
    <WorldCard
      as="section"
      aria-label="Featured and sponsored placements"
      className={cn('overflow-hidden', className)}
    >
      <div className="px-4 pb-1 pt-4">
        <WorldHeading level={3} action="Paid placement">
          Featured
        </WorldHeading>
      </div>
      <ul className="flex flex-col gap-1.5 p-3">
        {featured.map((f) => (
          <li key={`featured-${f.plot_id}`}>
            <WorldRowButton
              to={`/world/p/${f.plot_id}`}
              leading={<Mark name={f.name} logoUrl={f.logo_url} />}
              title={f.name}
              trailing={<WorldChip tone="promoted" />}
            />
          </li>
        ))}
        {sponsors.map((s, i) => (
          <li key={`sponsor-${i}`}>
            {/*
              Deliberately not <WorldRowButton>. Its props are HTMLAttributes,
              which has no `rel`, and it hardcodes rel="noopener noreferrer" —
              so routing this through the primitive would silently drop
              rel="sponsored" from a paid link. That token is the machine-
              readable half of the same disclosure the visible chip makes, so
              it is not optional. This is the documented world-row markup
              (see world.css), just with the anchor built by hand.

              No chevron either: an outbound link is not in-app navigation, so
              the external-link glyph is the honest affordance.
            */}
            <a
              href={s.url}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="world-tokens world-row"
            >
              <span className="world-row__leading">
                <Mark name={s.label} logoUrl={s.logo_url} />
              </span>
              <span className="world-row__body">
                <span className="world-row__title flex items-center gap-1">
                  <span className="truncate">{s.label}</span>
                  <ExternalLink aria-hidden className="h-3 w-3 shrink-0 text-[var(--w-muted)]" />
                </span>
              </span>
              <span className="world-row__trailing">
                <WorldChip tone="sponsor" />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </WorldCard>
  )
}

export default FeaturedRail
