// /world/claim — pick a spot on the globe, then the 3-step claim wizard.
// Supports ?company=<slug> seed claiming: prefills identity from the company.
import { Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Crosshair, Terminal } from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import { apiClient } from '../../lib/api'
import worldApi from '../../lib/worldApi'
import { isoFlag } from '../../components/world/boards/format'
import { LazyClaimFlow, LazyWorldGlobe, type ClaimInitial } from './worldLazy'

export default function WorldClaimPage() {
  const { darkMode } = useApp()
  const [searchParams] = useSearchParams()
  const companySlug = searchParams.get('company')

  // The spot the visitor tapped, pending server geography confirmation.
  const [candidate, setCandidate] = useState<{ lat: number; lng: number } | null>(null)
  // The last land point the server confirmed. Ocean picks never land here.
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null)

  const { data: globeData } = useQuery({
    queryKey: ['world', 'globe'],
    queryFn: () => worldApi.getGlobe().then((r) => r.data),
    staleTime: 60_000,
  })

  // Seed claiming: prefill identity (and starting position) from the company.
  const companyQuery = useQuery({
    queryKey: ['world', 'claim-company', companySlug],
    queryFn: () => apiClient.getCompanyBySlug(companySlug!).then((r) => r.data),
    enabled: !!companySlug,
  })
  const company = companyQuery.data

  // Server-side geography preview: confirms land, names the country/city.
  const whereQuery = useQuery({
    queryKey: ['world', 'where', candidate?.lat, candidate?.lng],
    queryFn: () => worldApi.getWhere(candidate!.lat, candidate!.lng).then((r) => r.data),
    enabled: candidate != null,
    retry: false,
  })

  useEffect(() => {
    if (whereQuery.data && candidate) setPicked(candidate)
  }, [whereQuery.data, candidate])

  // A company with coordinates starts the wizard on its own pin.
  useEffect(() => {
    if (company?.latitude != null && company?.longitude != null) {
      setCandidate((c) => c ?? { lat: company.latitude!, lng: company.longitude! })
    }
  }, [company])

  const isOcean = whereQuery.isError

  const initial: ClaimInitial = useMemo(
    () => ({
      ...(company
        ? {
            companyId: company.id,
            name: company.name,
            url: company.website,
            tagline: company.one_liner,
          }
        : {}),
      ...(picked ?? {}),
    }),
    [company, picked]
  )

  const statusLine = isOcean
    ? "that's ocean — tap land"
    : whereQuery.isFetching
      ? 'checking coordinates…'
      : whereQuery.data
        ? `${isoFlag(whereQuery.data.country_iso)} ${whereQuery.data.country_name}${whereQuery.data.city_name ? ` · ${whereQuery.data.city_name}` : ''}`
        : 'tap the globe to place your pin'

  return (
    <div className="fixed inset-0 overflow-hidden bg-background font-mono">
      <Helmet>
        <title>Claim a plot — ExploreYC World</title>
      </Helmet>

      <Suspense
        fallback={
          <div className="absolute inset-0 flex items-center justify-center">
            <p role="status" className="font-mono text-sm text-muted-foreground">
              $ exploreyc --world --claim <span className="animate-pulse">loading globe…</span>
            </p>
          </div>
        }
      >
        <LazyWorldGlobe
          plots={globeData?.plots ?? []}
          darkMode={darkMode}
          pickMode
          focus={picked ?? (company?.latitude != null && company?.longitude != null
            ? { lat: company.latitude, lng: company.longitude }
            : null)}
          onPick={(p) => setCandidate(p)}
          className="absolute inset-0"
        />
      </Suspense>

      {/* Top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto rounded-sm border border-border bg-card/90 px-3 py-2 backdrop-blur-sm dark:bg-black/70">
          <Link
            to="/world"
            className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            back to the globe
          </Link>
          <h1 className="flex items-center gap-2 text-sm font-bold">
            <Terminal className="h-4 w-4 text-[#FB651E]" aria-hidden />
            <span>
              <span className="text-[#FB651E]">$</span> exploreyc --world --claim
            </span>
          </h1>
        </div>

        <div
          role="status"
          className="pointer-events-auto flex items-center gap-2 rounded-sm border border-border bg-card/90 px-3 py-2 text-xs backdrop-blur-sm dark:bg-black/70"
        >
          <Crosshair className="h-3.5 w-3.5 shrink-0 text-[#FB651E]" aria-hidden />
          <span className={isOcean ? 'text-[#FB651E]' : 'text-muted-foreground'}>
            {statusLine}
          </span>
        </div>
      </header>

      {/* Claim wizard: floating panel on desktop, bottom card on mobile */}
      <div className="absolute inset-x-0 bottom-0 z-10 max-h-[60vh] overflow-y-auto border-t border-border bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-24 sm:max-h-none sm:w-[400px] sm:rounded-sm sm:border">
        {company && (
          <p className="mb-3 rounded-sm border border-[#FB651E]/40 bg-[#FB651E]/10 px-2.5 py-1.5 text-[11px] text-foreground">
            <span className="font-bold text-[#FB651E]">{company.name}</span> is already on the
            globe as a seed pin — claim it to make it yours.
          </p>
        )}
        <Suspense
          fallback={
            <p role="status" className="py-6 text-center text-xs text-muted-foreground">
              $ loading claim flow<span className="animate-pulse">…</span>
            </p>
          }
        >
          <LazyClaimFlow initial={initial} onNeedPick={() => setCandidate(null)} />
        </Suspense>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          No prize, no payout, no refund. Minimum stake $5.
        </p>
      </div>
    </div>
  )
}
