/**
 * The layers & filters panel — collapsed by default, bottom-left of the globe.
 *
 * DESIGN BRIEF, verbatim: "max attention on the plots bought by people". So the
 * imported-company controls do not get a permanent rail, a sidebar or a row of
 * chips across the map. They get one small pill in the corner that most
 * visitors will never press, and everything else on the page belongs to the
 * paid layer.
 *
 * It is a Radix Dialog rather than a hand-rolled popover, and that is a
 * correctness decision, not a convenience one: a dialog gives the focus trap,
 * the Escape handler, the outside-click dismiss, the labelled surface and the
 * return of focus to the trigger, all of which this control needs and none of
 * which are worth re-implementing. One Content element serves both breakpoints
 * — a bottom sheet under 640px, a card anchored to the trigger's own corner
 * above it.
 *
 * NO SCRIM on desktop, on purpose. Every toggle in here changes what the globe
 * is drawing, and a dimmed globe is a globe you cannot see change. The phone
 * sheet keeps a scrim because it covers the map anyway.
 */

import { useState, type ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Check, SlidersHorizontal } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { WorldButton, WorldChip, WORLD_FOCUS_CLASS, WORLD_OVERLAY_SURFACE } from '../ui'
import { YC_LAYER_AUTO_THRESHOLD, type WorldLayers } from './layers'

/** Tabular integers, so counts in a column do not wobble. */
function Count({ n, className }: { n: number; className?: string }) {
  return (
    <span className={cn('world-num', className)}>{n.toLocaleString('en-US')}</span>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   Controls
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * A real <input type="checkbox">, visually hidden and drawn as a box beside it.
 *
 * Native input, native label association, native keyboard behaviour — Space
 * toggles, arrows do nothing surprising, and the browser's own checked state is
 * what a screen reader reports. The tick is drawn with `currentColor` and the
 * box flips its text colour on `peer-checked`, because a Tailwind `peer-*`
 * variant only reaches siblings, never their descendants.
 */
function CheckOption({
  checked,
  onChange,
  label,
  count,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  count?: number
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 transition-colors hover:bg-background motion-reduce:transition-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          'grid h-[1.125rem] w-[1.125rem] shrink-0 place-items-center rounded-sm',
          'border-2 border-border bg-card text-transparent',
          'transition-colors motion-reduce:transition-none',
          'peer-checked:border-[#FB651E]/40 peer-checked:bg-[#FB651E]',
          'peer-checked:text-white',
          // An arbitrary PROPERTY, not `shadow-[…]`. Tailwind cannot tell
          // whether a bare `var()` in `shadow-[…]` is a colour or a shadow, and
          // it guesses colour: `shadow-[var(--w-focus-ring)]` compiles to
          // `--tw-shadow-color`, which draws nothing at all here. Verified in
          // the built CSS — this is the form that emits `box-shadow`.
          'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#FB651E]'
        )}
      >
        <Check className="h-3 w-3" strokeWidth={3.5} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
        {label}
      </span>
      {count != null ? (
        <Count n={count} className="shrink-0 text-xs text-muted-foreground" />
      ) : null}
    </label>
  )
}

/** A titled group of options. A real fieldset, so the group has a name. */
function FilterGroup({
  legend,
  hint,
  children,
  scroll = false,
}: {
  legend: string
  hint?: string
  children: ReactNode
  scroll?: boolean
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {legend}
      </legend>
      {hint ? <p className="mb-1 text-xs text-muted-foreground">{hint}</p> : null}
      <div
        className={cn(
          '-mx-2',
          scroll && 'world-scroll-list max-h-44 overflow-y-auto overscroll-contain'
        )}
      >
        {children}
      </div>
    </fieldset>
  )
}

/**
 * The one switch on the page that can hide a whole population of pins.
 *
 * Three channels say which way it is set: the thumb's POSITION, the word
 * "On"/"Off" beside it, and `aria-checked` on the switch role. None of them is
 * the colour.
 */
