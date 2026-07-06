/**
 * Brand badge for a company's source (incubator / VC).
 * - YC   -> iconic orange "Y" square
 * - a16z -> black "a16z" wordmark
 * Add new sources here as the platform expands.
 */
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
  const src = (source || 'yc').toLowerCase();
  const box = size === 'md' ? 'h-6 text-[13px]' : 'h-5 text-[11px]';
  const ySquare = size === 'md' ? 'w-6 h-6 text-[15px]' : 'w-5 h-5 text-[13px]';

  if (src === 'a16z') {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`} title="Andreessen Horowitz (a16z)">
        <span
          className={`inline-flex items-center justify-center px-1.5 ${box} rounded-sm bg-black dark:bg-white text-white dark:text-black font-bold tracking-tight leading-none`}
        >
          a16z
        </span>
        {showLabel && <span className="text-xs text-muted-foreground">Andreessen Horowitz</span>}
      </span>
    );
  }

  // Default: Y Combinator
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} title="Y Combinator">
      <span
        className={`inline-flex items-center justify-center ${ySquare} rounded-sm bg-[#FB651E] text-white font-bold leading-none`}
      >
        Y
      </span>
      {showLabel && <span className="text-xs text-muted-foreground">Y Combinator</span>}
    </span>
  );
}

/** Display name for a source key. */
export function sourceLabel(source?: string): string {
  switch ((source || 'yc').toLowerCase()) {
    case 'a16z':
      return 'a16z';
    case 'yc':
      return 'Y Combinator';
    default:
      return source || 'Y Combinator';
  }
}
