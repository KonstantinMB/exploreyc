/**
 * ExploreYC World globe — public barrel.
 *
 * The one import the rest of the app is allowed to make from this directory.
 * `WorldGlobe` renders full-bleed in its container, handles its own WebGL
 * fallback card, and never navigates on its own; every intent leaves through
 * a callback. three.js touches `window` at module scope, so reach this barrel
 * through `React.lazy` from the `/world` route (same pattern as MapPage).
 */

export { default } from './WorldGlobe'
export type { WorldGlobeProps, GlobePlot } from './WorldGlobe'
export type { WorldGlobeFocus } from './GlobeScene'