function CompaniesSwitch({ layers }: { layers: WorldLayers }) {
  const on = layers.companiesOn
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => layers.setCompaniesOn(!on)}
      className={cn(
        WORLD_FOCUS_CLASS,
        'flex w-full items-center gap-3 rounded-sm border px-3 py-2.5 text-left',
        'transition-colors motion-reduce:transition-none',
        on
          ? 'border-border bg-card'
          : 'border-border bg-background'
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-foreground">
          YC &amp; imported companies
        </span>
        <span className="block text-xs text-muted-foreground">
          <Count n={layers.seedCount} /> unclaimed pins — context, not placements
        </span>
      </span>
      <span aria-hidden="true" className="flex shrink-0 items-center gap-2">
        <span className="text-xs font-bold text-muted-foreground">{on ? 'On' : 'Off'}</span>
        <span
          className={cn(
            'relative block h-6 w-11 rounded-full border transition-colors motion-reduce:transition-none',
            on
              ? 'border-[#E65C00] bg-[#FB651E]'
              : 'border-border bg-background'
          )}
        >
          <span
            className={cn(
              'absolute top-[0.1875rem] h-[1.125rem] w-[1.125rem] rounded-full transition-[left] duration-150 motion-reduce:transition-none',
              on
                ? 'left-[1.4375rem] bg-white'
                : 'left-[0.1875rem] bg-muted-foreground'
            )}
          />
        </span>
      </span>
    </button>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   The panel
   ──────────────────────────────────────────────────────────────────────────── */

function PanelBody({ layers }: { layers: WorldLayers }) {
  const { facets, filters } = layers
  const anyFilters = layers.activeFilterCount > 0

  return (
    <>
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 pb-3 pt-4">
        <div className="min-w-0">
          <DialogPrimitive.Title className="font-mono text-base font-bold sm:text-lg">
            Layers
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-xs text-muted-foreground">
            Paid plots are always on the globe. Everything else is optional.
          </DialogPrimitive.Description>
        </div>
        <DialogPrimitive.Close asChild>
          <WorldButton variant="secondary" size="sm">
            Done
          </WorldButton>
        </DialogPrimitive.Close>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
        {/* The paid layer, stated rather than offered. There is no control here
            because there is no choice here — and saying so out loud is part of
            the pitch to whoever is thinking about buying a plot. */}
        <div className="flex items-center gap-3 rounded-sm border border-[#FB651E]/40 bg-[#FB651E]/[0.05] px-3 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-foreground">Paid plots</span>
            <span className="block text-xs text-muted-foreground">
              <Count n={layers.paidCount} /> on the globe
            </span>
          </span>
          <WorldChip tone="accent">Always on</WorldChip>
        </div>

        <CompaniesSwitch layers={layers} />

        {/* Why the switch starts where it starts. Two sentences, and both of
            them are true of the number in YC_LAYER_AUTO_THRESHOLD. */}
        {!layers.companiesChoiceMade ? (
          <p className="text-xs leading-snug text-muted-foreground">
            {layers.companiesDefaultOn
              ? `Imported companies show by default until ${YC_LAYER_AUTO_THRESHOLD} plots have been claimed, so the globe is never empty.`
              : `Off by default: ${YC_LAYER_AUTO_THRESHOLD}+ plots have been claimed, so the paid layer owns the map.`}{' '}
            Your choice is remembered.
          </p>
        ) : null}

        <div className="space-y-4 border-t border-border pt-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-bold text-foreground">Filter companies</p>
            {anyFilters ? (
              <WorldButton variant="ghost" size="sm" onClick={layers.clearFilters}>
                Clear filters
              </WorldButton>
            ) : null}
          </div>

          <FilterGroup legend="Hiring">
            <CheckOption
              checked={filters.hiringOnly}
              onChange={layers.setHiringOnly}
              label="Hiring right now"
              count={facets.hiringCount}
            />
          </FilterGroup>

          {facets.batches.length > 0 ? (
            <FilterGroup legend="Batch" hint="Newest first." scroll>
              {facets.batches.map((f) => (
                <CheckOption
                  key={f.value}
                  checked={filters.batches.includes(f.value)}
                  onChange={() => layers.toggleBatch(f.value)}
                  label={f.value}
                  count={f.count}
                />
              ))}
            </FilterGroup>
          ) : null}

          {facets.industries.length > 0 ? (
            <FilterGroup legend="Industry" scroll>
              {facets.industries.map((f) => (
                <CheckOption
                  key={f.value}
                  checked={filters.industries.includes(f.value)}
                  onChange={() => layers.toggleIndustry(f.value)}
                  label={f.value}
                  count={f.count}
                />
              ))}
            </FilterGroup>
          ) : null}
        </div>
      </div>

      {/* The live outcome of everything above, pinned where it can be read
          without scrolling back. One way out, not two: the "Done" button is
          pinned in the header, and Escape and a tap outside both work. */}
      <div className="shrink-0 border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {layers.companiesOn ? (
            <>
              Showing <Count n={layers.matchedSeedCount} className="text-foreground" /> of{' '}
              <Count n={layers.seedCount} /> companies
            </>
          ) : (
            <>Companies hidden — paid plots only</>
          )}
        </p>
      </div>
    </>
  )
}

