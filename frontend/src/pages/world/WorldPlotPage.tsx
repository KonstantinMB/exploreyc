// /world/p/:id — plot permalink (share target). Owner sees manage controls.
import { Suspense, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ArrowLeft, ChevronRight, ExternalLink, ImagePlus, Megaphone } from 'lucide-react'
import worldApi, { type PlotPatchRequest, type WorldPlot } from '../../lib/worldApi'
import {
  Money,
  WorldButton,
  WorldCard,
  WorldChip,
  WorldHeading,
  worldButtonClass,
  WORLD_FOCUS_CLASS,
} from '../../components/world/ui'
import CountUp from '../../components/world/boards/CountUp'
import { isoFlag, shortDate } from '../../components/world/boards/format'
import { formatDollars, PROMOTION_TIERS } from '../../components/world/constants'
import { LazyClaimFlow } from './worldLazy'

/**
 * Text input styled from the World tokens. There is no world.css input class to
 * reach for, so the rules live here — `world-focus` supplies the same compliant
 * ring the primitives use rather than a hand-rolled one.
 */
const INPUT_CLASS =
  'world-focus w-full rounded-[10px] border border-[var(--w-border)] bg-[var(--w-card)] px-3 py-2 text-[0.9375rem] text-[var(--w-ink)] outline-none transition-colors duration-150 placeholder:text-[var(--w-muted)] focus:border-[var(--w-accent)]'

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
function PlotMessage({ children }: { children: ReactNode }) {
  return (
    <div className="world-root flex min-h-screen items-center justify-center p-4">
      <WorldCard className="w-full max-w-sm p-6 text-center">{children}</WorldCard>
    </div>
  )
}

/**
 * One owner control per card, each with its own heading and explanation, so the
 * manage area reads as three decisions rather than one wall of inputs.
 */
function OwnerSection({
  title,
  description,
  children,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <WorldCard as="section" className="p-5">
      <WorldHeading level={3} className="mb-1">
        {title}
      </WorldHeading>
      {description ? (
        <p className="mb-4 text-[0.875rem] text-[var(--w-muted)]">{description}</p>
      ) : null}
      {children}
    </WorldCard>
  )
}

