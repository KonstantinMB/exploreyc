/**
 * The traffic credential — live viewers and 30-day reach, sitting in the
 * homepage badge row beside "#1 Product of the Day".
 *
 * WHY IT IS A BADGE AND NOT A STAT. Product Hunt's two badges say a jury liked
 * this once. A founder deciding whether $5 of plot is worth anything is asking
 * something else: is anyone actually HERE. That question is answered by numbers
 * we measure continuously, so it belongs in the same row, in the same shape, as
 * the credentials it stands beside — not in a stats strip somewhere below the
 * fold where nobody reads it as proof.
 *
 * WHAT IT PROMISES: every figure on it is measured, and a figure we do not have
 * is not on it.
 *
 *   `viewers_now`   ours, always a real integer. Works with no configuration.
 *   `visitors_30d`  Vercel Web Analytics, and NULL until the backend has a
 *   `countries_*`   VERCEL_ANALYTICS_TOKEN. Null is not zero. The second line
 *                   is simply absent rather than showing a placeholder.
 *
 * THE THREE STATES, in full:
 *
 *   both      "3 viewing now"  over  "2,329 visitors · 95 countries · 30 days"
 *   live only "3 viewing now"  alone, vertically centred — the token is unset
 *             in production today, so this is what ships until it is set.
 *   neither   NOTHING. No skeleton, no dash, no "—". A badge that cannot name
 *             a number is a broken badge, and a broken badge beside a Product
 *             Hunt win costs more credibility than the missing one would.
 *
 * AND THE TRUTHFUL SMALL NUMBERS: at one viewer it says "Just you here right
 * now" and stops pulsing, because "1 viewing now" printed over the one person
 * reading it is the moment proof turns into a joke. At zero — our own beat has
 * not landed yet, or storage is blocked — the live line is dropped entirely
 * rather than rendering a zero. Neither figure is ever rounded up.
 */

import { cn } from '../lib/utils'
import { useAudience } from '../hooks/useSitePresence'
import {
  AudienceInfoTip,
  count,
  countriesLabel,
} from './world/audience/WorldAudience'

export interface LiveTrafficBadgeProps {
  className?: string
}

export function LiveTrafficBadge({ className }: LiveTrafficBadgeProps) {
  const { data } = useAudience()
  if (!data) return null

  // Zero viewers is "we cannot say", not "nobody is here": it is what the count
  // reads before this tab's own first beat lands.
  const live = data.viewers_now > 0 ? data.viewers_now : null
  const visitors = data.visitors_30d

  // The whole badge is conditional on having at least one real figure.
  if (live === null && visitors == null) return null

  const alone = live === 1
  const countries = countriesLabel(data)
  const days = data.window_days ?? 30
  const reach =
    visitors == null
      ? null
      : [`${count(visitors)} visitors`, countries, `${days} days`]
          .filter(Boolean)
          .join(' · ')

  return (
    <div
      className={cn(
        // 54px tall and 240px wide at minimum — the Product Hunt badges' own
        // box. The row is three credentials, and a fourth of the height or
        // half the width would read as something bolted onto two of them.
        // The border is the accent at low opacity for the same reason: both
        // neighbours are outlined in orange, and a grey box next to them is
        // visibly not of the set. `text-left` is not cosmetic — the hero is
        // `text-center` and the badge inherits it, which centres a short line
        // over a long one.
        'inline-flex h-[54px] min-w-[15rem] shrink-0 items-center gap-2.5 rounded-sm',
        'border border-[#FB651E]/35 bg-background/60 px-3.5 text-left backdrop-blur',
        'font-mono transition-shadow duration-200 motion-reduce:transition-none',
        'hover:shadow-[0_0_22px_rgba(251,101,30,0.18)]',
        className,
      )}
    >
      {/*
        The live dot. ACCENT, not green: this product spends exactly one hue,
        and liveness is carried by the pulse and by the word "now", both of
        which survive being read in monochrome. The ping is the only motion on
        the badge and it is removed under prefers-reduced-motion, leaving the
        solid dot — which is why the dot is drawn separately from it.

        It only pulses when there is something live to pulse about: at one
        viewer, and in the reach-only state, it is a muted static marker.
      */}
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        {live !== null && !alone ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FB651E] opacity-60 motion-reduce:hidden" />
        ) : null}
        <span
          className={cn(
            'relative inline-flex h-2 w-2 rounded-full',
            live !== null && !alone ? 'bg-[#FB651E]' : 'bg-muted-foreground',
          )}
        />
      </span>

      <span className="flex min-w-0 flex-col justify-center gap-0.5">
        {live !== null ? (
          <span className="text-[13px] leading-tight">
            {alone ? (
              <span className="text-muted-foreground">Just you here right now</span>
            ) : (
              <>
                {/*
                  `--w-accent-ink`, not #FB651E: this is the loudest WORD on the
                  badge, and #FB651E measures 3.01:1 on a light ground — right
                  for a fill, under AA for text. Same hue, legible on both
                  themes.
                */}
                <span className="font-bold tabular-nums text-[color:var(--w-accent-ink)]">
                  {count(live)}
                </span>{' '}
                <span className="text-foreground">viewing now</span>
              </>
            )}
          </span>
        ) : (
          // Reach-only: the 30-day figure is the only thing we can say, so it
          // is promoted to the headline instead of a headline being invented
          // for it.
          <span className="text-[13px] leading-tight">
            <span className="font-bold tabular-nums text-[color:var(--w-accent-ink)]">
              {count(visitors as number)}
            </span>{' '}
            <span className="text-foreground">visitors</span>
          </span>
        )}

        {/*
          The second line. With a token it is the 30-day reach; without one it
          names the site being measured, because "2 viewing now" on its own
          does not say viewing WHAT — and this badge exists to be pointed at.
          A caption is not a placeholder: no figure is invented, and the moment
          VERCEL_ANALYTICS_TOKEN is set the real numbers take the same slot.
        */}
        <span className="text-[10px] leading-tight text-muted-foreground">
          {live !== null
            ? (reach ?? 'live on exploreyc.com')
            : [countries, `last ${days} days`].filter(Boolean).join(' · ')}
        </span>
      </span>

      {/* Provenance travels with the claim — the same tip every other audience
          surface carries, naming Vercel Web Analytics and the presence window.
          Right-hand end of the box, where the Product Hunt badges keep their
          own trailing mark. */}
      <AudienceInfoTip data={data} align="end" className="ml-auto" />
    </div>
  )
}

export default LiveTrafficBadge
