# Founder Leaderboards + Centralized Founder Dataset — Design Spec

**Date:** 2026-07-15
**Status:** Draft for review
**Author:** Konstantin (with Claude Code)

## 1. Summary

Build a centralized, deduplicated dataset of Y Combinator **founders** (the people, not their
companies), and expose it as **shareable leaderboards + founder "rank cards"** — a viral surface
where founders post "I'm the #4 most-funded YC founder" and drive their audience back to ExploreYC.

Two data-sourcing scripts feed it:

- **Script 1 — YC sourcing (authoritative):** scrape founder records from each YC company's public
  detail page and build the founder ↔ company graph. Free, grounded, reliable.
- **Script 2 — LLM enrichment (supplementary):** use Perplexity `sonar-pro` (web-grounded, cited)
  to add off-YC signals (social following, education, awards, notable exits) as *labeled, cited,
  confidence-scored* extras.

The core leaderboard rankings run on **authoritative derived data only**. Enrichment is
supplementary and never overrides an authoritative ranking.

## 2. Goals & non-goals

**Goals**
- A `founders` dataset with reliable serial-founder dedup across companies.
- 4 shareable leaderboards in v1: serial founders, most funded, biggest exits, unicorn founders.
- Founder profile page + one-click shareable rank card (PNG → X/LinkedIn), reusing existing share infra.
- Two repeatable, incremental scripts wired into the existing cron pipeline.

**Non-goals (v1)**
- Founders from non-YC sources (a16z / HN / Product Hunt / Techstars) — those sources don't expose
  structured founder data. YC only for now.
- A composite "founder score" — start with per-metric leaderboards; composite is a later addition.
- Net-worth estimation — undiscoverable/unreliable for non-famous founders; explicitly dropped.
- Founder-claims / auth ("this is me, edit my profile") — later.

## 3. Verified facts (from investigation, 2026-07-15)

- YC's Algolia index `YCCompany_production` contains **company-level fields only** — no founders.
- Founder data lives on `https://www.ycombinator.com/companies/{slug}` inside an **Inertia.js
  `data-page` JSON blob**. Each founder object has:
  `user_id`, `full_name`, `title`, `founder_bio`, `linkedin_url`, `twitter_url`,
  `avatar_thumb_url`, `is_active`, `latest_yc_company`.
- **`user_id` is a stable dedup key** — the same founder carries the same `user_id` across every
  company they founded. Serial-founder dedup needs no fuzzy name matching.
- `avatar_thumb_url` is a **signed S3 URL that expires (~1h)** — cannot be stored as-is; must be
  downloaded once into our own storage.
- The current `founders` column is an unused `TEXT` field — greenfield, no migration conflict.
- Leaderboard stats are **mostly derived**: once founder→company edges exist, total funding,
  biggest exit, unicorn status, and headcount all aggregate from company fields we already store
  (`funding_total_usd`, `valuation_usd`, `exit_type`, `acquirer`, `employee_count`, `batch`).

## 4. Data model

New migration: `supabase/migrations/20260715000000_founder_leaderboards.sql`
(with matching SQLite DDL in `database.py` / factory, per existing dual-DB pattern).

### 4.1 `founders` (authoritative)
| column | type | notes |
|---|---|---|
| `id` | BIGINT PK | internal |
| `yc_user_id` | BIGINT UNIQUE | dedup key from YC `user_id` |
| `full_name` | TEXT | |
| `slug` | TEXT UNIQUE | URL slug, e.g. `patrick-collison` (derived from name + yc_user_id on collision) |
| `bio` | TEXT | YC `founder_bio` |
| `avatar_url` | TEXT | our re-hosted avatar (see 5.4) |
| `linkedin_url` | TEXT | |
| `twitter_url` | TEXT | |
| `is_active` | BOOLEAN | |
| `created_at` / `updated_at` | TIMESTAMP | |

