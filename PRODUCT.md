# Product

## Register

product

## Users

Developers — indie hackers, founders, data teams — who consume the ExploreYC dataset (YC + a16z + Product Hunt companies, founders, funding) through the public REST API, plus curious YC-watchers using the free web tools (validator, maps, analytics). API users are in a task: get a key, make calls, watch quota, upgrade when they hit the cap.

## Product Purpose

ExploreYC is a startup-intelligence platform over scraped YC/a16z data. The public API is the monetized surface: free 5 req/day → Pro $50/mo (500/day) → Max $500/mo (5,000/day), billed via Stripe; `unlimited` is an admin grant. Success = a developer goes from signup → first API call → paid plan without ever needing support.

## Brand Personality

Terminal-native, confident, hacker-craft. The interface talks like a shell (`$ exploreyc --api`) and looks like a beautifully tuned terminal — monospace, YC orange `#FF6600` on near-black/near-white. For billing and docs the bar is Stripe-level clarity: pricing, quota, and keys must be legible at a glance even while the chrome stays playful.

## Anti-references

- Generic SaaS gradient-hero look (purple gradients, glassmorphism, hero-metric cards).
- Any palette pivot away from YC orange as the single brand anchor.
- Corporate-bland developer portals where the terminal identity is sanded off.

## Design Principles

1. **Terminal-native, cranked** — lean into prompt/console metaphors as structure (blocks, prompts, monospace data), never as noise over the task.
2. **Stripe-clear where money moves** — plans, quota, usage, and errors are explicit, numeric, and self-explanatory.
3. **One path, visible** — signup → key → first call → upgrade is always discoverable from any API surface.
4. **Orange is a signal** — YC orange marks actions, current state, and live data; it is never decoration.
5. **Both themes are first-class** — every surface ships tested in light and dark.

## Accessibility & Inclusion

WCAG AA contrast (≥4.5:1 body text) in both themes; `prefers-reduced-motion` alternatives for all animation; keyboard-reachable interactive elements.
