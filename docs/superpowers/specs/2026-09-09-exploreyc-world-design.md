# ExploreYC World — Design Spec

**Date:** 2026-09-09
**Status:** Approved by owner (sections 1–10 + placement), pending spec review
**Working name:** ExploreYC World ("World" in nav; final branding open)

## What this is

ExploreYC absorbs the standalone `startupworld` product (sibling repo,
`../startupworld`) as a flagship in-product feature: a gamified 3D globe where
founders pay to own a named pin ("plot") for their startup at real coordinates,
every dollar scores for their country, and world/country/city leaderboards make
the top spot always within reach of somebody. A second revenue stream sells
time-boxed promoted placement on the map. ExploreYC is the product; World is a
feature of it. The standalone startupworld repo becomes donor code only and is
not deployed.

`startupworld` is a working Next.js 16 + three.js implementation (~35k lines)
with a proven Stripe checkout/webhook design. This spec ports its lean core
into the ExploreYC stack: React 19 + Vite SPA frontend, FastAPI backend,
dual SQLite/Postgres database layer, existing `api_users` accounts, existing
Stripe account.

## Why full port (decision record)

Alternatives considered and rejected by owner:
- **Subdomain deploy + account bridge** (fastest): rejected — owner wants one
  product, one codebase, one auth.
- **Subdomain with separate accounts**: rejected for the same reason.

Chosen: full port into yc-company-scraper. Cost is a substantial rewrite of
server code (18 Next.js API routes → FastAPI, Drizzle → dual DB layer), but
frontend globe/wizard components are plain react-three-fiber React and port
mechanically.

## V1 scope (owner-approved "lean cut + OG cards")

**In:** globe with LOD + device-tier fallbacks; country/city/world
leaderboards (countries: richest / most planted / rising-24h; founders:
staked / pioneers); claim-and-stake flow via ExploreYC accounts; plot
management (edit identity, top up stake); ~22k seed pins derived from the
`companies` table; mobile bottom-sheet UX; OG share cards; promotions
(self-serve featured + admin sponsor slots); ticker/world-pulse strip.

**Out (deferred):** clicks board + click tracking, urban-areas 3D layer,
moderation review UI (keyword flagging to `pending` still runs; review is
manual SQL for launch), dofollow-link SEO logic, retiring/archiving the
startupworld repo, email notifications of any kind.

## 1. Routes and placement

Chrome-less full-screen route group in the SPA (same pattern as `/validator`):

