// Public surface of the claim wizard.
//
// Pages render `ClaimFlow` inside whatever surface fits the viewport (bottom
// sheet on phones, card/panel on desktop). The flow is inline, keyboard-first,
// and never navigates on its own — the only redirect is to Stripe checkout.

export { default } from './ClaimFlow'
export type { ClaimFlowProps, ClaimInitial } from './ClaimFlow'

// The post-checkout landing uses this to upload a logo chosen during the
// wizard (the checkout API itself carries no logo field): once
// `GET /api/world/claimed` reports `done` with a plot_id, call
// `takePendingLogo()` and, if non-null, `worldApi.uploadPlotLogo(plotId, it)`.
export { takePendingLogo, clearPendingLogo } from './logoStash'
