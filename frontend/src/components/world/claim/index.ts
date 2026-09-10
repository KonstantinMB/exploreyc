// Public surface of the claim wizard.
//
// Pages render `ClaimFlow` inside whatever surface fits the viewport (bottom
// sheet on phones, card/panel on desktop). The flow is inline, keyboard-first,
// and never navigates on its own — the only redirect is to Stripe checkout.

export { default } from './ClaimFlow'
export type { ClaimFlowProps, ClaimInitial } from './ClaimFlow'

// NOT re-exported here on purpose: `CitySearch` (./CitySearch) and the city
// index it uses (./cityIndex). The claim page renders the search OUTSIDE the
// lazy boundary — it is the instruction band over the globe, and the only
// keyboard way to choose a spot — so it must be imported from its own file.
// Reaching it through this barrel would pull ClaimFlow, framer-motion and the
// whole wizard into the eager page bundle.

// The post-checkout landing uses this to upload a logo chosen during the
// wizard (the checkout API itself carries no logo field): once
// `GET /api/world/claimed` reports `done` with a plot_id, call
// `takePendingLogo()` and, if non-null, `worldApi.uploadPlotLogo(plotId, it)`.
export { takePendingLogo, clearPendingLogo } from './logoStash'
