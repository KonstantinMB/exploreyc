// The last surface before Stripe: what the money buys, said plainly, then the
// honesty block, then the pay button.
//
// Ported from startupworld's claim/ClaimSummary.tsx. "No prize, no payout, no
// refund" is rendered at body size, in body colour, in bold, immediately above
// the pay button — a disclaimer set in 10px grey is evidence we hoped nobody
// would read it. The donor's dofollow/click-tracking promises are gone: both
// are out of the ExploreYC v1 scope, and the summary must not promise what the
// product does not do.

import { AlertCircle, Check, Link2, Loader2, MapPin, Share2 } from 'lucide-react'

import { Money, WorldButton, WorldCard, WorldHeading } from '../ui'
import { HINT, SANS, SECTION_LABEL } from './styles'

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

/** The first three words are the whole point, so they are their own sentence
 *  and they are the bold ones. */
const HONESTY_LEAD = 'No prize, no payout, no refund.'
const HONESTY_REST =
  'A plot is a pin on a globe and a rank on a board — nothing is ever won or paid out, ' +
  'this is not an investment or a bet, and payments are non-refundable.'

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
              <Money cents={amountCents} /> added to your stake — rank is cumulative, so every
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
              <span className="font-semibold text-foreground">
                {placeLabel ?? 'your coordinate'}
              </span>
              , rendered on the globe.
            </>
          ),
        },
        {
          icon: <Check aria-hidden="true" />,
          text: (
            <>
              <span className="font-semibold text-foreground">{displayName}</span>, your
              one line, and your rank in your city, your country and the world.
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
    <div className="flex flex-col gap-5" style={SANS}>
      <div className="flex flex-col gap-3">
        <WorldHeading level={3}>What you get</WorldHeading>
        <ul className="flex flex-col gap-2.5">
          {gets.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-sm leading-snug text-muted-foreground"
            >
              <span className="mt-0.5 shrink-0 text-[#FB651E] [&_svg]:h-[1.125rem] [&_svg]:w-[1.125rem]">
                {item.icon}
              </span>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Deliberately NOT a hover-lift card: this block is not interactive and
          must not look like something you can dismiss or click past. */}
      <WorldCard flat className="flex flex-col gap-2 bg-background p-4">
        <p className={SECTION_LABEL}>Read this</p>
        <p className="text-sm leading-relaxed text-foreground">
          <strong className="font-bold">{HONESTY_LEAD}</strong> {HONESTY_REST}
        </p>
      </WorldCard>

      {error ? (
        <WorldCard
          role="alert"
          flat
          className="flex items-start gap-2.5 border-[#FB651E]/40 bg-[#FB651E]/[0.05] p-3.5"
        >
          <AlertCircle
            aria-hidden="true"
            className="mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0 text-[#FB651E]"
          />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-foreground">
              Checkout did not start
            </p>
            <p className={HINT}>
              {error} Nothing was charged, and everything you typed is still here.
            </p>
          </div>
        </WorldCard>
      ) : null}

      <div className="flex flex-col gap-2.5">
        {/*
          type="button", and it must stay that way.

          This sits inside the wizard's <form>. As a submit button it would be
          the form's default submit control, so Enter pressed in ANY text field
          on this step would start a payment. A charge is only ever the result
          of somebody deliberately pressing this.
        */}
        <WorldButton
          type="button"
          variant="primary"
          size="lg"
          block
          onClick={onSubmit}
          disabled={disabled || submitting}
        >
          {submitting ? (
            <>
              <Loader2
                aria-hidden="true"
                className="h-5 w-5 animate-spin motion-reduce:animate-none"
              />
              Opening Stripe…
            </>
          ) : (
            <>
              {topUp ? 'Top up' : 'Plant'} for <Money cents={amountCents} />
            </>
          )}
        </WorldButton>

        <p className={`${HINT} text-center`}>
          You finish on Stripe. No card details touch this site.
        </p>
      </div>
    </div>
  )
}
