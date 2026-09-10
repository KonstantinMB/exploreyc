// /world/claim — choose a spot on Earth, then the claim wizard.
//
// ONE surface does the choosing, and it is the wizard panel on the right (a
// bottom sheet on phones). It holds the city search field and the readout of
// what is currently chosen. This page used to float a second card over the
// top-left of the globe carrying its own copy of all of that — its own
// heading, its own "nothing chosen yet", its own instruction and its own
// search input — while the wizard showed the same three things plus a big
// orange button that only moved focus back into that other input. Two panels
// for one decision. The page keeps a small non-interactive hint over the globe
// and nothing else.
//
// The two gestures that pick a spot are still equals:
//
//   1. Click anywhere on the globe.
//   2. Search for a city — the only route that works without a mouse (you
//      cannot click a WebGL sphere with a keyboard), so the combobox is the
//      accessibility path into the whole flow, not a shortcut.
//
// Both write the same {lat, lng} into `candidate` HERE, both go through the
// server's /api/world/where resolver, and both fly the globe to the result.
// The wizard receives the coordinate through `initial` and echoes it back in
// words — "Sofia, Bulgaria" — in its own live region.
//
// Supports ?company=<slug> seed claiming: prefills identity from the company.

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2, MousePointerClick } from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import { apiClient } from '../../lib/api'
import worldApi from '../../lib/worldApi'
import { WORLD_ROOT_CLASS, WorldCard, worldButtonClass } from '../../components/world/ui'
import { LazyClaimFlow, LazyWorldGlobe, type ClaimInitial } from './worldLazy'

type Point = { lat: number; lng: number }

