/**
 * Custom SVG icons for the Tools page - distinctive, on-brand
 */

interface IconProps {
  className?: string;
}

/** Idea Validator: magnifying glass with checkmark - search & validate */
export function IdeaValidatorIcon({ className = 'w-7 h-7' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M17 17l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 11l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Batch Wrapped: gift box with ribbon */
export function BatchWrappedIcon({ className = 'w-7 h-7' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 12v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V12L14 6 4 12Z"
        fill="currentColor"
      />
      <path d="M4 12l10-6 10 6" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none" />
      <path d="M14 6v16M4 14h20" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
      <circle cx="14" cy="14" r="2" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

/** Fundraising Tracker: network graph */
export function FundraisingTrackerIcon({ className = 'w-7 h-7' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="3.5" fill="currentColor" />
      <circle cx="20" cy="8" r="3.5" fill="currentColor" />
      <circle cx="14" cy="20" r="3.5" fill="currentColor" />
      <path
        d="M11 9.5h6M14 11.5v7M11 9.5l2.5 9M17 9.5l-2.5 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
