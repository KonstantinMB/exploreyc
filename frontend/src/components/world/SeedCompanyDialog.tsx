/**
 * What happens when you click an unclaimed pin.
 *
 * THE POINT OF THIS FILE: the pale pins covering the globe are not decoration
 * and they are not fictional — every one of them is a real ExploreYC company
 * imported from the companies table, and `GET /api/world/globe` has been
 * shipping their `company_slug` all along. Until now a click on one fell
 * through to its country page, so the single most valuable connection in the
 * feature — "that dot is Stripe, here is Stripe's ExploreYC profile, and $5
 * puts your name on that spot" — was invisible. This is that connection.
 *
 * WHY A DIALOG RATHER THAN A FLOATING CARD: /world is a full-bleed WebGL
 * canvas with no focusable children, and the globe rail and pulse strip
 * already own the two free corners. A dialog is transient (it does not put
 * chrome over the map, which is the product principle this page exists to
 * honour), it brings focus management and Escape for free, and it is strictly
 * lighter than the full country navigation a seed click used to trigger.
 *
 * WHY THE COMPANY IS FETCHED HERE AND NOT SHIPPED ON THE PIN: production's
 * globe payload is 5,579 pins. A logo URL on each is roughly half a megabyte
 * of JSON, re-fetched every 60 seconds, for artwork that is only ever seen for
 * the ONE pin somebody clicks. So the pin stays lean and the card pays for
 * itself: one cached `GET /api/company/slug/{slug}` on open, through the
 * endpoint the rest of the app already uses.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, ChevronRight, Users } from 'lucide-react'
import { apiClient } from '../../lib/api'
import type { GlobePin } from '../../lib/worldApi'
import {
  WorldButton,
  WorldChip,
  WorldLogo,
  worldButtonClass,
  WORLD_FOCUS_CLASS,
} from './ui'

export interface SeedCompanyDialogProps {
  /** The seed pin that was clicked, or null when nothing is open. */
  pin: GlobePin | null
  onClose: () => void
}

export function SeedCompanyDialog({ pin, onClose }: SeedCompanyDialogProps) {
  const slug = pin?.company_slug ?? null

  const companyQuery = useQuery({
    queryKey: ['world', 'seed-company', slug],
    queryFn: () => apiClient.getCompanyBySlug(slug!).then((r) => r.data),
    enabled: !!slug,
    staleTime: 5 * 60_000,
  })
  const company = companyQuery.data

  // The claim flow already supports both halves of this: /world/claim reads
  // ?company=<slug>, resolves the company, prefills name/url/tagline and flies
  // the globe to its coordinates. So there is no new claim path here — this is
  // a link into the one that exists.
  const claimHref = slug ? `/world/claim?company=${encodeURIComponent(slug)}` : '/world/claim'

  return (
    <DialogPrimitive.Root open={pin != null} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[1001] bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none" />
        {/* `world-root` on the Content itself: Radix portals this to
            document.body, outside the page tree, so the tokens have to be
            re-established here or every child falls back to unstyled type.
            Bottom sheet on phones, centred card from sm — the same split the
            boards drawer uses. */}
        <DialogPrimitive.Content
          className={
            'world-root fixed inset-x-0 bottom-0 z-[1001] flex max-h-[85vh] flex-col ' +
            'rounded-t-sm border-t border-border focus:outline-none ' +
            'pb-[env(safe-area-inset-bottom)] ' +
            'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:max-w-md ' +
            'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-sm sm:border sm:pb-0 ' +
            'shadow-lg ' +
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 ' +
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none'
          }
        >
          <div className="flex items-start gap-3 p-5 pb-3">
            <WorldLogo src={company?.small_logo_thumb_url} name={pin?.name ?? '?'} size={48} />
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="font-mono text-base font-bold sm:text-lg min-w-0">
                {pin?.name ?? 'Unclaimed spot'}
              </DialogPrimitive.Title>
              {/* The one honest sentence about what a seed pin IS. Nothing is
                  staked here, so there is no figure to show and none is
                  invented. */}
              <DialogPrimitive.Description className="mt-0.5 text-sm text-muted-foreground">
                On the globe, unclaimed. Nobody has staked a thing.
              </DialogPrimitive.Description>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
            {company ? (
              <>
                {company.one_liner ? (
                  <p className="text-sm leading-snug text-foreground">
                    {company.one_liner}
                  </p>
                ) : null}

                {/* Real ExploreYC facts, and only the ones the row actually
                    carries — an absent batch prints nothing rather than a dash
                    pretending to be data. */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {company.batch ? <WorldChip>{company.batch}</WorldChip> : null}
                  {company.industry ? <WorldChip>{company.industry}</WorldChip> : null}
                  {company.team_size ? (
                    <WorldChip>
                      <Users className="h-3 w-3" aria-hidden />
                      {company.team_size}
                    </WorldChip>
                  ) : null}
                  {company.is_hiring ? <WorldChip tone="accent">Hiring</WorldChip> : null}
                </div>
              </>
            ) : companyQuery.isError ? (
              <p role="status" className="text-sm text-muted-foreground">
                Could not load this company&apos;s profile right now — the spot is still
                claimable.
              </p>
            ) : (
              <p role="status" className="text-sm text-muted-foreground">
                Looking this one up…
              </p>
            )}

            {/* The ExploreYC hand-off. A real route (/company/:slug) that has
                existed all along and that nothing on the globe pointed at. */}
            {slug ? (
              <Link
                to={`/company/${slug}`}
                className={`${WORLD_FOCUS_CLASS} world-link mt-4 inline-flex items-center gap-1`}
              >
                See the full ExploreYC profile
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 p-5 pt-4">
            <Link to={claimHref} className={worldButtonClass('primary', 'md', { block: true })}>
              Claim this spot — from $5
              <ChevronRight className="h-[1.125rem] w-[1.125rem]" aria-hidden />
            </Link>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] leading-tight text-muted-foreground">
                No prize, no payout, no refund.
              </p>
              <DialogPrimitive.Close asChild>
                <WorldButton variant="ghost" size="sm">
                  Not this one
                </WorldButton>
              </DialogPrimitive.Close>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export default SeedCompanyDialog
