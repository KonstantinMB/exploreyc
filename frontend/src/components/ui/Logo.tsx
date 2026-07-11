/**
 * Source-neutral brand mark for ExploreYC.
 * An orange terminal-prompt glyph (`>`) instead of the YC "Y" — reads as a
 * multi-source startup-data platform, not a YC-only tool. Keeps the brand color.
 */
export function Logo({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`bg-[#FB651E] flex items-center justify-center flex-shrink-0 ${className}`}
      aria-hidden
    >
      <span style={{ fontSize: Math.round(size * 0.52) }} className="font-mono font-bold text-white leading-none">
        &gt;
      </span>
    </div>
  )
}

/** Logo + "ExploreYC" wordmark (+ optional terminal subtitle). */
export function Brand({
  size = 36,
  subtitle = '$ startup-db',
  showText = true,
  className = '',
}: {
  size?: number
  subtitle?: string | null
  showText?: boolean
  className?: string
}) {
  return (
    <div className={`flex items-center gap-2 sm:gap-3 min-w-0 ${className}`}>
      <Logo size={size} className="group-hover:shadow-[0_0_16px_rgba(251,101,30,0.4)] transition-shadow" />
      {showText && (
        <div className="min-w-0">
          <div className="text-sm font-bold whitespace-nowrap truncate">ExploreYC</div>
          {subtitle && <div className="text-xs text-muted-foreground whitespace-nowrap truncate">{subtitle}</div>}
        </div>
      )}
    </div>
  )
}
