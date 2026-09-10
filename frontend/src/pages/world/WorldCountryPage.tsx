// /world/c/:iso — country page: boards, cities, conversion lines, claim CTA.
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
  WorldRowButton,
  worldButtonClass,
  WORLD_FOCUS_CLASS,
} from '../../components/world/ui'
import WorldBoards from '../../components/world/boards/WorldBoards'
import CountUp from '../../components/world/boards/CountUp'
import { isoFlag } from '../../components/world/boards/format'
import FeaturedRail from '../../components/world/featured/FeaturedRail'
import { centsToBeat, formatDollars, MIN_STAKE_CENTS } from '../../components/world/constants'

/** A rank readout. `null` is "unranked", never a placeholder number. */
function RankChip({ label, rank }: { label: string; rank: number | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--w-border)] bg-[var(--w-card)] px-2.5 py-1.5 text-[0.8125rem]">
      <span className="text-[var(--w-muted)]">{label}</span>
      {rank != null ? (
        <span className="world-tokens world-num font-bold text-[var(--w-ink)]">#{rank}</span>
      ) : (
        <span className="font-semibold text-[var(--w-muted)]">unranked</span>
      )}
    </span>
  )
}

/** Centred single-message shell for the not-found / loading states. */
function CountryMessage({ children }: { children: ReactNode }) {
  return (
    <div className="world-root flex min-h-screen items-center justify-center p-4">
      <WorldCard className="w-full max-w-sm p-6 text-center">{children}</WorldCard>
    </div>
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
    <div className="world-root min-h-screen">
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

      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <Link
          to="/world"
          className={`${WORLD_FOCUS_CLASS} mb-5 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-[var(--w-muted)] transition-colors hover:text-[var(--w-accent-text)]`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to the globe
        </Link>

        {/* Masthead: who this place is, what it's worth, and the way in. */}
        <WorldCard className="mb-6 p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <WorldHeading level={1} className="mb-1">
                <span aria-hidden className="mr-2">
                  {isoFlag(iso)}
                </span>
                {country.name}
              </WorldHeading>
              <p className="text-[0.9375rem] text-[var(--w-muted)]">
                <CountUp
                  value={country.total_cents}
                  format={formatDollars}
                  className="world-tokens world-money text-[var(--w-ink)]"
                />{' '}
                staked across {country.plots_count} plot
                {country.plots_count === 1 ? '' : 's'}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <RankChip label="Richest" rank={country.rank_richest} />
                <RankChip label="Planted" rank={country.rank_planted} />
              </div>
            </div>

            <div className="flex flex-none flex-col gap-2 sm:items-end">
              <Link
                to="/world/claim"
                className={worldButtonClass('primary', 'lg', { block: true })}
              >
                Claim a plot here — from $5
                <ChevronRight className="h-5 w-5" aria-hidden />
              </Link>
              <p className="text-[0.6875rem] text-[var(--w-muted)] sm:text-right">
                No prize, no payout, no refund.
              </p>
            </div>
          </div>

          {/* The conversion line, stated once and prominently. */}
          <p className="mt-5 border-t border-[var(--w-border)] pt-4 text-[0.9375rem]">
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
        </WorldCard>

        {/* min-w-0 on both columns is load-bearing, not tidying. A grid item
            defaults to `min-width: auto`, i.e. its own min-content, so the
            board column refused to go below the widest row it contained and
            pushed this page 31px wider than a 375px viewport — clipping the
            chevrons and the "Paid placement" label off the right edge. */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-4">
            <WorldBoards scope={`country:${iso}`} includeFounders={false} />
            <FeaturedRail scope={`country:${iso}`} />
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <WorldCard as="section" aria-label={`Cities in ${country.name}`}>
              <div className="px-4 pb-1 pt-4">
                <WorldHeading level={3}>Cities</WorldHeading>
              </div>
              {country.cities.length === 0 ? (
                <p className="px-4 py-5 text-sm text-[var(--w-muted)]">
                  No city has a plot yet. The first plant in a city takes it.
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
                              <Money cents={city.total_cents} />
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

            <WorldCard as="section" aria-label={`Plots in ${country.name}`}>
              <div className="px-4 pb-1 pt-4">
                <WorldHeading level={3}>Plots</WorldHeading>
              </div>
              {country.plots.length === 0 ? (
                <div className="flex flex-col items-start gap-3 px-4 pb-4 pt-2">
                  <p className="text-sm text-[var(--w-muted)]">
                    Nothing planted in {country.name} yet.
                  </p>
                  <Link to="/world/claim" className={worldButtonClass('primary', 'md')}>
                    Be first
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
                        leading={<Rank n={plot.rank} joint={i > 0 && list[i - 1].rank === plot.rank} />}
                        title={plot.name}
                        trailing={
                          <>
                            {plot.promoted && <WorldChip tone="promoted" />}
                            <Money cents={plot.total_cents} />
                          </>
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </WorldCard>
          </div>
        </div>
      </div>
    </div>
  )
}