/** Owner-only identity edit form. PATCH re-runs moderation server-side. */
function PlotEditForm({ plot, onSaved }: { plot: WorldPlot; onSaved: () => void }) {
  const [form, setForm] = useState<PlotPatchRequest>({
    name: plot.name,
    url: plot.url ?? '',
    tagline: plot.tagline ?? '',
    founder_name: plot.founder_name ?? '',
    founder_title: plot.founder_title ?? '',
    founder_link: plot.founder_link ?? '',
  })
  const [message, setMessage] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const mutation = useMutation({
    mutationFn: (patch: PlotPatchRequest) => worldApi.updatePlot(plot.id, patch),
    onSuccess: () => {
      setFailed(false)
      setMessage('Saved — edits go through the same moderation check as new plots.')
      onSaved()
    },
    onError: (err) => {
      const detail = isAxiosError(err) ? err.response?.data?.detail : null
      setFailed(true)
      setMessage(typeof detail === 'string' ? detail : 'Could not save — try again.')
    },
  })

  const set = (key: keyof PlotPatchRequest) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  // Grouped, because "what is this plot" and "who is behind it" are two
  // different questions and the flat six-field list made them look like one.
  const groups: {
    legend: string
    fields: { key: keyof PlotPatchRequest; label: string; required?: boolean }[]
  }[] = [
    {
      legend: 'The startup',
      fields: [
        { key: 'name', label: 'Startup name', required: true },
        { key: 'url', label: 'Website' },
        { key: 'tagline', label: 'Tagline' },
      ],
    },
    {
      legend: 'The founder',
      fields: [
        { key: 'founder_name', label: 'Founder name' },
        { key: 'founder_title', label: 'Founder title' },
        { key: 'founder_link', label: 'Founder link' },
      ],
    },
  ]

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setMessage(null)
        mutation.mutate(form)
      }}
      className="flex flex-col gap-5"
    >
      {groups.map((group) => (
        <fieldset key={group.legend} className="min-w-0">
          <legend className="mb-2 text-[0.8125rem] font-bold text-[var(--w-muted)]">
            {group.legend}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.fields.map((f) => (
              <div key={f.key} className="flex min-w-0 flex-col gap-1.5">
                <label
                  htmlFor={`plot-${f.key}`}
                  className="text-[0.8125rem] font-semibold text-[var(--w-ink)]"
                >
                  {f.label}
                  {f.required ? (
                    <span className="ml-1 text-[var(--w-accent-text)]" aria-hidden>
                      *
                    </span>
                  ) : null}
                </label>
                <input
                  id={`plot-${f.key}`}
                  value={(form[f.key] as string) ?? ''}
                  onChange={set(f.key)}
                  required={f.required}
                  maxLength={200}
                  className={INPUT_CLASS}
                />
              </div>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <WorldButton type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </WorldButton>
        {message && (
          <p
            role={failed ? 'alert' : 'status'}
            className="text-[0.8125rem] text-[var(--w-muted)]"
          >
            {message}
          </p>
        )}
      </div>
    </form>
  )
}

/** Owner-only logo upload: file -> data URL -> POST, mirroring the avatar pattern. */
function LogoUpload({ plot, onSaved }: { plot: WorldPlot; onSaved: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const mutation = useMutation({
    mutationFn: (dataUrl: string) => worldApi.uploadPlotLogo(plot.id, dataUrl),
    onSuccess: () => {
      setFailed(false)
      setMessage('Logo updated.')
      onSaved()
    },
    onError: () => {
      setFailed(true)
      setMessage('Upload failed — try a smaller image.')
    },
  })

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setFailed(true)
      setMessage('That image is over 2 MB — pick a smaller one.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setFailed(false)
      setMessage(null)
      mutation.mutate(String(reader.result))
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onFile}
        className="sr-only"
        id="plot-logo-input"
      />
      <WorldButton
        variant="secondary"
        disabled={mutation.isPending}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus className="h-4 w-4" aria-hidden />
        {mutation.isPending ? 'Uploading…' : plot.logo_url ? 'Replace logo' : 'Upload logo'}
      </WorldButton>
      {message && (
        <p role={failed ? 'alert' : 'status'} className="text-[0.8125rem] text-[var(--w-muted)]">
          {message}
        </p>
      )}
    </div>
  )
}

/** Owner-only promote panel: featured tiers -> Stripe checkout. */
function PromotePanel({ plot }: { plot: WorldPlot }) {
  const [error, setError] = useState<string | null>(null)
  const [slotsFull, setSlotsFull] = useState(false)

  const mutation = useMutation({
    mutationFn: (tier: '7d' | '30d') =>
      worldApi.createPromotionCheckout({ plot_id: plot.id, tier }),
    onSuccess: ({ data }) => {
      window.location.href = data.checkout_url
    },
    onError: (err) => {
      if (isAxiosError(err) && err.response?.status === 409) {
        setSlotsFull(true)
        return
      }
      const detail = isAxiosError(err) ? err.response?.data?.detail : null
      setError(typeof detail === 'string' ? detail : 'Checkout failed — try again.')
    },
  })

  if (slotsFull) {
    return (
      <p role="status" className="text-[0.875rem] text-[var(--w-muted)]">
        All {plot.country_name} featured slots are taken right now. Slots free up when a promotion
        ends — check back soon.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {PROMOTION_TIERS.map((tier) => (
          <WorldButton
            key={tier.id}
            variant="secondary"
            disabled={mutation.isPending}
            onClick={() => {
              setError(null)
              mutation.mutate(tier.id)
            }}
          >
            <Megaphone className="h-4 w-4 text-[var(--w-accent-text)]" aria-hidden />
            {tier.label} — {formatDollars(tier.price_cents)}
          </WorldButton>
        ))}
      </div>
      {error && (
        // With one hue in the system, an error can't be "the red one". It gets
        // a distinct shape instead — a tinted, accent-bordered box — plus
        // role="alert", so it never relies on colour to read as a problem.
        <p
          role="alert"
          className="rounded-[10px] border border-[var(--w-accent)] bg-[var(--w-tint)] px-3 py-2 text-[0.8125rem] font-semibold text-[var(--w-ink)]"
        >
          {error}
        </p>
      )}
    </div>
  )
}

export default function WorldPlotPage() {
  const { id: rawId } = useParams<{ id: string }>()
  const id = rawId ?? ''
  const queryClient = useQueryClient()
  const [topUpOpen, setTopUpOpen] = useState(false)

  const plotQuery = useQuery({
    queryKey: ['world', 'plot', id],
    queryFn: () => worldApi.getPlot(id).then((r) => r.data),
    enabled: id.length > 0,
  })
  const plot = plotQuery.data

  // Country-scoped richest board: this plot's in-country rank + cents_to_beat.
  const countryBoard = useQuery({
    queryKey: ['world', 'board', 'richest', `country:${plot?.country_iso}`],
    queryFn: () => worldApi.getBoard('richest', `country:${plot!.country_iso}`).then((r) => r.data),
    enabled: !!plot,
  })
  const cityBoard = useQuery({
    queryKey: ['world', 'board', 'richest', `city:${plot?.city_id}`],
    queryFn: () => worldApi.getBoard('richest', `city:${plot!.city_id}`).then((r) => r.data),
    enabled: plot?.city_id != null,
  })

  const invalidatePlot = () => queryClient.invalidateQueries({ queryKey: ['world', 'plot', id] })

  if (!id || plotQuery.isError) {
    return (
      <PlotMessage>
        <WorldHeading level={3} className="mb-2 justify-center">
          Plot not found
        </WorldHeading>
        <p role="alert" className="mb-5 text-sm text-[var(--w-muted)]">
          There is no plot at this address. It may have been removed.
        </p>
        <Link to="/world" className={worldButtonClass('secondary', 'md')}>
          Back to the globe
        </Link>
      </PlotMessage>
    )
  }

  if (plotQuery.isLoading || !plot) {
    return (
      <PlotMessage>
        <p role="status" className="text-sm text-[var(--w-muted)]">
          Loading this plot…
        </p>
      </PlotMessage>
    )
  }

  const countryRank = countryBoard.data?.rows.find((r) => r.plot_id === plot.id)?.rank ?? null
  const cityRank = cityBoard.data?.rows.find((r) => r.plot_id === plot.id)?.rank ?? null
  const toBeat = countryBoard.data?.cents_to_beat ?? null
  const isMine = plot.is_mine === true
  // Absolute: social crawlers do not resolve relative og:image paths.
  const ogImage = `${window.location.origin}/og-world.png`

  /** The one conversion sentence, shared by the visitor and owner cards. */
  const toBeatLine = (
    <>
      {toBeat != null ? (
        <>
          <Money cents={toBeat} className="text-[var(--w-accent-text)]" /> takes #1 in{' '}
          {plot.country_name}.
        </>
      ) : (
        <>
          Price to take #1 in {plot.country_name}: <Money cents={null} />.
        </>
      )}
    </>
  )

  return (
    <div className="world-root min-h-screen">
      <Helmet>
        <title>{`${plot.name} — ExploreYC World`}</title>
        <meta
          name="description"
          content={`${plot.name} holds a plot in ${plot.country_name} with ${formatDollars(plot.total_cents)} staked on ExploreYC World.`}
        />
        <meta property="og:title" content={`${plot.name} — ExploreYC World`} />
        <meta
          property="og:description"
          content={`${formatDollars(plot.total_cents)} staked in ${plot.country_name}.`}
        />
        <meta property="og:image" content={ogImage} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={ogImage} />
      </Helmet>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <Link
          to="/world"
          className={`${WORLD_FOCUS_CLASS} mb-5 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-[var(--w-muted)] transition-colors hover:text-[var(--w-accent-text)]`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to the globe
        </Link>

        <WorldCard className="mb-4 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            {plot.logo_url ? (
              <img
                src={plot.logo_url}
                alt=""
                className="h-14 w-14 shrink-0 rounded-[12px] border border-[var(--w-border)] object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="grid h-14 w-14 shrink-0 place-items-center rounded-[12px] border border-[var(--w-border)] bg-[var(--w-ground)] text-xl font-bold text-[var(--w-muted)]"
              >
                {plot.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {/* min-w-0: WorldHeading's wrapper is itself a flex box, so
                    without this a long startup name refuses to shrink and
                    pushes the Promoted chip off the card. */}
                <WorldHeading level={1} className="min-w-0">
                  {plot.name}
                </WorldHeading>
                {plot.promoted && <WorldChip tone="promoted" />}
              </div>
              {plot.tagline ? (
                <p className="mt-1 text-[0.9375rem] text-[var(--w-muted)]">{plot.tagline}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <RankChip label={plot.country_name} rank={countryRank} />
            {plot.city_name && <RankChip label={plot.city_name} rank={cityRank} />}
            <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--w-border)] bg-[var(--w-card)] px-2.5 py-1.5 text-[0.8125rem]">
              <span className="text-[var(--w-muted)]">Staked</span>
              <CountUp
                value={plot.total_cents}
                format={formatDollars}
                className="world-tokens world-money text-[var(--w-accent-text)]"
              />
            </span>
          </div>
        </WorldCard>

        {plot.status === 'pending' && (
          <WorldCard className="mb-4 p-4" flat>
            <p role="status" className="text-[0.875rem] text-[var(--w-muted)]">
              This plot is pending review and stays off the public globe until approved.
            </p>
          </WorldCard>
        )}

        <WorldCard className="mb-4 p-5">
          <dl className="grid gap-x-8 gap-y-3 text-[0.875rem] sm:grid-cols-2">
            <div className="flex min-w-0 gap-2">
              <dt className="shrink-0 text-[var(--w-muted)]">Location</dt>
              <dd className="min-w-0">
                <Link to={`/world/c/${plot.country_iso}`} className="world-link">
                  <span aria-hidden>{isoFlag(plot.country_iso)}</span> {plot.country_name}
                </Link>
                {plot.city_name ? ` · ${plot.city_name}` : ''}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-[var(--w-muted)]">Planted</dt>
              <dd className="world-tokens world-num">{shortDate(plot.created_at)}</dd>
            </div>
            {plot.url && (
              <div className="flex min-w-0 gap-2">
                <dt className="shrink-0 text-[var(--w-muted)]">Website</dt>
                <dd className="min-w-0">
                  <a
                    href={plot.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="world-link inline-flex max-w-full items-center gap-1"
                  >
                    <span className="truncate">{plot.url}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                  </a>
                </dd>
              </div>
            )}
            {plot.founder_name && (
              <div className="flex min-w-0 gap-2">
                <dt className="shrink-0 text-[var(--w-muted)]">Founder</dt>
                <dd className="min-w-0">
                  {plot.founder_link ? (
                    <a
                      href={plot.founder_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="world-link"
                    >
                      {plot.founder_name}
                    </a>
                  ) : (
                    plot.founder_name
                  )}
                  {plot.founder_title ? `, ${plot.founder_title}` : ''}
                </dd>
              </div>
            )}
          </dl>
        </WorldCard>

        {!isMine && (
          <WorldCard className="mb-4 p-5">
            <p className="mb-4 text-[0.9375rem]">{toBeatLine}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/world/claim" className={worldButtonClass('primary', 'lg')}>
                Claim your own plot — from $5
                <ChevronRight className="h-5 w-5" aria-hidden />
              </Link>
              <p className="text-[0.6875rem] text-[var(--w-muted)]">
                No prize, no payout, no refund.
              </p>
            </div>
          </WorldCard>
        )}

        {isMine && (
          <div className="flex flex-col gap-4">
            <WorldHeading level={2} className="mt-2">
              Manage your plot
            </WorldHeading>

            <OwnerSection
              title="Add stake"
              description={<>Climb the boards by topping up. {toBeatLine}</>}
            >
              <div className="flex flex-wrap items-center gap-3">
                <WorldButton size="lg" onClick={() => setTopUpOpen(true)}>
                  Top up stake
                </WorldButton>
                <p className="text-[0.6875rem] text-[var(--w-muted)]">
                  No prize, no payout, no refund.
                </p>
              </div>
            </OwnerSection>

            <OwnerSection
              title="Edit details"
              description="Your logo, what you do, and who is behind it. Every edit is re-checked by moderation before it goes live."
            >
              <div className="mb-5">
                <LogoUpload plot={plot} onSaved={invalidatePlot} />
              </div>
              <PlotEditForm key={plot.updated_at} plot={plot} onSaved={invalidatePlot} />
            </OwnerSection>

            <OwnerSection
              title="Promote"
              description="An orange beacon on the globe, a slot in the Featured rail, and a visible “Promoted” label — paid placement is always labelled as paid."
            >
              <PromotePanel plot={plot} />
            </OwnerSection>
          </div>
        )}
      </div>

      {/* Top-up flow: ClaimFlow with initial.plotId (text fields ignored server-side) */}
      <DialogPrimitive.Root open={topUpOpen} onOpenChange={setTopUpOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[1001] bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none" />
          {/* `world-root` re-declared here: Radix portals this to document.body,
              outside the page tree, so the tokens would otherwise be lost. */}
          <DialogPrimitive.Content className="world-root fixed left-1/2 top-1/2 z-[1001] flex max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-[var(--w-border)] focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none">
            {/* Header pinned, body scrolled — same split as the boards sheet, so
                the close control can never scroll out of reach on a short
                viewport. */}
            <div className="flex shrink-0 items-start justify-between gap-3 p-4 pb-3 sm:p-6 sm:pb-3">
              <div className="min-w-0">
                <DialogPrimitive.Title className="world-tokens world-heading world-heading--3">
                  Top up {plot.name}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-[0.8125rem] text-[var(--w-muted)]">
                  Every dollar counts for {plot.country_name}. No prize, no payout, no refund.
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close asChild>
                <WorldButton variant="secondary" size="sm">
                  Close
                </WorldButton>
              </DialogPrimitive.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-6 sm:pb-6">
              {topUpOpen && (
                <Suspense
                  fallback={
                    <p role="status" className="py-6 text-center text-sm text-[var(--w-muted)]">
                      Loading the claim flow…
                    </p>
                  }
                >
                  <LazyClaimFlow initial={{ plotId: plot.id }} />
                </Suspense>
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  )
}