export default function WorldClaimPage() {
  const { darkMode } = useApp()
  const [searchParams] = useSearchParams()
  const companySlug = searchParams.get('company')

  // The spot the visitor chose, pending server geography confirmation. This is
  // what the wizard is told about — including an ocean pick, so that its
  // readout is the thing that says "that is open water". There is no second
  // readout on this page to contradict it.
  const [candidate, setCandidate] = useState<Point | null>(null)
  // Where the camera should be. Only ever a point the server called land: a
  // rejected pick should not drag the globe away from where the visitor was
  // looking.
  const [flyTo, setFlyTo] = useState<Point | null>(null)

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

  // Server-side geography check, used HERE for one decision only: whether the
  // camera should fly. The wizard runs its own for the words it prints, so
  // there is no second opinion about the place on screen — this one never
  // renders anything.
  const whereQuery = useQuery({
    queryKey: ['world', 'where', candidate?.lat, candidate?.lng],
    queryFn: () => worldApi.getWhere(candidate!.lat, candidate!.lng).then((r) => r.data),
    enabled: candidate != null,
    retry: false,
  })

  useEffect(() => {
    if (whereQuery.data && candidate) setFlyTo(candidate)
  }, [whereQuery.data, candidate])

  // A company with coordinates starts the wizard on its own pin.
  useEffect(() => {
    const lat = company?.latitude
    const lng = company?.longitude
    if (lat == null || lng == null) return
    const point = { lat, lng }
    setCandidate((c) => c ?? point)
    setFlyTo((f) => f ?? point)
  }, [company])

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
      // `candidate`, not a land-only copy of it: the wizard's readout is the
      // only one on the page now, so it has to be handed the ocean picks too
      // or nothing would ever tell the visitor the click was rejected.
      ...(candidate ?? {}),
    }),
    [company, candidate]
  )

  /**
   * A city chosen in the wizard's search is treated exactly like a globe
   * click: same state, same geography check, same flight. The camera moves
   * immediately here rather than after the round trip, because the city index
   * is local and its coordinate is not in doubt.
   */
  const choosePoint = useCallback((point: Point) => {
    setCandidate(point)
    setFlyTo(point)
  }, [])

  return (
    <div className={`${WORLD_ROOT_CLASS} fixed inset-0 overflow-hidden`}>
      <Helmet>
        <title>Claim a plot — ExploreYC World</title>
      </Helmet>

      <Suspense
        fallback={
          <div className="absolute inset-0 flex items-center justify-center">
            <p
              role="status"
              className="flex items-center gap-2.5 text-sm font-semibold text-muted-foreground"
            >
              <Loader2
                aria-hidden="true"
                className="h-5 w-5 animate-spin text-[#FB651E] motion-reduce:animate-none"
              />
              Loading the globe…
            </p>
          </div>
        }
      >
        <LazyWorldGlobe
          plots={globeData?.plots ?? []}
          darkMode={darkMode}
          pickMode
          focus={flyTo}
          onPick={(p) => setCandidate(p)}
          className="absolute inset-0"
        />
      </Suspense>

      {/* ---- globe chrome -------------------------------------------------- */}
      {/* The way out, and one sentence saying the globe can be clicked. That
          sentence is the ONLY instruction about choosing anywhere outside the
          wizard, and the card carrying it takes no input and no focus — the
          whole point of the change is that there is one place to choose from.
          aria-hidden because it is a caption for a gesture a screen-reader user
          cannot perform; their route in is the search field in the wizard,
          which is labelled and reachable by Tab. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3 sm:p-4">
        <div className="flex w-full max-w-[24rem] flex-col items-start gap-2.5">
          <Link
            to="/world"
            className={worldButtonClass('secondary', 'sm', {
              className: 'pointer-events-auto self-start',
            })}
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to the globe
          </Link>

          <WorldCard
            aria-hidden="true"
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold leading-snug text-foreground"
          >
            <MousePointerClick className="h-[1.125rem] w-[1.125rem] shrink-0 text-[#FB651E]" />
            Click anywhere to drop your pin
          </WorldCard>
        </div>
      </div>

      {/* ---- the wizard ---------------------------------------------------- */}
      {/* Bottom sheet up to lg, a panel beside the globe from lg. The
          breakpoint is lg rather than sm on purpose: the globe hint is 24rem
          wide at the top-left, so a 26rem panel on the right only stops
          colliding with it once the viewport is about 1024px.
          MOBILE HEIGHT is 60vh. It was 52vh when the top-left card was a
          200px-tall panel with its own search field in it; that card is now a
          44px hint, so the sheet can take back eight points of viewport for
          the picking UI it has absorbed — enough that step 1 fits without
          scrolling on a 375x812 phone — and STILL leave a bigger window on the
          globe than before (~190px against ~140px).
          DESKTOP HEIGHT hugs the content instead of stretching top-4 to
          bottom-4: the place step is short, and a full-height panel left ~460px
          of blank card under it that read as a loading failure. The max-height
          keeps the inner region scrollable on the long steps. */}
      <div
        className={
          'absolute inset-x-0 bottom-0 z-10 flex max-h-[60vh] flex-col overflow-hidden ' +
          'rounded-t-sm border-t border-border bg-card ' +
          'pb-[env(safe-area-inset-bottom)] shadow-lg ' +
          'lg:inset-x-auto lg:bottom-auto lg:right-4 lg:top-4 lg:w-[26rem] ' +
          'lg:max-h-[calc(100vh-2rem)] lg:rounded-sm lg:border lg:pb-0'
        }
      >
        {company ? (
          <p className="mx-4 mt-4 shrink-0 rounded-sm border border-[#FB651E]/40 bg-[#FB651E]/[0.05] px-3 py-2 text-xs leading-snug text-foreground">
            <span className="font-bold">{company.name}</span> is already on the globe as a seed pin
            — claim it to make it yours.
          </p>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          <Suspense
            fallback={
              <p
                role="status"
                className="flex items-center justify-center gap-2.5 py-8 text-sm font-semibold text-muted-foreground"
              >
                <Loader2
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin text-[#FB651E] motion-reduce:animate-none"
                />
                Loading the claim steps…
              </p>
            }
          >
            <LazyClaimFlow initial={initial} onChoosePoint={choosePoint} />
          </Suspense>
        </div>

        <p className="shrink-0 border-t border-border px-5 py-3 text-center text-xs leading-snug text-muted-foreground">
          No prize, no payout, no refund. Minimum stake $5.
        </p>
      </div>
    </div>
  )
}
