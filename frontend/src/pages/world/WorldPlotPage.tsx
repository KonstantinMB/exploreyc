// /world/p/:id — plot permalink (share target). Owner sees manage controls.
import { Suspense, useRef, useState, type ChangeEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ArrowLeft, ExternalLink, ImagePlus, Megaphone, Pencil, TrendingUp } from 'lucide-react'
import worldApi, { type PlotPatchRequest, type WorldPlot } from '../../lib/worldApi'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { PageHeader } from '../../components/ui/PageHeader'
import { HackerCard } from '../../components/ui/hacker-card'
import { DotPattern } from '../../components/ui/dot-pattern'
import CountUp from '../../components/world/boards/CountUp'
import { isoFlag, shortDate } from '../../components/world/boards/format'
import { formatDollars, PROMOTION_TIERS } from '../../components/world/constants'
import { LazyClaimFlow } from './worldLazy'

function RankChip({ label, rank }: { label: string; rank: number | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-2 py-1 font-mono text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold text-foreground">{rank != null ? `#${rank}` : 'unranked'}</span>
    </span>
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

  const mutation = useMutation({
    mutationFn: (patch: PlotPatchRequest) => worldApi.updatePlot(plot.id, patch),
    onSuccess: () => {
      setMessage('saved — edits go through the same moderation check as new plots')
      onSaved()
    },
    onError: (err) => {
      const detail = isAxiosError(err) ? err.response?.data?.detail : null
      setMessage(typeof detail === 'string' ? `error: ${detail}` : 'error: could not save — try again')
    },
  })

  const set = (key: keyof PlotPatchRequest) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const fields: { key: keyof PlotPatchRequest; label: string; required?: boolean }[] = [
    { key: 'name', label: 'startup name', required: true },
    { key: 'url', label: 'url' },
    { key: 'tagline', label: 'tagline' },
    { key: 'founder_name', label: 'founder name' },
    { key: 'founder_title', label: 'founder title' },
    { key: 'founder_link', label: 'founder link' },
  ]

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setMessage(null)
        mutation.mutate(form)
      }}
      className="flex flex-col gap-3"
    >
      {fields.map((f) => (
        <div key={f.key} className="flex flex-col gap-1">
          <Label htmlFor={`plot-${f.key}`} className="font-mono text-xs text-muted-foreground">
            {f.label}
          </Label>
          <Input
            id={`plot-${f.key}`}
            value={(form[f.key] as string) ?? ''}
            onChange={set(f.key)}
            required={f.required}
            maxLength={200}
            className="font-mono text-sm"
          />
        </div>
      ))}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          {mutation.isPending ? 'saving…' : 'save changes'}
        </Button>
        {message && (
          <p role="status" className="font-mono text-xs text-muted-foreground">
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

  const mutation = useMutation({
    mutationFn: (dataUrl: string) => worldApi.uploadPlotLogo(plot.id, dataUrl),
    onSuccess: () => {
      setMessage('logo updated')
      onSaved()
    },
    onError: () => setMessage('error: upload failed — try a smaller image'),
  })

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setMessage('error: image must be under 2 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setMessage(null)
      mutation.mutate(String(reader.result))
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onFile}
        className="sr-only"
        id="plot-logo-input"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={mutation.isPending}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus className="mr-1.5 h-4 w-4" aria-hidden />
        {mutation.isPending ? 'uploading…' : plot.logo_url ? 'replace logo' : 'upload logo'}
      </Button>
      {message && (
        <p role="status" className="font-mono text-xs text-muted-foreground">
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
      setError(typeof detail === 'string' ? detail : 'checkout failed — try again')
    },
  })

  if (slotsFull) {
    return (
      <p role="status" className="font-mono text-xs text-muted-foreground">
        All {plot.country_name} featured slots are taken right now. Slots free up when a
        promotion ends — check back soon.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-xs text-muted-foreground">
        Featured placement: orange beacon on the globe, a slot in the Featured rail, and a
        visible “Promoted” label — always labeled as paid.
      </p>
      <div className="flex flex-wrap gap-2">
        {PROMOTION_TIERS.map((tier) => (
          <Button
            key={tier.id}
            variant="outline"
            size="sm"
            disabled={mutation.isPending}
            onClick={() => {
              setError(null)
              mutation.mutate(tier.id)
            }}
          >
            <Megaphone className="mr-1.5 h-4 w-4 text-[#FB651E]" aria-hidden />
            {tier.label} — {formatDollars(tier.price_cents)}
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="font-mono text-xs text-red-600 dark:text-red-400">
          error: {error}
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
      <div className="flex min-h-screen items-center justify-center bg-background font-mono">
        <div className="text-center">
          <p role="alert" className="mb-3 text-sm text-muted-foreground">
            $ exploreyc --world --plot {id || '??'} — not found
          </p>
          <Button asChild variant="outline">
            <Link to="/world">back to the globe</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (plotQuery.isLoading || !plot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background font-mono">
        <p role="status" className="text-sm text-muted-foreground">
          $ exploreyc --world --plot {id} <span className="animate-pulse">loading…</span>
        </p>
      </div>
    )
  }

  const countryRank =
    countryBoard.data?.rows.find((r) => r.plot_id === plot.id)?.rank ?? null
  const cityRank = cityBoard.data?.rows.find((r) => r.plot_id === plot.id)?.rank ?? null
  const toBeat = countryBoard.data?.cents_to_beat ?? null
  const isMine = plot.is_mine === true
  // Absolute: social crawlers do not resolve relative og:image paths.
  const ogImage = `${window.location.origin}/og-world.png`

  return (
    <div className="relative min-h-screen bg-background font-mono">
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
      <DotPattern />

      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <Link
          to="/world"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          back to the globe
        </Link>

        <PageHeader
          command={`$ exploreyc --world --plot ${plot.id}`}
          title={
            <span className="inline-flex items-center gap-3">
              {plot.logo_url ? (
                <img
                  src={plot.logo_url}
                  alt=""
                  className="h-10 w-10 rounded-sm border border-border object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="grid h-10 w-10 place-items-center rounded-sm border border-border bg-secondary font-mono text-base font-bold text-muted-foreground"
                >
                  {plot.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              {plot.name}
              {plot.promoted && (
                <span className="rounded-sm border border-[#FB651E]/40 bg-[#FB651E]/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[#FB651E]">
                  Promoted
                </span>
              )}
            </span>
          }
          subtitle={plot.tagline || undefined}
        />

        {plot.status === 'pending' && (
          <p
            role="status"
            className="mb-4 rounded-sm border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground"
          >
            This plot is pending review and stays off the public globe until approved.
          </p>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <RankChip label={`${plot.country_name}`} rank={countryRank} />
          {plot.city_name && <RankChip label={plot.city_name} rank={cityRank} />}
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-2 py-1 font-mono text-xs">
            <span className="text-muted-foreground">staked</span>
            <CountUp
              value={plot.total_cents}
              format={formatDollars}
              className="font-bold text-[#FB651E]"
            />
          </span>
        </div>

        <HackerCard className="mb-4 p-4">
          <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">location:</dt>
              <dd>
                <Link
                  to={`/world/c/${plot.country_iso}`}
                  className="text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span aria-hidden>{isoFlag(plot.country_iso)}</span> {plot.country_name}
                </Link>
                {plot.city_name ? ` · ${plot.city_name}` : ''}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">planted:</dt>
              <dd>{shortDate(plot.created_at)}</dd>
            </div>
            {plot.url && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">url:</dt>
                <dd className="min-w-0">
                  <a
                    href={plot.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1 truncate text-[#FB651E] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="truncate">{plot.url}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                  </a>
                </dd>
              </div>
            )}
            {plot.founder_name && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">founder:</dt>
                <dd>
                  {plot.founder_link ? (
                    <a
                      href={plot.founder_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        </HackerCard>

        {!isMine && (
          <HackerCard className="mb-4 p-4">
            <p className="mb-2 font-mono text-xs text-muted-foreground">
              {toBeat != null
                ? `${formatDollars(toBeat)} takes #1 in ${plot.country_name}.`
                : `Price to take #1 in ${plot.country_name}: unknown.`}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="sm">
                <Link to="/world/claim">claim your own plot — from $5</Link>
              </Button>
              <span className="font-mono text-[11px] text-muted-foreground">
                No prize, no payout, no refund.
              </span>
            </div>
          </HackerCard>
        )}

        {isMine && (
          <div className="flex flex-col gap-4">
            <HackerCard className="p-4">
              <h2 className="mb-3 flex items-center gap-2 font-mono text-sm font-bold">
                <TrendingUp className="h-4 w-4 text-[#FB651E]" aria-hidden />
                <span>
                  <span className="text-[#FB651E]">$</span> world --topup
                </span>
              </h2>
              <p className="mb-2 font-mono text-xs text-muted-foreground">
                Add stake to climb the boards.{' '}
                {toBeat != null
                  ? `${formatDollars(toBeat)} total takes #1 in ${plot.country_name}.`
                  : `Price to take #1 in ${plot.country_name}: unknown.`}
              </p>
              <Button size="sm" onClick={() => setTopUpOpen(true)}>
                top up stake
              </Button>
            </HackerCard>

            <HackerCard className="p-4">
              <h2 className="mb-3 flex items-center gap-2 font-mono text-sm font-bold">
                <Pencil className="h-4 w-4 text-[#FB651E]" aria-hidden />
                <span>
                  <span className="text-[#FB651E]">$</span> world --edit
                </span>
              </h2>
              <div className="mb-4">
                <LogoUpload plot={plot} onSaved={invalidatePlot} />
              </div>
              <PlotEditForm key={plot.updated_at} plot={plot} onSaved={invalidatePlot} />
            </HackerCard>

            <HackerCard className="p-4">
              <h2 className="mb-3 flex items-center gap-2 font-mono text-sm font-bold">
                <Megaphone className="h-4 w-4 text-[#FB651E]" aria-hidden />
                <span>
                  <span className="text-[#FB651E]">$</span> world --promote
                </span>
              </h2>
              <PromotePanel plot={plot} />
            </HackerCard>
          </div>
        )}
      </div>

      {/* Top-up flow: ClaimFlow with initial.plotId (text fields ignored server-side) */}
      <DialogPrimitive.Root open={topUpOpen} onOpenChange={setTopUpOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[1001] bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[1001] max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-background p-4 font-mono focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none sm:p-6">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <DialogPrimitive.Title className="font-mono text-sm font-bold">
                  <span className="text-[#FB651E]">$</span> world --topup {plot.name}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="font-mono text-xs text-muted-foreground">
                  Every dollar counts for {plot.country_name}. No prize, no payout, no refund.
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close asChild>
                <Button variant="outline" size="sm">
                  close
                </Button>
              </DialogPrimitive.Close>
            </div>
            {topUpOpen && (
              <Suspense
                fallback={
                  <p role="status" className="py-6 text-center font-mono text-xs text-muted-foreground">
                    $ loading claim flow<span className="animate-pulse">…</span>
                  </p>
                }
              >
                <LazyClaimFlow initial={{ plotId: plot.id }} />
              </Suspense>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  )
}
