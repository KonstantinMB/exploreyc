/**
 * /world/c/:iso — a country's page.
 *
 * It sits under the real ExploreYC navbar now, so it dropped the World's own
 * stand-in chrome and was rebuilt in the same language as /world: full-width
 * bands rather than a grid of floating cards, the board as a centrepiece
 * instead of a column, and one unmissable ask. A country page is a cold-traffic
 * landing surface — people arrive here from a share link — so the sales
 * argument has to be legible in the first screen, and the way back to the globe
 * has to be a real control rather than a logo.
 *
 * Every honesty string is carried over verbatim: the no-prize line, the
 * "unknown" price when the API has no leader figure, the Promoted chip, and the
 * $5 floor.
 */

import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import worldApi from '../../lib/worldApi'
import {
  Money,
  Rank,
  WorldCard,
  WorldChip,
  WorldHeading,
  WorldLogo,
  WorldRowButton,
  worldButtonClass,
  WORLD_FOCUS_CLASS,
} from '../../components/world/ui'
import WorldBoards from '../../components/world/boards/WorldBoards'
import CountUp from '../../components/world/boards/CountUp'
import { isoFlag } from '../../components/world/boards/format'
import FeaturedRail from '../../components/world/featured/FeaturedRail'
import { centsToBeat, formatDollars, MIN_STAKE_CENTS } from '../../components/world/constants'

/**
 * A standing.
 *
 * `null` is "unranked", never a placeholder number. A top-three standing gets
 * the same medal disc the leaderboard rows wear — this is the one place a
 * country finds out it is on the podium, and a grey "#2" is a poor way to say
 * it. <Rank> carries the visually-hidden "Rank 2" and the digit inside the
 * disc, so nothing here depends on the colour of the metal.
 */
function RankChip({ label, rank }: { label: string; rank: number | null }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--w-border)] bg-[var(--w-ground)] px-2.5 py-1.5 text-[0.8125rem]">
      <span className="text-[var(--w-muted)]">{label}</span>
      {rank == null ? (
        <span className="font-semibold text-[var(--w-muted)]">unranked</span>
      ) : rank <= 3 ? (
        <Rank n={rank} />
      ) : (
        <span className="world-tokens world-num text-[0.9375rem] font-extrabold text-[var(--w-ink)]">
          #{rank}
        </span>
      )}
    </span>
  )
}

/**
 * The standings line — the product's own voice, aimed at whoever is reading.
 *
 * Concrete and a little arch, never breathless, and every word of it is
 * derived from the number the API actually returned: there is no branch that
 * invents a position or implies a reward for taking one.
 */
function standingsLine(name: string, rank: number | null): string {
  if (rank == null) return `${name} is not on the board at all. That is a vacancy.`
  if (rank === 1) return `${name} is #1. Enjoy it while it lasts.`
  if (rank <= 3) return `${name} is #${rank}. So close to the top it stings.`
  if (rank <= 10) return `${name} is #${rank}. Top ten, which is not the top.`
  return `${name} is #${rank}. That is embarrassing.`
}

/** The one line of legal honesty that has to survive every layout. */
function NoPrizeNote({ className }: { className?: string }) {
  return (
    <p className={className ?? 'text-[0.6875rem] leading-tight text-[var(--w-muted)]'}>
      No prize, no payout, no refund.
    </p>
  )
}

/** Centred single-message shell for the not-found / loading states. */
function CountryMessage({ children }: { children: ReactNode }) {
  return (
    <div className="world-root flex min-h-[60vh] items-center justify-center p-4">
      <WorldCard className="w-full max-w-sm p-6 text-center">{children}</WorldCard>
    </div>
  )
}

/** Back to the globe. A country page is a landing surface, so this is a real
 *  control with a glyph and a hit area, not a wordmark someone has to guess at. */
