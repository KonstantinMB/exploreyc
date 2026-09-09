// The last surface before Stripe: what the money buys, said plainly, then the
// honesty block, then the pay button.
//
// Ported from startupworld's claim/ClaimSummary.tsx. The "No prize, no payout,
// no refund" sentence is rendered at body size in body colour immediately
// above the pay button — a disclaimer set in 10px grey is evidence we hoped
// nobody would read it. The donor's dofollow/click-tracking promises are gone:
// both are out of the ExploreYC v1 scope, and the summary must not promise
// what the product does not do.

import { AlertCircle, Check, Link2, Loader2, MapPin, Share2 } from 'lucide-react'

import { formatDollars } from '../constants'

export interface ClaimSummaryProps {
  amountCents: number
  /** "Sofia, Bulgaria" — or null while the place is still resolving. */
  placeLabel: string | null
  /** Trimmed display name, for the "what you get" list. */
  name: string
  hasUrl: boolean
  /** Set when topping up an existing plot rather than planting a new one. */
  topUp?: boolean
  onSubmit: () => void
  submitting: boolean
  error?: string | null
  /** Set when the form upstream is not yet valid. */
  disabled?: boolean
}

const HONESTY =
  'No prize, no payout, no refund. A plot is a pin on a globe and a rank on a board — ' +
  'nothing is ever won or paid out, this is not an investment or a bet, and payments ' +
  'are non-refundable.'

export function ClaimSummary({
  amountCents,
  placeLabel,
  name,
  hasUrl,
  topUp = false,
  onSubmit,
  submitting,
  error = null,
  disabled = false,
}: ClaimSummaryProps) {
  const displayName = name || 'Your name'

  const gets: Array<{ icon: React.ReactNode; text: React.ReactNode }> = topUp
    ? [
        {
          icon: <Check aria-hidden="true" />,
          text: (
            <>
              {formatDollars(amountCents)} added to your stake — rank is cumulative, so every
              dollar counts toward your city, your country and the world.
            </>
          ),
        },
      ]
    : [
        {
          icon: <MapPin aria-hidden="true" />,
          text: (
            <>
              A permanent plot at{' '}
              <span className="text-foreground">{placeLabel ?? 'your coordinate'}</span>, rendered
              on the globe.
            </>
          ),
        },
        {
          icon: <Check aria-hidden="true" />,
          text: (
            <>
              <span className="text-foreground">{displayName}</span>, your one line, and your rank
              in your city, your country and the world.
            </>
          ),
        },
        {
          icon: <Link2 aria-hidden="true" />,
          text: hasUrl ? (
            <>Your link, live on your plot page.</>
          ) : (
            <>A link slot on your plot page you can fill in later.</>
          ),
        },
        {
          icon: <Share2 aria-hidden="true" />,
          text: <>A share card for your plot, yours to post.</>,
        },
      ]

  return (
    <div className="flex flex-col gap-5 font-mono">
      <div className="flex flex-col gap-2.5">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          What you get
        </span>
        <ul className="flex flex-col gap-2.5">
          {gets.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <span className="mt-0.5 shrink-0 text-[#FB651E] [&_svg]:h-4 [&_svg]:w-4">
                {item.icon}
              </span>
              <span className="leading-snug">{item.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Deliberately NOT a hover-glow card: this block is not interactive and
          must not look like something you can dismiss or click past. */}
      <div className="rounded-sm border border-border bg-muted p-4">
        <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Read this</p>
        <p className="text-sm leading-relaxed text-foreground">{HONESTY}</p>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-sm border border-red-500/40 bg-red-500/5 p-3"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">Checkout did not start</p>
            <p className="text-xs leading-snug text-muted-foreground">
              {error} Nothing was charged, and everything you typed is still here.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || submitting}
          className={
            'inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#FB651E] px-4 ' +
            'font-mono text-base font-medium text-white transition-colors hover:bg-[#E65C00] ' +
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
            'ring-offset-background disabled:pointer-events-none disabled:opacity-50'
          }
        >
          {submitting ? (
            <>
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              Opening Stripe…
            </>
          ) : (
            <>{topUp ? 'Top up' : 'Plant'} for {formatDollars(amountCents)}</>
          )}
        </button>

        <p className="text-center text-xs leading-snug text-muted-foreground">
          You finish on Stripe. No card details touch this site.
        </p>
      </div>
    </div>
  )
}
