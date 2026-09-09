// The claim checkout API (`POST /api/world/checkout`) carries no logo field —
// logos are uploaded per-plot via `POST /api/world/plots/{id}/logo`, and at
// checkout time the plot does not exist yet. So a logo chosen in the wizard is
// stashed here (sessionStorage: survives the Stripe round-trip in the same
// tab, dies with it) and the post-checkout landing page uploads it once the
// claimed plot id is known.

const KEY = 'world_claim_pending_logo'

/** Remember a logo (JPEG data URL from the canvas resize) for after checkout. */
export function stashPendingLogo(dataUrl: string): void {
  try {
    sessionStorage.setItem(KEY, dataUrl)
  } catch {
    // Quota or private-mode failure: the buyer can upload from the plot page.
  }
}

/**
 * Take the stashed logo, clearing it. The post-checkout landing calls this
 * once `/api/world/claimed` reports `done` and uploads via
 * `worldApi.uploadPlotLogo(plotId, dataUrl)`.
 */
export function takePendingLogo(): string | null {
  try {
    const value = sessionStorage.getItem(KEY)
    if (value !== null) sessionStorage.removeItem(KEY)
    return value
  } catch {
    return null
  }
}

/** Drop the stash without reading it (e.g. the buyer cancelled the flow). */
export function clearPendingLogo(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