function BackToGlobe() {
  return (
    <Link
      to="/world"
      className={`${WORLD_FOCUS_CLASS} -m-1 mb-5 inline-flex items-center gap-1.5 rounded-[10px] p-1 text-[0.8125rem] font-semibold text-[var(--w-muted)] transition-colors hover:text-[var(--w-accent-text)]`}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Back to the globe
    </Link>
  )
}

export default function WorldCountryPage() {
  const { iso: rawIso } = useParams<{ iso: string }>()
  const iso = (rawIso ?? '').toUpperCase()

  const countryQuery = useQuery({
    queryKey: ['world', 'country', iso],
    queryFn: () => worldApi.getCountry(iso).then((r) => r.data),
    enabled: iso.length === 2,
  })

  // Country-scoped richest board carries cents_to_beat for taking #1 here.
  const boardQuery = useQuery({
    queryKey: ['world', 'board', 'richest', `country:${iso}`],
    queryFn: () => worldApi.getBoard('richest', `country:${iso}`).then((r) => r.data),
    enabled: iso.length === 2,
  })

  const country = countryQuery.data

  if (iso.length !== 2 || countryQuery.isError) {
    return (
      <CountryMessage>
        <WorldHeading level={3} className="mb-2 justify-center">
          Country not found
        </WorldHeading>
        <p role="alert" className="mb-5 text-sm text-[var(--w-muted)]">
          We don&apos;t have a country at <strong>{iso || '??'}</strong>.
        </p>
        <Link to="/world" className={worldButtonClass('secondary', 'md')}>
          Back to the globe
        </Link>
      </CountryMessage>
    )
  }

  if (countryQuery.isLoading || !country) {
    return (
      <CountryMessage>
        <p role="status" className="text-sm text-[var(--w-muted)]">
          Loading {iso}…
        </p>
      </CountryMessage>
    )
  }

  const toBeat = boardQuery.data?.cents_to_beat ?? null
  const hasPrice = country.plots_count === 0 || toBeat != null
  const priceCents = country.plots_count === 0 ? MIN_STAKE_CENTS : toBeat
  const conversionLine =
    country.plots_count === 0
      ? `${formatDollars(MIN_STAKE_CENTS)} claims the first plot in ${country.name} — and #1 with it`
      : toBeat != null
        ? `${formatDollars(toBeat)} takes #1 in ${country.name}`
        : `price to take #1 in ${country.name}: unknown`

  // Absolute: social crawlers do not resolve relative og:image paths.
  const ogImage = `${window.location.origin}/og-world.png`

  return (
    <div className="world-root">
      <Helmet>
        <title>{`${country.name} — ExploreYC World`}</title>
        <meta
          name="description"
          content={`${country.name} on ExploreYC World: ${formatDollars(country.total_cents)} staked across ${country.plots_count} plots.`}
        />
        <meta property="og:title" content={`${country.name} — ExploreYC World`} />
        <meta
          property="og:description"
          content={`${formatDollars(country.total_cents)} staked. ${conversionLine}.`}
        />
        <meta property="og:image" content={ogImage} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={ogImage} />
      </Helmet>

      {/* ── Masthead: who this place is, what it is worth, and the way in ── */}
      <section
        aria-label={`${country.name} overview`}
        className="border-b border-[var(--w-border)] bg-[var(--w-card)]"
      >
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
          <BackToGlobe />

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <div className="min-w-0">
              <WorldHeading level={1} className="mb-1">
                <span aria-hidden className="mr-3 text-[0.9em]">
                  {isoFlag(iso)}
                </span>
                {country.name}
              </WorldHeading>

              {/* The score, set as a score. This is the number the whole page
                  is about, and it used to be the same size as the sentence it
                  sat in. The count-up is unchanged; tabular numerals mean it no
                  longer wobbles the line while it runs. */}
              <p className="mt-3">
                <CountUp
                  value={country.total_cents}
                  format={formatDollars}
                  className="world-tokens world-money world-score world-score--xl text-[var(--w-ink)]"
                />
              </p>
              <p className="text-[0.9375rem] text-[var(--w-muted)]">
                staked across {country.plots_count} plot
                {country.plots_count === 1 ? '' : 's'}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <RankChip label="Richest" rank={country.rank_richest} />
                <RankChip label="Planted" rank={country.rank_planted} />
              </div>

              {/* Says the standing out loud, in the product's voice. */}
              <p className="mt-4 max-w-xl text-[1.0625rem] font-semibold leading-snug text-[var(--w-ink)]">
                {standingsLine(country.name, country.rank_richest)}
              </p>
            </div>

            {/* The ask, as its own object rather than a button in a corner.
                The conversion line lives inside it, so the price and the way to
                pay it are never separated. */}
            {/* GROUND, not --w-tint, and the reason is measured. The price
                below is rendered in --w-accent-text at 17px/700 — under the
                18.66px bold threshold, so it needs the full 4.5:1. On the
                orange tint over this card it comes to 4.66:1 in light but
                4.26:1 in dark, i.e. an AA failure in one theme. On the page
                ground it is the documented 4.80:1 / 5.81:1 pair from
                world.css. The orange border and the orange button are what
                make this block read as the ask; the fill does not have to. */}
            <WorldCard className="w-full border-[var(--w-accent)] bg-[var(--w-ground)] p-5">
              <p className="mb-1.5 text-[0.75rem] font-extrabold uppercase tracking-[0.06em] text-[var(--w-muted)]">
                Take this country
              </p>
              <p className="mb-4 text-[1.0625rem] leading-snug">
                {hasPrice ? (
                  <>
                    <Money cents={priceCents} className="text-[var(--w-accent-text)]" />{' '}
                    <span className="text-[var(--w-muted)]">
                      {country.plots_count === 0
                        ? `claims the first plot in ${country.name} — and #1 with it.`
                        : `takes #1 in ${country.name}.`}
                    </span>
                  </>
                ) : (
                  <span className="text-[var(--w-muted)]">
                    Price to take #1 in {country.name}: <Money cents={null} />
                  </span>
                )}
              </p>
              <Link
                to="/world/claim"
                className={worldButtonClass('primary', 'lg', { block: true })}
              >
                Claim a plot here — from $5
                <ChevronRight className="h-5 w-5" aria-hidden />
              </Link>
              <NoPrizeNote className="mt-2 text-center text-[0.6875rem] leading-tight text-[var(--w-muted)]" />
            </WorldCard>
          </div>
        </div>
      </section>

      {/* ── The board, centred ───────────────────────────────────────────── */}
      <section aria-label={`Leaderboards for ${country.name}`} className="border-b border-[var(--w-border)]">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
          <div className="mb-5 text-center">
            <WorldHeading level={2} className="justify-center">
              Who is winning in {country.name}
            </WorldHeading>
            <p className="mx-auto mt-2 max-w-lg text-[0.9375rem] text-[var(--w-muted)]">
              Plots here, ranked by what is staked on them.
            </p>
          </div>
          <WorldBoards scope={`country:${iso}`} includeFounders={false} feature />
        </div>
      </section>

      {/* ── Cities, plots and paid placements ────────────────────────────── */}
      {/* min-w-0 on both columns is load-bearing, not tidying. A grid item
          defaults to `min-width: auto`, i.e. its own min-content, so the
          plot column refused to go below the widest row it contained and
          pushed this page 31px wider than a 375px viewport — clipping the
          chevrons and the "Paid placement" label off the right edge. */}
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:py-14 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <WorldCard as="section" aria-label={`Plots in ${country.name}`}>
            <div className="px-4 pb-1 pt-4">
              <WorldHeading level={3}>Planted here</WorldHeading>
            </div>
            {country.plots.length === 0 ? (
              // Invite, don't report. The price is the real minimum stake,
              // and taking #1 in an empty country is a true statement about
              // an empty board — not a promise of anything else.
              <div className="flex flex-col items-start gap-3 px-4 pb-4 pt-2">
                <p className="text-[0.9375rem] text-[var(--w-ink)]">
                  Nobody has planted in {country.name} yet —{' '}
                  <Money cents={MIN_STAKE_CENTS} className="text-[var(--w-accent-text)]" /> takes
                  #1.
                </p>
                <Link to="/world/claim" className={worldButtonClass('primary', 'md')}>
                  Plant the first one
                  <ChevronRight className="h-[1.125rem] w-[1.125rem]" aria-hidden />
                </Link>
              </div>
            ) : (
              <ul className="flex flex-col gap-1.5 p-3">
                {country.plots.slice(0, 20).map((plot, i, list) => (
                  <li key={plot.id}>
                    <WorldRowButton
                      to={`/world/p/${plot.id}`}
                      // The API's own rank, not the array index, so real ties
                      // render as "=4" here exactly as they do on the boards.
                      leading={
                        <>
                          <Rank n={plot.rank} joint={i > 0 && list[i - 1].rank === plot.rank} />
                          <WorldLogo src={plot.logo_url} name={plot.name} size={24} />
                        </>
                      }
                      title={plot.name}
                      trailing={
                        <>
                          {plot.promoted && <WorldChip tone="promoted" />}
                          <Money cents={plot.total_cents} score />
                        </>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </WorldCard>

          <FeaturedRail scope={`country:${iso}`} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <WorldCard as="section" aria-label={`Cities in ${country.name}`}>
            <div className="px-4 pb-1 pt-4">
              <WorldHeading level={3}>Cities</WorldHeading>
            </div>
            {country.cities.length === 0 ? (
              <p className="px-4 py-5 text-sm text-[var(--w-muted)]">
                Every city here is empty. First one in takes it.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 p-3">
                {country.cities.map((city) => {
                  // Two different nulls, two different meanings: no leader at
                  // all has a real price (the minimum stake), while a leader
                  // whose figure we don't have is genuinely unknown — <Money>
                  // prints "unknown" for the latter rather than guessing.
                  const cityPrice = city.top_plot
                    ? centsToBeat(city.top_plot.total_cents)
                    : MIN_STAKE_CENTS
                  return (
                    <li key={city.id}>
                      <WorldRowButton
                        // An unclaimed city has no plot to open, so the row
                        // becomes the claim affordance instead of going inert.
                        to={city.top_plot ? `/world/p/${city.top_plot.id}` : '/world/claim'}
                        title={city.name}
                        subtitle={city.top_plot ? `#1: ${city.top_plot.name}` : 'Unclaimed'}
                        trailing={
                          <span className="flex flex-col items-end">
                            <Money cents={city.total_cents} score />
                            <span className="text-[0.6875rem] text-[var(--w-muted)]">
                              <Money cents={cityPrice} className="text-[var(--w-accent-text)]" />{' '}
                              takes #1
                            </span>
                          </span>
                        }
                      />
                    </li>
                  )
                })}
              </ul>
            )}
          </WorldCard>
        </div>
      </div>

      {/* ── The ask, one more time ───────────────────────────────────────── */}
      <section
        aria-label={`Claim a plot in ${country.name}`}
        className="border-t border-[var(--w-border)] bg-[var(--w-tint)]"
      >
        <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:py-16">
          <WorldHeading level={2} className="justify-center">
            Your logo, at a real address in {country.name}.
          </WorldHeading>
          {/* Deliberately not the conversion line again: it is stated once, at
              the top, next to the button that acts on it. Repeating a price two
              screens later is how a page starts sounding like a pitch. */}
          <p className="mx-auto mb-6 mt-2 max-w-lg text-[1.0625rem] text-[var(--w-muted)]">
            Pick a coordinate in {country.name}, put your logo on it, and hold it against anyone
            who wants it more.
          </p>
          <Link to="/world/claim" className={worldButtonClass('primary', 'lg')}>
            Claim a plot here — from $5
            <ChevronRight className="h-5 w-5" aria-hidden />
          </Link>
          <NoPrizeNote className="mt-3 text-[0.75rem] text-[var(--w-muted)]" />
        </div>
      </section>
    </div>
  )
}
