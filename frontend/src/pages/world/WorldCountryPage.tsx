// /world/c/:iso — country page: boards, cities, conversion lines, claim CTA.
import { Link, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, MapPin } from 'lucide-react'
import worldApi from '../../lib/worldApi'
import { Button } from '../../components/ui/button'
import { PageHeader } from '../../components/ui/PageHeader'
import { HackerCard } from '../../components/ui/hacker-card'
import { DotPattern } from '../../components/ui/dot-pattern'
import WorldBoards from '../../components/world/boards/WorldBoards'
import CountUp from '../../components/world/boards/CountUp'
import { isoFlag } from '../../components/world/boards/format'
import FeaturedRail from '../../components/world/featured/FeaturedRail'
import { centsToBeat, formatDollars, MIN_STAKE_CENTS } from '../../components/world/constants'

function RankChip({ label, rank }: { label: string; rank: number | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-2 py-1 font-mono text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold text-foreground">{rank != null ? `#${rank}` : 'unranked'}</span>
    </span>
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
      <div className="flex min-h-screen items-center justify-center bg-background font-mono">
        <div className="text-center">
          <p role="alert" className="mb-3 text-sm text-muted-foreground">
            $ exploreyc --world --country {iso || '??'} — not found
          </p>
          <Button asChild variant="outline">
            <Link to="/world">back to the globe</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (countryQuery.isLoading || !country) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background font-mono">
        <p role="status" className="text-sm text-muted-foreground">
          $ exploreyc --world --country {iso} <span className="animate-pulse">loading…</span>
        </p>
      </div>
    )
  }

  const toBeat = boardQuery.data?.cents_to_beat ?? null
  const conversionLine =
    country.plots_count === 0
      ? `${formatDollars(MIN_STAKE_CENTS)} claims the first plot in ${country.name} — and #1 with it`
      : toBeat != null
        ? `${formatDollars(toBeat)} takes #1 in ${country.name}`
        : `price to take #1 in ${country.name}: unknown`

  // Absolute: social crawlers do not resolve relative og:image paths.
  const ogImage = `${window.location.origin}/api/og/world?country=${encodeURIComponent(iso)}`

  return (
    <div className="relative min-h-screen bg-background font-mono">
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
      <DotPattern />

      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <Link
          to="/world"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          back to the globe
        </Link>

        <PageHeader
          command={`$ exploreyc --world --country ${iso}`}
          title={
            <>
              <span aria-hidden className="mr-1">{isoFlag(iso)}</span> {country.name}
            </>
          }
          subtitle={
            <>
              total staked:{' '}
              <CountUp
                value={country.total_cents}
                format={formatDollars}
                className="text-[#FB651E]"
              />{' '}
              across {country.plots_count} plot{country.plots_count === 1 ? '' : 's'}
            </>
          }
          actions={
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <Button asChild>
                <Link to="/world/claim">claim a plot here — from $5</Link>
              </Button>
              <p className="text-[11px] text-muted-foreground">No prize, no payout, no refund.</p>
            </div>
          }
        />

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <RankChip label="richest" rank={country.rank_richest} />
          <RankChip label="planted" rank={country.rank_planted} />
          <span className="font-mono text-xs text-[#FB651E]">{conversionLine}</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <WorldBoards scope={`country:${iso}`} includeFounders={false} />
            <FeaturedRail scope={`country:${iso}`} />
          </div>

          <div className="flex flex-col gap-4">
            <HackerCard className="p-0">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2 font-mono text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 text-[#FB651E]" aria-hidden />
                <span>$ exploreyc --world --cities {iso}</span>
              </div>
              {country.cities.length === 0 ? (
                <p className="px-3 py-4 text-xs text-muted-foreground">
                  No city has a plot yet. The first plant in a city takes it.
                </p>
              ) : (
                <ul>
                  {country.cities.map((city) => {
                    const cityToBeat = city.top_plot
                      ? centsToBeat(city.top_plot.total_cents)
                      : null
                    const cityLine = city.top_plot
                      ? cityToBeat != null
                        ? `${formatDollars(cityToBeat)} takes #1 in ${city.name}`
                        : `price to take #1 in ${city.name}: unknown`
                      : `${formatDollars(MIN_STAKE_CENTS)} takes #1 in ${city.name}`
                    return (
                      <li
                        key={city.id}
                        className="border-b border-border/50 px-3 py-2 last:border-b-0"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-foreground">
                            {city.name}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-foreground">
                            {formatDollars(city.total_cents)}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          {city.top_plot ? (
                            <Link
                              to={`/world/p/${city.top_plot.id}`}
                              className="truncate text-[11px] text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              #1: {city.top_plot.name}
                            </Link>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">unclaimed</span>
                          )}
                          <span className="shrink-0 text-[11px] text-[#FB651E]">{cityLine}</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </HackerCard>

            <HackerCard className="p-0">
              <div className="border-b border-border px-3 py-2 font-mono text-xs text-muted-foreground">
                $ exploreyc --world --plots {iso}
              </div>
              {country.plots.length === 0 ? (
                <p className="px-3 py-4 text-xs text-muted-foreground">
                  Nothing planted in {country.name} yet.{' '}
                  <Link to="/world/claim" className="text-[#FB651E] hover:underline">
                    Be first →
                  </Link>
                </p>
              ) : (
                <ul>
                  {country.plots.slice(0, 20).map((plot, i) => (
                    <li key={plot.id}>
                      <Link
                        to={`/world/p/${plot.id}`}
                        className="flex items-center gap-2 border-b border-border/50 px-3 py-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                          {plot.name}
                        </span>
                        {plot.promoted && (
                          <span className="shrink-0 rounded-sm border border-[#FB651E]/40 bg-[#FB651E]/10 px-1 py-0.5 text-[10px] uppercase text-[#FB651E]">
                            Promoted
                          </span>
                        )}
                        <span className="shrink-0 text-xs tabular-nums text-foreground">
                          {formatDollars(plot.total_cents)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </HackerCard>
          </div>
        </div>
      </div>
    </div>
  )
}
