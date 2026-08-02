/**
 * Buy Me a Coffee brand mark — an inline, single-colour coffee-cup logo used to
 * attribute the platform on the support surfaces. Inlined (not hotlinked) so it
 * works offline and under CSP. Decorative: parents supply the visible label.
 * Colours via `currentColor`, so it adapts to whatever text colour it sits in.
 */
export function BuyMeCoffeeLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {/* steam */}
      <path
        d="M8.5 2.5c.6.7.6 1.6 0 2.3M12 2.5c.6.7.6 1.6 0 2.3M15.5 2.5c.6.7.6 1.6 0 2.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* cup body */}
      <path
        d="M4 8h13v5.5A5.5 5.5 0 0 1 11.5 19h-2A5.5 5.5 0 0 1 4 13.5V8Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      {/* handle */}
      <path
        d="M17 9.5h1.5a2.75 2.75 0 0 1 0 5.5H17"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      {/* saucer */}
      <path d="M4.5 21.5h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