export interface WorldFilterPanelProps {
  layers: WorldLayers
  className?: string
}

/**
 * Collapsed trigger + the panel it opens.
 *
 * The trigger carries the active-filter count as a badge, and repeats it as
 * text for a screen reader — a number in an orange disc is not a sentence.
 */
export function WorldFilterPanel({ layers, className }: WorldFilterPanelProps) {
  const [open, setOpen] = useState(false)
  const active = layers.activeFilterCount

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        {/* An overlay pill, not a `sm` button: it stacks under the legend in
            the globe's bottom-left corner and the two have to be the same
            height, padding and skin. See WORLD_OVERLAY_PILL in ../ui. */}
        <WorldButton
          variant="secondary"
          size="sm"
          className={cn(WORLD_OVERLAY_SURFACE, 'min-h-[2.25rem] gap-2 px-3', className)}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          {/* The button's accessible name is its own text, so the state has to
              be IN the text: a badge is a shape, and "2" on its own is not a
              sentence anybody can act on. */}
          <span>
            Layers
            <span className="sr-only">
              {' '}
              and filters — {layers.companiesOn ? 'companies shown' : 'paid plots only'}
              {active > 0 ? `, ${active} filter${active === 1 ? '' : 's'} active` : ''}
            </span>
          </span>
          {active > 0 ? (
            <span
              aria-hidden="true"
              className="world-num grid h-5 min-w-5 place-items-center rounded-full bg-[#FB651E] px-1 text-[11px] font-bold text-white"
            >
              {active}
            </span>
          ) : null}
        </WorldButton>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        {/* Scrim on phones only: on desktop the point of this panel is watching
            the globe react, and you cannot watch a globe through a dim sheet. */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-[1000] bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none sm:bg-transparent" />
        {/*
          `world-root` on the Content itself: Radix portals this to
          document.body, outside the page tree, so the tokens have to be
          re-established here or every child falls back to unstyled type.

          Header pinned, body scrolled, footer pinned — the same split the
          boards sheet learned the hard way. Under a `max-h` a flex child
          shrinks before its parent overflows, so a single scroll box would
          squash the facet lists to nothing on a short phone with no way to
          scroll them back.
        */}
        <DialogPrimitive.Content
          className={cn(
            // `[box-shadow:…]` for the same reason as the focus ring above.
            'world-root fixed z-[1001] flex flex-col border-border shadow-lg focus:outline-none',
            'inset-x-0 bottom-0 max-h-[85svh] rounded-t-sm border-t',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom motion-reduce:animate-none',
            'sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-[23rem] sm:max-h-[min(34rem,calc(100svh-7rem))] sm:rounded-sm sm:border'
          )}
        >
          <PanelBody layers={layers} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export default WorldFilterPanel
