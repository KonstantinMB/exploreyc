import { useState, useEffect } from 'react';

/**
 * Company logo with a safe fallback. Renders the logo image when the URL is
 * usable, and a clean letter-avatar otherwise — on empty/Clearbit URLs (the old
 * fallback mostly 404'd) or when the image fails to load. Never shows a browser
 * "broken image" icon.
 */
export function CompanyLogo({
  src,
  name,
  className = 'w-10 h-10',
  rounded = 'rounded',
  letterClass = 'text-sm',
}: {
  src?: string | null;
  name: string;
  className?: string;
  rounded?: string;
  letterClass?: string;
}) {
  const usable = !!src && !src.includes('clearbit.com');
  const [failed, setFailed] = useState(false);
  // Reset the failed flag if the src changes (e.g. list re-renders with new data).
  useEffect(() => setFailed(false), [src]);

  if (!usable || failed) {
    return (
      <div
        className={`${className} ${rounded} bg-[#FB651E]/20 flex items-center justify-center flex-shrink-0`}
        aria-hidden="true"
      >
        <span className={`font-bold text-[#FB651E] ${letterClass}`}>
          {(name || '?').charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src as string}
      alt={name}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${className} ${rounded} object-contain flex-shrink-0 bg-muted`}
    />
  );
}