- `/world` — globe home. The map is the page; everything floats over it in
  cards. Desktop rail; on mobile a fixed bottom CTA bar opens a bottom-sheet
  drawer (ports startupworld's `HomeExperience` pattern).
- `/world/c/:iso` — country page: country boards, city boards, claim CTA.
- `/world/p/:id` — plot permalink (share target; OG card points here).
- `/world/claim` — 3-step wizard: PlacePicker → IdentityForm → AmountPicker →
  Summary. State survives back-navigation; steps unlock progressively.
- Manage lives on `/world/p/:id` when the viewer owns the plot (edit + top-up
  + promote controls appear). No separate manage route.

**Placement:** `World` becomes a primary Navbar tab (not under "more") and a
mobile bottom-nav entry, plus a homepage entry card. This is a flagship
feature.

## 2. Identity

Buyers are ExploreYC developer accounts (`api_users`). The claim wizard
requires login; inline login/signup step reuses `DevAuthContext`
(localStorage bearer token, `POST /api/dev/signup|login`, `GET /api/dev/me`).

This deletes startupworld's magic-link + manage-token subsystem entirely.
"Manage my plot" = session-authed `PATCH` where `plot.user_id = me`. The
unwired-email launch blocker in startupworld disappears; no email provider is
needed for v1.

Founder identity (name, optional title/photo/link) is optional per-plot data,
not an account concept.

## 3. Data model

New tables — Supabase migration `supabase/migrations/<ts>_world.sql` (additive,
idempotent) **plus** the hand-mirrored SQLite DDL in `database.py` (inline
`CREATE TABLE IF NOT EXISTS`). Every DB method is written twice
(`database.py` + `database_postgres.py`) per the established pattern.

- `world_countries` — iso2 PK, name, centroid lat/lng. Seeded from
  startupworld's seed data (239 countries).
- `world_cities` — id PK, name, country_iso FK, lat, lng, population. Seeded
  from startupworld's seed data (7,328 cities).
- `world_plots` — id PK; `user_id` FK → api_users (always set — seeds are virtual, see below);
  `company_id` FK → companies (nullable; set for seeds and for claimed
  company plots); name; url; tagline; founder_name, founder_title,
  founder_link (all nullable); logo_url (reuse existing avatar/base64
  data-URL pattern); lat, lng; country_iso FK; city_id FK (nullable —
  nearest city within 50 km snap radius, else null); total_cents int;
  status `active | pending`; created_at, updated_at.
  Indexes: (country_iso), (city_id), (total_cents desc), (user_id).
- `world_payments` — id PK; plot_id FK; user_id FK; `stripe_session_id`
  UNIQUE (the idempotency key — DB-enforced, not application-checked);
  amount_cents; created_at.
- `world_promotions` — id PK; kind `featured | sponsor`; plot_id FK
  (nullable — null for admin sponsor slots); user_id FK (nullable);
  label, url, logo_url (for sponsor slots without a plot); country_iso
  (nullable = global scope); starts_at, ends_at; amount_cents;
  `stripe_session_id` UNIQUE nullable; status `active | expired | revoked`;
  created_at.

**Seed pins are virtual — no rows are materialized.** `GET /api/world/globe`
unions `world_plots` with geo-located `companies` rows (excluding companies
already claimed via `world_plots.company_id`), rendering every YC/a16z
company as a muted pin. Because leaderboards read only `world_plots`, seeds
are excluded from every board by construction (protecting "Most Planted",
the board small countries can win). Claiming a seed: checkout carries
`company_id`; the webhook creates the plot owned by the buyer. Pitch:
"Your startup is already on the globe — claim it."

## 4. Payments

Same Stripe account as API billing. One-time payments, not subscriptions.

- `POST /api/world/checkout` (dev-session auth, in new `backend/world.py`
  router mounted like billing's): validates via Pydantic; resolves
  lat/lng → country + city **server-side** (client geography is never
  trusted); rejects ocean points; creates hosted Checkout Session with
  `mode="payment"` and ad-hoc `price_data` (stake amount, **$5.00 floor**);
  sets `client_reference_id=user_id` and
  `metadata = {product: "world_plot", user_id, lat, lng, company_id?,
  plot_id?}` mirrored to the PaymentIntent. Writes nothing to the DB.
  Errors map to 400/500/503 — never 502/504 (Cloudflare replaces origin
  502s with a CORS-less error page).
- Promotion checkout: same endpoint family
  (`POST /api/world/promotions/checkout`), `metadata.product =
  "world_promotion"`, fixed tiers (constants in `backend/world_constants.py`;
  launch pricing: 7 days $19, 30 days $49 — adjustable without migration).
  Scarcity cap enforced at checkout time: max 3 concurrently active
  `featured` promotions per country (global scope counts separately);
  checkout refuses when full.
- **Webhook:** the existing `POST /api/stripe/webhook` remains the single
  endpoint and the sole writer of money. `handle_stripe_event` in
  `billing.py` branches on `checkout.session.completed` **before** any
  subscription logic: sessions with `mode == "payment"` (or a
  `metadata.product` of `world_plot`/`world_promotion`) route to world
  fulfillment and never reach `apply_subscription_state`. This also fixes
  the pre-existing hazard where a one-time session would resolve
  `plan_for_price("") → None → "free"` and silently downgrade a paying
  Pro/Max subscriber.
- Fulfillment (single transaction): credit `session.amount_total` (the
  receipt, not the requested amount); insert `world_payments`; on unique
  violation of `stripe_session_id`, treat as already-processed success;
  increments use SQL `total_cents = total_cents + :n`, never
  read-modify-write; top-ups ignore all text fields so checkout can't
  become an unmoderated edit path; new plots run the keyword-moderation
  check (`pending` on hit). Non-handled event types return 200.

## 5. Backend endpoints (`backend/world.py`)

Public reads (no auth, cached where cheap):
- `GET /api/world/globe` — pins for rendering (id, lat, lng, name, tier
  bucket by stake, status, promoted flag).
- `GET /api/world/board?kind=richest|planted|rising&scope=world|country:XX|city:N`
  — ranks via `rank()` window functions over the full set (joint ranks are
  real; SQLite ≥ 3.25 supports window functions). Response includes
  `cents_to_beat` for the viewer's next rank where leader stake is known,
  else an explicit unknown flag (never guess a price).
- `GET /api/world/founders?kind=staked|pioneers`
- `GET /api/world/country/{iso}`, `GET /api/world/plots/{id}`
- `GET /api/world/where?lat=&lng=` — server geography: shapely
  point-in-polygon over the world-atlas countries topojson (shipped in
  `backend/data/`), nearest-city snap within `CITY_SNAP_RADIUS_KM = 50`.
- `GET /api/world/pulse` — ticker feed (recent plants/top-ups/promotions).
- `GET /api/world/promotions?scope=` — active featured + sponsor slots.

Authed (dev session):
- `POST /api/world/checkout`, `POST /api/world/promotions/checkout`
- `PATCH /api/world/plots/{id}` — owner-only identity edits (re-runs
  moderation).
- `POST /api/world/plots/{id}/logo` — reuse the avatar upload pattern.
- `GET /api/world/mine` — my plots + active promotions.

Admin (existing admin session auth):
- `POST /api/admin/world/promotions` / `DELETE .../{id}` — sponsor slots
  with arbitrary label/logo/url + date range, kind `sponsor`, no payment.

Gamification constants (`backend/world_constants.py`, mirrored in a frontend
constants module): `MIN_STAKE_CENTS = 500`, `OVERTAKE_MARGIN_CENTS = 100`,
`CITY_SNAP_RADIUS_KM = 50`, promotion tiers and caps.

## 6. Frontend port

- `frontend/src/components/world/globe/` — copied from startupworld
  `src/components/globe/` minus `UrbanAreas`: GlobeScene, CountryFills,
  CountryBorders, PlotColumns (instanced pins), CityLabels, CountryLabels,
  PlotLabels, Atmosphere, Shockwave, useLevelOfDetail, labelLayout,
  useGlobeCamera. Port is mechanical: strip `'use client'`,
  `next/navigation` → React Router, `motion` → `framer-motion`, Tailwind v4
  utility audit → v3 equivalents. Keep WebGL capability probe, device-tier
  detection (`hardwareConcurrency`/`deviceMemory`/coarse-pointer), DPR
  scaling, error boundary with card fallback, reduced-motion paths
  (idle rotation, shockwave, rank slide all have static alternatives).
- New deps: `three`, `@react-three/fiber`, `@react-three/drei`, `d3-geo`,
  `topojson-client`, `world-atlas`. All lazy-loaded behind the `/world`
  route (`React.lazy`, same as MapPage) so the globe bundle never taxes the
  rest of the app.
- Claim wizard ported to `frontend/src/components/world/claim/` with an
  inline auth step when logged out.
- Data fetching via TanStack Query; pulse/ticker polls.
- Viewport: `/world` pages set `maximumScale=1` behavior equivalently
  (touch-action management) so pinch doesn't fight OrbitControls.

## 7. Design language

ExploreYC's, not startupworld's: monospace/terminal idiom, YC orange
`#FB651E` strictly as signal (actions, live data, promoted markers), existing
HSL tokens from `frontend/src/index.css`, `PageHeader` voice
(`$ exploreyc --world`) on board surfaces, `HackerCard`/`DotPattern` where
panels are needed. **Both themes first-class**: the globe gets light and dark
ground/atmosphere/fill palettes driven by the existing `darkMode` context
(as the CARTO basemap already does on MapPage). What survives from
startupworld is the physicality: hard offset press shadows, rank-slide with
direction arrows (never color alone), plant shockwave, count-up numbers.

Honesty rules carry over verbatim: "No prize, no payout, no refund" plainly
legible on claim surfaces; promoted pins always carry a visible "Promoted"
label; sponsor slots labeled "Sponsor"; never print a cents-to-beat number
that isn't known. WCAG 2.2 AA in both themes; visible focus rings; full
keyboard path through claim → checkout.

## 8. Promotions surfaces

- Promoted plots: orange beacon treatment on the pin + "Promoted" label,
  slot in a "Featured" rail card on `/world` and on their country page,
  inclusion in the ticker.
- Sponsor slots: same rail, "Sponsor" label, arbitrary link-out.
- Expiry is data-driven (`ends_at` passes → excluded from queries); a cron
  step in the existing daily job flips `status` to `expired` for hygiene.

## 9. OG share cards

Vercel serverless function in the repo's existing `api/` directory using
`@vercel/og`: `/api/og/world?plot=:id` and `/api/og/world?country=:iso`,
fetching display data from the backend public endpoints, rendered in
ExploreYC card style (monospace, orange accents, rank + stake + country).
Filesystem functions take precedence over the `/api/:path*` rewrite, so no
proxy collision. `/world/p/:id` and `/world/c/:iso` set OG meta via
react-helmet-async pointing at these images.

## 10. Testing & verification

Backend (`backend/test_world.py`, pattern of `test_billing.py` — fakes, no
network): checkout validation (floor, ocean rejection, geography resolution),
webhook branching with the explicit regression test *a `mode=payment`
session must never modify `api_users.plan`*, fulfillment idempotency
(duplicate session id → success, single credit), top-up ignores text fields,
`cents_to_beat` including unknown-leader case, board ranking with joint
ranks, promotion caps, seed exclusion from boards.

Frontend: no test suite exists; verification is the established
stub-FastAPI + Playwright screenshot loop — both themes, 1440×900 and
375×812, claim flow keyboard-only pass.

Launch checklist: live-mode $5 self-purchase end to end; Stripe webhook
pointed directly at the backend host (never through Vercel rewrites);
Stripe Tax enabled for the one-time products.

## Deployment notes

No new infrastructure. Backend ships with existing host (CLAUDE.md says
Render; a memory says Railway serves api.exploreyc.com — **verify which is
live before setting env/webhook expectations**; treat the host serving
api.exploreyc.com as authoritative). No new env vars beyond what exists
(`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` already set). Frontend deps
grow by the three.js cluster, lazy-loaded. `shapely` added to
`requirements.txt`.

## Risks

- **Tailwind v4 → v3 utility drift** in ported components — audit pass
  required; visual diffs caught by the screenshot loop.
- **Dual DB layer**: every method twice; SQLite window-function parity
  needs the bundled SQLite ≥ 3.25 (true for Python 3.11).
- **Globe bundle size** on mobile data — mitigated by lazy route split and
  the existing device-tier degradation.
- **SPA SEO** is weaker than startupworld's SSR — accepted for v1; OG cards
  carry the sharing story.
