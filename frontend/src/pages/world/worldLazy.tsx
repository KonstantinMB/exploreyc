// Lazy binding to the globe module.
//
// Imported dynamically with the type check suppressed on the import specifier:
// if the module is missing it surfaces as a module/build error (Vite), never as
// a type error here — per the agreed integration contract. The prop shape below
// IS the contract both sides code against.
//
// The claim wizard's lazy binding used to live here too. It is gone with the
// wizard: the country panel plus <StakeModal> is the only purchase path now.

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
  /**
   * The country the page currently has a panel open for, highlighted on the
   * sphere. The globe does NOT own this — it reads it and draws it, and the
   * page is the only thing that writes it. That split is what lets a country be
   * selected from the picker, the activity feed or a click on the map without
   * three sources of truth for "which country is open".
   */
  selectedIso?: string | null
  className?: string
  /** Company logo tiles on the pins. Default true. */
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
