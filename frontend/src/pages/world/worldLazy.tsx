// Lazy bindings to the globe and claim-flow modules owned by other agents.
//
// Both are imported dynamically with the type check suppressed on the import
// specifier: if either module is still missing it surfaces as a module/build
// error (Vite), never as a type error here — per the agreed integration
// contract. The prop shapes below ARE the contract both sides code against.

import { lazy, type ComponentType } from 'react'
import type { GlobePin } from '../../lib/worldApi'

/** The /api/world/globe plot shape — re-exported under the contract name. */
export type GlobePlot = GlobePin

/**
 * `distance` is the camera's arrival height in globe radii — how tightly the
 * jump frames what it flew to. Omitted, the scene keeps its own defaults (1.8
 * for a coordinate, 2.2 for a country). `globe/tour` computes it for the
 * region rail from the framing the 2D map used.
 */
export type GlobeFocus =
  | { lat: number; lng: number; distance?: number }
  | { iso: string; distance?: number }
  | null

export interface WorldGlobeProps {
  plots: GlobePlot[]
  darkMode: boolean
  focus?: GlobeFocus
  pickMode?: boolean
  onPick?: (p: { lat: number; lng: number }) => void
  onSelectPlot?: (id: number) => void
  /**
   * A seed pin was clicked — an imported company nobody has staked on yet.
   *
   * The pin carries the feed's own coordinates plus `id`, `name` and
   * `company_slug`; there is no plot id, because there is no plot. Optional:
   * leave it off and a seed click falls through to its country, which is what
   * the globe has always done.
   */
  onSelectSeed?: (pin: GlobePin) => void
  onSelectCountry?: (iso: string) => void
  className?: string
  /** Company logo tiles on the pins. Default true; forced off in `pickMode`. */
  logoMarkers?: boolean
  /** The aggregate city view — one disc per city, orange where money is. */
  density?: boolean
  /**
   * A drag, pinch or wheel STARTED. The page uses it to stop the hub tour: a
   * camera that fights the visitor for control is the one thing an auto-flight
   * must never do.
   */
  onInteract?: () => void
}

export const LazyWorldGlobe = lazy(async () => {
  // @ts-ignore -- module is owned by the globe agent; resolved at build time.
  const mod = await import('../../components/world/globe')
  return { default: mod.default as ComponentType<WorldGlobeProps> }
})

/**
 * ClaimFlow initial data. The claim agent owns the authoritative prop types;
 * this stays intentionally loose so a lagging definition never blocks tsc.
 */
export interface ClaimInitial {
  /** Set for a top-up of an existing plot. */
  plotId?: string
  lat?: number
  lng?: number
  /** Seed claiming: prefill from a companies row. */
  companyId?: number
  name?: string
  url?: string
  tagline?: string
  [key: string]: unknown
}

export interface ClaimFlowProps {
  initial?: ClaimInitial
  /**
   * A coordinate was chosen inside the wizard (the city search on step 1).
   * The page owns the globe, so it flies the camera and feeds the point back
   * down through `initial` — one source of truth for the chosen spot.
   */
  onChoosePoint?: (point: { lat: number; lng: number }) => void
}

export const LazyClaimFlow = lazy(async () => {
  // @ts-ignore -- module is owned by the claim agent; resolved at build time.
  const mod = await import('../../components/world/claim')
  return { default: mod.default as ComponentType<ClaimFlowProps> }
})