### 4.2 `company_founders` (junction)
| column | type | notes |
|---|---|---|
| `company_id` | BIGINT FK → companies.id | |
| `founder_id` | BIGINT FK → founders.id | |
| `title` | TEXT | e.g. "Founder/CEO" |
| `source` | TEXT | default `yc` |
| PK | (`company_id`, `founder_id`) | |

### 4.3 `founder_stats` (derived — materialized view, refreshed post-sync)
Aggregation over `company_founders ⋈ companies`:
`founder_id`, `companies_count`, `batches` (array), `latest_batch`, `total_funding_usd`,
`max_valuation_usd`, `has_unicorn` (max_valuation ≥ $1B), `best_exit_type`, `best_exit_acquirer`,
`total_employee_count`, `is_repeat_founder` (companies_count > 1).

Refresh happens where embeddings / leaderboard views are already refreshed at end of sync
(`ingestion/sync_service.py`). SQLite fallback: recompute into a plain table.

### 4.4 `founder_enrichment` (supplementary — separate table, never overrides authoritative)
`founder_id` FK, `twitter_followers`, `linkedin_followers`, `education` (JSONB),
`awards` (JSONB), `notable_exits` (JSONB), `angel_investments_count`,
`notable_prior_roles` (JSONB), `bio_long` (TEXT), `citations` (JSONB), `confidence` (TEXT/JSONB
per-field), `model` (TEXT), `raw_response` (JSONB), `enriched_at` (TIMESTAMP).
Doubles as the enrichment cache (upsert per founder, TTL via `enriched_at`).

## 5. Script 1 — YC founder sourcing (`founder_scraper_service.py`)

Authoritative, free, grounded. New service file following the existing service pattern.

### 5.1 Flow
1. Select `source='YC'` companies with a non-null `slug` from the DB.
2. For each slug: `GET https://www.ycombinator.com/companies/{slug}`, extract the `data-page`
   attribute, `html.unescape` + `json.loads`, read `props.company.founders[]`.
3. Upsert each founder by `yc_user_id`; insert `(company_id, founder_id, title)` edge.
4. Re-host avatar once (see 5.4).
5. After all companies: refresh `founder_stats`.

### 5.2 Concurrency & politeness
- `asyncio` with a semaphore (~6 concurrent), exponential backoff on 429/5xx, per-request timeout.
- Respects the same HTTP client / header conventions as `scraper_service.py`.

### 5.3 Incremental
- Cursor in `sync_state` (same pattern as other adapters). Daily run only fetches companies whose
  page hasn't been scraped or whose `company.updated_at` changed. `--full` forces a rebuild.

### 5.4 Avatars (resolved: download-once)
Signed S3 URLs expire, so on first sight we download the image and re-host it in **Supabase
Storage** (prod) / local static dir (dev), storing our own stable URL in `founders.avatar_url`.
Re-download only if missing.

### 5.5 Trigger surface
- `/api/cron/sync-founders` (CRON_SECRET bearer, like existing cron jobs).
- Callable function for local/manual runs (documented in CLAUDE.md seeding section).

## 6. Script 2 — LLM founder enrichment (`founder_enrichment_service.py`)

Supplementary, web-grounded, cited. Reuses the `perplexity_service.py` engine + citation pattern.

### 6.1 Engine
Perplexity `sonar-pro` with a **JSON-schema structured response** → grounded JSON + citations in one
call. Optional cheap OpenAI structured-output normalization pass if Perplexity JSON drifts from the
Pydantic schema.

### 6.2 Flow
1. Select founders to enrich — **prioritized** (leaderboard candidates + top by derived stats first),
   with `--all` to backfill the entire table and a cron path to drain the backlog over time.
   On-demand enrichment also fires the first time a founder profile is viewed (if stale/missing).
2. Query template: *"Verified public stats for {full_name}, {title} at {company}, YC {batch}:
   X/Twitter followers, LinkedIn followers, education, notable exits, awards, angel investments.
   Only include facts you can cite."*
