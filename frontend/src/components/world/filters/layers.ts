/**
 * ExploreYC World — the layer model.
 *
 * The globe draws two populations and they are not equals:
 *
 *   PAID PLOTS  — somebody paid to be at that coordinate. This is the product,
 *                 and the reason the page exists. Always on. There is no code
 *                 path in this file that can hide one, and none should be added:
 *                 a filter that can empty the paid layer is a filter that can
 *                 make a customer's purchase disappear.
 *   COMPANIES   — the ~5.5k imported YC pins. Context, not inventory. Secondary
 *                 by default, filterable, and reachable only through the panel.
 *
 * COLD START. A globe with nothing on it sells nothing, so while the paid layer
 * is still thin the companies layer is on by default and the map looks alive.
 * Once the paid layer passes YC_LAYER_AUTO_THRESHOLD, the default flips and the
 * paid plots own the map. One constant, one comparison — tune the number and
 * both halves of the behaviour move with it.
 *
 * The automatic default is a DEFAULT, not a policy: an explicit toggle is
 * remembered in localStorage and outranks it forever after. Someone who turned
 * the imported layer off does not get it back because three plots sold.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import type { GlobePin } from '../../../lib/worldApi'
import { sortBatchesChronologically } from '../globe/batchOrder'

/**
 * Paid plots below which the imported layer is shown by default.
 *
 * Production is at 0 paid plots and 5,579 seeds, so today this resolves to
 * "on". It is deliberately a single named constant: it is the only number that
 * decides whether a first-time visitor sees a busy globe or an exclusive one.
 */
export const YC_LAYER_AUTO_THRESHOLD = 25

/** Where an explicit companies-layer choice is remembered. */
export const COMPANIES_LAYER_STORAGE_KEY = 'exploreyc.world.companies-layer'

/** Facet selections. An empty array means "no restriction", never "none". */
export interface WorldFilters {
  /** YC batches, as written ('Winter 2025', 'W21'). Empty = every batch. */
  batches: string[]
  industries: string[]
  /** Only companies the scrape recorded as hiring. */
  hiringOnly: boolean
}

export const EMPTY_FILTERS: WorldFilters = { batches: [], industries: [], hiringOnly: false }

/** One option in the panel: the value, and how many pins carry it. */
export interface Facet {
  value: string
  count: number
}

export interface WorldFacets {
  /** Newest batch first — the one people look for. */
  batches: Facet[]
  /** Biggest industry first. */
  industries: Facet[]
  hiringCount: number
}

/** Paid plots in a decoded globe feed. `kind` is the only thing that says so. */
export function countPaidPlots(pins: readonly GlobePin[]): number {
  let n = 0
  for (const pin of pins) if (pin.kind === 'plot') n += 1
  return n
}

/**
 * Build the panel's options from the pins themselves.
 *
 * Facets come from the feed rather than a hardcoded vocabulary, so a batch that
 * appears in the data appears in the panel the same day, and one that never
 * does is never offered. Counts are over the whole imported layer, not over the
 * current selection: an option that reads "S24 · 212" keeps saying 212 while
 * you tick other boxes, which is what makes two selections comparable.
 */
export function computeFacets(pins: readonly GlobePin[]): WorldFacets {
  const batches = new Map<string, number>()
  const industries = new Map<string, number>()
  let hiringCount = 0

  for (const pin of pins) {
    if (pin.kind !== 'seed') continue
    if (pin.is_hiring) hiringCount += 1
    const batch = pin.batch?.trim()
    if (batch) batches.set(batch, (batches.get(batch) ?? 0) + 1)
    const industry = pin.industry?.trim()
    if (industry) industries.set(industry, (industries.get(industry) ?? 0) + 1)
  }

  // Chronological, then reversed: the newest batch is the one anyone hunting
  // for a specific one is most likely to want. Unparseable names sort to the
  // front of the chronological order, so they land at the end here rather than
  // above 'Summer 2025' — and they are never dropped.
  const batchOrder = sortBatchesChronologically(Array.from(batches.keys())).reverse()

  return {
    batches: batchOrder.map((value) => ({ value, count: batches.get(value) ?? 0 })),
    industries: Array.from(industries.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => (b.count - a.count) || a.value.localeCompare(b.value)),
    hiringCount,
  }
}

/**
 * Does an imported pin survive the current selection?
 *
 * Within a facet the selections are OR (S24 or W25); across facets they are AND
 * (an S24 company that is hiring). A pin with no batch cannot match a batch
 * selection — absence is absence, and there is no bucket that quietly catches
 * the nulls.
 *
 * Paid plots never reach this function; see `applyLayers`.
 */
export function seedMatchesFilters(pin: GlobePin, filters: WorldFilters): boolean {
  if (filters.hiringOnly && !pin.is_hiring) return false
  if (filters.batches.length > 0) {
    const batch = pin.batch?.trim()
    if (!batch || !filters.batches.includes(batch)) return false
  }
  if (filters.industries.length > 0) {
    const industry = pin.industry?.trim()
    if (!industry || !filters.industries.includes(industry)) return false
  }
  return true
}

/** True when the selection restricts anything at all. */
export function hasActiveFilters(filters: WorldFilters): boolean {
  return filters.batches.length > 0 || filters.industries.length > 0 || filters.hiringOnly
}

/** How many restrictions are live — the number on the collapsed trigger. */
export function countActiveFilters(filters: WorldFilters): number {
  return filters.batches.length + filters.industries.length + (filters.hiringOnly ? 1 : 0)
}

