/**
 * ExploreYC World globe — public barrel.
 *
 * The one import the rest of the app is allowed to make from this directory.
 * `WorldGlobe` renders full-bleed in its container, handles its own WebGL
 * fallback card, and never navigates on its own; every intent leaves through
 * a callback. three.js touches `window` at module scope, so reach this barrel
 * through `React.lazy` from the `/world` route (same pattern as MapPage).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT NOT TO IMPORT FROM HERE
 *
 * Anything imported from this file drags the whole three.js chunk with it,
 * because this file exports the component that pulls it. The exploration tools
 * the merged globe absorbed are deliberately three-free, and a page holds them
 * in its own render — so they are reached BY PATH, not through the barrel:
 *
 *     import { GLOBE_REGIONS, focusRegion, useHubTour } from '…/globe/tour'
 *     import { batchSortKey, sortBatchesChronologically } from '…/globe/batchOrder'
 *     import { computeHubs } from '…/globe/hubs'
 *
 * All four of those modules import nothing heavier than React and a type. Route
 * them through this barrel and a filter panel puts a 3D engine in the main
 * bundle. The type re-exports below are erased at build time and are safe.
 */

export { default } from './WorldGlobe'
export type { WorldGlobeProps, GlobePlot } from './WorldGlobe'
export type { WorldGlobeFocus } from './GlobeScene'

/** Camera-tool types, for a page that types its own focus state. */
export type { GlobeFocusPoint, GlobeRegion, HubTour, HubTourOptions } from './tour'
export type { Hub } from './hubs'