3. Perplexity call → structured JSON + citations → Pydantic validation → upsert into
   `founder_enrichment`.
4. TTL: skip founders enriched < 30 days ago; re-enrich stale rows (follower counts drift).

### 6.3 Reliability guardrails (load-bearing)
- **Every enriched field requires ≥1 citation** — uncited values are dropped, not stored.
- Each field carries a **confidence** signal.
- Enriched values are **labeled "estimated / web-sourced"** in the UI.
- Enrichment **never drives authoritative leaderboards** (funded / exits / unicorns / serial). A
  "most-followed YC founders" board may exist but is explicitly flagged as web-sourced/estimated.

### 6.4 Cost control
Prioritized batching + 30-day TTL cache + on-demand-on-view means we don't blast thousands of paid
calls up front. `--all` exists for a deliberate full backfill; the daily cron drains remaining
founders in bounded batches.

## 7. Viral surface — leaderboards, profiles, rank cards

### 7.1 Backend (in `main.py`)
- `GET /api/founders/leaderboard?metric=&batch=&industry=&limit=&offset=` → ranked founders +
  stats + rank position. `metric ∈ {serial, funded, exits, unicorns}` in v1.
- `GET /api/founders/{slug}` → founder profile: authoritative stats, their companies, enrichment
  (labeled), and every leaderboard rank/badge they hold.

### 7.2 Frontend
- `/founders/leaderboard` — ranked, filterable page reusing DatabasePage table patterns; also an
  evergreen, indexable page (SEO bonus on top of the viral goal).
- `/founder/{slug}` — profile page; companies, stats, rank badges, share button.
- **Founder rank card** — reuses existing `TradingCard` + `html2canvas` (`useImageExport`) +
  `SocialShareButtons`. Card: avatar, name, companies, headline stat, rank badge
  ("#4 most-funded YC founder") → one-click PNG → X/LinkedIn/Reddit + copy.

## 8. Data provenance model

Two tiers, never mixed in rankings:
- **Authoritative** (`founders`, `company_founders`, `founder_stats`) — sourced from YC + derived
  from existing company data. Drives all core leaderboards.
- **Supplementary** (`founder_enrichment`) — LLM/web-sourced, cited, confidence-scored, UI-labeled.
  Adds profile flavor and at most a clearly-flagged "most-followed" board.

## 9. Rollout phases

1. **Migration + Script 1** → populate `founders` / `company_founders`, refresh `founder_stats`.
2. **Backend leaderboard + profile endpoints.**
3. **Frontend** leaderboard page, profile page, rank card.
4. **Script 2 enrichment** (prioritized) + UI labels + optional "most-followed" board.
5. **Cron wiring** — `/api/cron/sync-founders` daily; enrichment backfill drain.

## 10. Testing

- Script 1: unit-test the `data-page` parser against a saved fixture of a real YC company page;
  integration test upsert + dedup (same `yc_user_id` across two companies → one founder, two edges).
- Stats: SQL test that derived aggregates match hand-computed values on a seed set.
- Script 2: mock Perplexity; assert uncited fields are dropped and TTL skip works.
- Endpoints: pagination + metric switching (mirrors existing `test_pagination.py` style).

## 11. Resolved decisions

- Rank **founders** (not companies/investors/cities).
- Dedup on YC `user_id`.
- Avatars: **download-once** to our storage.
- v1 leaderboards: serial, funded, exits, unicorns.
- Enrichment: **drop net worth**; **supplementary + cited**; prioritized scope with `--all` backfill.
- YC-only founders in v1.

## 12. Open questions

- Supabase Storage bucket name/policy for avatars (or reuse an existing bucket?).
- Exact Perplexity monthly enrichment budget cap for the cron backfill drain.
- Whether the "most-followed" board ships in v1 or waits until enrichment coverage is high enough.
