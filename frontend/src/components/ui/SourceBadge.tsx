/**
 * Brand badge for a company's source (incubator / VC / launch platform).
 * Add a new source = one entry in BRAND below.
 */

type Brand = { bg: string; fg: string; text: string; label: string; title: string; img?: string };

const BRAND: Record<string, Brand> = {
  yc: {
    bg: 'bg-[#FB651E]', fg: 'text-white', text: 'Y',
    label: 'Y Combinator', title: 'Y Combinator',
  },
  a16z: {
    bg: 'bg-black dark:bg-white', fg: 'text-white dark:text-black', text: 'a16z',
    label: 'Andreessen Horowitz', title: 'Andreessen Horowitz (a16z)',
  },
  hackernews: {
    bg: 'bg-[#FF6600]', fg: 'text-white', text: 'HN',
    label: 'Hacker News', title: 'Hacker News (Launch HN / Show HN)',
  },
  producthunt: {
    bg: 'bg-[#DA552F]', fg: 'text-white', text: 'P',
    label: 'Product Hunt', title: 'Product Hunt', img: '/ph-logo.png',
  },
  techstars: {
    bg: 'bg-[#12B886]', fg: 'text-white', text: 'T',
    label: 'Techstars', title: 'Techstars',
  },
};

function brandFor(source?: string): Brand {
  return BRAND[(source || 'yc').toLowerCase()] ?? {
    bg: 'bg-muted', fg: 'text-foreground', text: (source || '?').slice(0, 2).toUpperCase(),
    label: source || 'Unknown', title: source || 'Unknown',
  };
}

export function SourceBadge({
  source,
  showLabel = false,
  size = 'sm',
  className = '',
}: {
  source?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const brand = brandFor(source);
  const isWordmark = brand.text.length > 2; // a16z-style wordmark vs single-square
  const square = size === 'md' ? 'w-6 h-6 text-[15px]' : 'w-5 h-5 text-[13px]';
  const wordmark = size === 'md' ? 'h-6 px-1.5 text-[13px]' : 'h-5 px-1.5 text-[11px]';

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} title={brand.title}>
      {brand.img ? (
        <img
          src={brand.img}
          alt={brand.label}
          className={`${square} rounded-full object-contain`}
          loading="lazy"
        />
      ) : (
        <span
          className={`inline-flex items-center justify-center rounded-sm font-bold leading-none tracking-tight ${brand.bg} ${brand.fg} ${isWordmark ? wordmark : square}`}
        >
          {brand.text}
        </span>
      )}
      {showLabel && <span className="text-xs text-muted-foreground">{brand.label}</span>}
    </span>
  );
}

/** A row of badges for a company merged across multiple sources. Deduped by key. */
export function MergedSourceBadges({
  sources,
  size = 'sm',
  className = '',
}: {
  sources?: { key: string; source_url?: string }[];
  size?: 'sm' | 'md';
  className?: string;
}) {
  if (!sources || sources.length === 0) return null;
  const seen = new Set<string>();
  const uniq = sources.filter((s) => {
    const k = (s.key || 'yc').toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {uniq.map((s) => (
        <SourceBadge key={s.key} source={s.key} size={size} />
      ))}
    </span>
  );
}

/** Display name for a source key. */
export function sourceLabel(source?: string): string {
  const key = (source || 'yc').toLowerCase();
  if (key === 'a16z') return 'a16z';
  return BRAND[key]?.label ?? source ?? 'Y Combinator';
}