/**
 * The pins the globe should draw.
 *
 * Returns the input array unchanged when nothing is filtered — reference
 * equality matters downstream, where the scene re-jitters and re-uploads the
 * instance buffers whenever the pin array changes identity.
 */
export function applyLayers(
  pins: GlobePin[],
  companiesOn: boolean,
  filters: WorldFilters
): GlobePin[] {
  if (!companiesOn) return pins.filter((pin) => pin.kind === 'plot')
  if (!hasActiveFilters(filters)) return pins
  return pins.filter((pin) => pin.kind === 'plot' || seedMatchesFilters(pin, filters))
}

/** Read a remembered choice. `null` = never chosen, so the default applies. */
function readStoredChoice(): boolean | null {
  if (typeof window === 'undefined') return null
  try {
    const value = window.localStorage.getItem(COMPANIES_LAYER_STORAGE_KEY)
    return value === 'on' ? true : value === 'off' ? false : null
  } catch {
    // Private mode, disabled storage, a quota that is somehow full: the layer
    // model still works, it just forgets. Never a thrown error on first paint.
    return null
  }
}

function writeStoredChoice(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(COMPANIES_LAYER_STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    /* see readStoredChoice */
  }
}

export interface WorldLayers {
  /** Paid plots in the feed. Also the input to the cold-start rule. */
  paidCount: number
  /** Imported pins in the feed, before filtering. */
  seedCount: number
  /** Imported pins that survive the current selection. */
  matchedSeedCount: number

  /** Is the imported layer drawn right now? */
  companiesOn: boolean
  /** What the cold-start rule says, ignoring any stored choice. */
  companiesDefaultOn: boolean
  /** True once the visitor has decided for themselves. */
  companiesChoiceMade: boolean
  setCompaniesOn: (on: boolean) => void

  filters: WorldFilters
  /** Toggle one value inside a facet. */
  toggleBatch: (value: string) => void
  toggleIndustry: (value: string) => void
  setHiringOnly: (on: boolean) => void
  clearFilters: () => void
  activeFilterCount: number

  facets: WorldFacets
  /** What to hand the globe. */
  visiblePins: GlobePin[]
}

/**
 * The whole layer model as one hook, so the page and the panel cannot disagree
 * about what is on the globe.
 *
 * Touching a facet while the imported layer is off turns it on rather than
 * ticking a box that does nothing: the only reason to filter companies is to
 * see companies, and a control that silently no-ops is worse than one that is
 * disabled.
 */
export function useWorldLayers(pins: GlobePin[]): WorldLayers {
  const [choice, setChoice] = useState<boolean | null>(readStoredChoice)
  const [filters, setFilters] = useState<WorldFilters>(EMPTY_FILTERS)

  const paidCount = useMemo(() => countPaidPlots(pins), [pins])
  const seedCount = pins.length - paidCount

  const companiesDefaultOn = paidCount < YC_LAYER_AUTO_THRESHOLD
  const companiesOn = choice ?? companiesDefaultOn

  // Read inside the facet setters without making them depend on the live value
  // (which would rebuild every handler on every toggle).
  const companiesOnRef = useRef(companiesOn)
  companiesOnRef.current = companiesOn

  const setCompaniesOn = useCallback((on: boolean) => {
    setChoice(on)
    writeStoredChoice(on)
  }, [])

  /** Any facet interaction implies "and show me the layer it filters". */
  const ensureCompaniesOn = useCallback(() => {
    if (!companiesOnRef.current) setCompaniesOn(true)
  }, [setCompaniesOn])

  const toggleBatch = useCallback(
    (value: string) => {
      ensureCompaniesOn()
      setFilters((f) => ({
        ...f,
        batches: f.batches.includes(value)
          ? f.batches.filter((b) => b !== value)
          : [...f.batches, value],
      }))
    },
    [ensureCompaniesOn]
  )

  const toggleIndustry = useCallback(
    (value: string) => {
      ensureCompaniesOn()
      setFilters((f) => ({
        ...f,
        industries: f.industries.includes(value)
          ? f.industries.filter((i) => i !== value)
          : [...f.industries, value],
      }))
    },
    [ensureCompaniesOn]
  )

  const setHiringOnly = useCallback(
    (on: boolean) => {
      if (on) ensureCompaniesOn()
      setFilters((f) => ({ ...f, hiringOnly: on }))
    },
    [ensureCompaniesOn]
  )

  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), [])

  const facets = useMemo(() => computeFacets(pins), [pins])

  const visiblePins = useMemo(
    () => applyLayers(pins, companiesOn, filters),
    [pins, companiesOn, filters]
  )

  const matchedSeedCount = useMemo(() => {
    if (!hasActiveFilters(filters)) return seedCount
    let n = 0
    for (const pin of pins) {
      if (pin.kind === 'seed' && seedMatchesFilters(pin, filters)) n += 1
    }
    return n
  }, [pins, filters, seedCount])

  return {
    paidCount,
    seedCount,
    matchedSeedCount,
    companiesOn,
    companiesDefaultOn,
    companiesChoiceMade: choice !== null,
    setCompaniesOn,
    filters,
    toggleBatch,
    toggleIndustry,
    setHiringOnly,
    clearFilters,
    activeFilterCount: countActiveFilters(filters),
    facets,
    visiblePins,
  }
}
