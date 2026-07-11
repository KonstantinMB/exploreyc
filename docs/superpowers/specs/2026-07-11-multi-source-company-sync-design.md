# Multi-source company sync — design

**Date:** 2026-07-11
**Status:** Approved for planning
**Author:** Konstantin + Claude
**Supersedes:** the standalone `scripts/exploreyc-sync-pr/` PR (TypeScript worker + generic schema)

## 1. Problem & context

ExploreYC ingests companies from two sources today (YC via the Algolia scraper in
`scraper_service.py`, a16z via the HTML scraper in `a16z_scraper_service.py`) into a
single `companies` table. The table already has a mature multi-source design:

- **Global IDs** via `sources.py` → `to_global_id(source, native_id)`, where every
  source gets a reserved 1e9-wide BIGINT block (`yc`=0, `a16z`=2e9). YC keeps offset 0
  so its ids/FKs are unchanged.
- **Per-source uniqueness**: `UNIQUE(source, slug)` and `UNIQUE(source, source_id)`.
- **Provenance already present**: each row carries `source`, `source_id`, `source_url`,
  and the full original payload in `raw_json`.
- **Source-aware UI**: `SourceBadge`, source filter dropdown, `getSources()`,
  dynamic `DatabasePage` columns, `CompanyDetailModal`.
- **Analytics/embeddings are YC-scoped**: market-size denominator
  (`database_postgres.py:811`), embedding backfill (`:873`), and the hero idea-validator
  similarity search (`:944`) all filter `WHERE source = 'yc'`.

A separate PR (`scripts/exploreyc-sync-pr/`) proposed a **standalone TypeScript worker
with its own generic schema** (UUID ids, `dedupe_key`, `text[]` arrays, `logo_url`,
`locations`, a duplicate yc-oss YC adapter). Applied as-is it would create a *second*
companies schema and a *second* ingestion stack with a different dedup philosophy — the
opposite of meshing. This design keeps the PR's genuinely-new ideas and drops the rest.

### Goals

1. Add **Hacker News** (Launch HN / Show HN) as a real new company source.
2. Establish a **Python source-adapter framework** so new sources are one file; ship
   **Product Hunt** and **Techstars** as stubs to prove it generalizes.
3. **Merge on domain**: the same company appearing in multiple sources (YC + Launch HN,
   a16z + YC, …) presents as a single card showing multiple source badges.
4. **Incremental cursor sync** for the new sources (`sync_state`), so daily runs pull
   deltas, not full refreshes.
5. **Vector search covers all sources.** Every new-source company gets an embedding via
   the existing automated backfill, and similarity retrieval searches the whole corpus
   (deduped by `dedupe_key`) — not just YC (see §3.8).
6. **Zero data loss** and **zero regression** to existing YC/a16z data, IDs, and the
   YC-scoped analytics metrics (market-size %, crowding).

### Non-goals (explicitly out of scope)

- Replacing the YC Algolia scraper or adopting yc-oss's delta feed (keep current setup).
- Physically merging rows / retiring the global-id scheme (canonical-row merge — rejected).
- Changing the **market-size % / crowding** metric's meaning: it stays a YC-denominated
  metric ("% of *YC* companies similar"), computed on a separate YC-only path so broadening
  retrieval does not reintroduce the prior over-counting bug (see §3.8).

## 2. Chosen approach: grouping-layer merge (option A)

Every per-source row stays in `companies` exactly as it is today. "Merge" is a **read-time
grouping** concern, not a destructive identity rewrite:

- Add a `dedupe_key` column (normalized **domain** if the company has a website, else
  `source:slug`) to every row and backfill it.
- The API/cache groups rows sharing a `dedupe_key` into one **canonical presentation**:
  a primary row for display + the set of contributing sources for the badge cluster.

Rejected alternatives: **B) canonical-row merge** (large, risky migration reassigning
ids/FKs, high analytics/embedding regression risk) and **C) separate `canonical_companies`
table** (most new surface, overkill at ~6k+ rows).

### Why this satisfies "no data loss" by construction

- No row is ever deleted or overwritten across sources: `insert_company` upserts
  `ON CONFLICT (id)`, and each source occupies a disjoint 1e9-wide id block, so source B
  can never clobber source A's row.
- Merge is purely a read-time grouping over untouched rows → fully reversible (drop the
  column / flag and behavior returns to today's).
- Upstream removals use **soft-delete** (never a hard delete), matching current behavior.
- `raw_json` retains the full original payload per source row.
- `dedupe_key` is additive; a wrong domain parse only affects grouping in the merged view,
  never the underlying source data.

## 3. Components

### 3.1 Schema changes (Postgres migration + SQLite parity)

Applies to **both** `supabase/migrations/` (Postgres) and `backend/database.py` (SQLite).

- `companies.dedupe_key TEXT` + partial index
  `CREATE INDEX ... ON companies (dedupe_key) WHERE dedupe_key IS NOT NULL`.
- New `sync_state` table (per-source incremental cursor):
  `source TEXT PK, last_run_at, last_cursor TEXT, last_status TEXT,
   records_upserted INT DEFAULT 0, error TEXT, updated_at`.
- **No** new `company_sources` table — existing per-row `raw_json` + `source_url` already
  are the provenance.
- Backfill `dedupe_key` for all existing rows (see 3.4) — authoritative pass done in
  Python via the shared normalizer so YC/a16z/HN parse domains identically.

### 3.2 Source registry (`sources.py`)

Add the three new sources so IDs, badges, filters, and `getSources()` pick them up:

```python
SOURCES += {
  "hackernews":  {"key": "hackernews",  "display_name": "Hacker News"},
  "producthunt": {"key": "producthunt", "display_name": "Product Hunt"},
  "techstars":   {"key": "techstars",   "display_name": "Techstars"},
}
SOURCE_ID_OFFSETS += {
  "hackernews":  3_000_000_000,
  "producthunt": 4_000_000_000,
  "techstars":   5_000_000_000,
}
```

HN `objectID`s are numeric and well under 1e9, satisfying `SOURCE_BLOCK_WIDTH`.

### 3.3 Ingestion framework (`backend/ingestion/`)

A new self-contained package (mirrors the existing flat-service style but grouped):

- **`normalize.py`** — Python port of the PR's helpers: `norm_domain`, `slugify`,
  `dedupe_key`, `country_from_locations`, plus a small **shared-host denylist**
  (`github.io`, `notion.site`, `vercel.app`, …) so unrelated companies on a shared host
  fall back to `source:slug` instead of false-merging.
- **`base.py`** — the adapter contract:
  - `SourceAdapter` protocol: `key`, `display_name`, `fetch(cursor, full) -> FetchResult`.
  - `FetchResult`: `rows: list[dict]` (already in ExploreYC column names), `cursor: str | None`,
    `removed_source_ids: list[str]`.
  - Each row dict maps to real columns: `name, slug, website, one_liner, long_description,
    small_logo_thumb_url, all_locations, batch, status, industry, subindustry, stage,
    team_size, tags (JSON str), industries (JSON str), regions (JSON str), country,
    is_hiring, top_company, nonprofit, source, source_id, source_url, raw_json,
    dedupe_key, year_founded, founders`.
- **`hackernews.py`** — ports the PR's Launch HN / Show HN title parsing
  (`"Launch HN: Acme (YC S26) – blurb"` → name/batch/blurb), queries
  `hn.algolia.com/api/v1/search_by_date` filtered on `created_at_i`, cursor =
  `max(created_at_i)`. `source_id` = HN `objectID`; `source_url` = the HN item link.
  Requires a URL/domain **or** a YC-batch marker to count as a company (drops noise).
- **`producthunt.py`, `techstars.py`** — stub adapters implementing the protocol with a
  documented `fetch()` TODO (endpoint + field mapping), so wiring/registry/UI are proven
  end-to-end and filling them in later is a single file.
- **`registry.py`** — maps source key → adapter instance; drives the orchestrator.
- **`sync_service.py`** — orchestrator:
  1. `cursor = sync_state[source].last_cursor`
  2. `result = adapter.fetch(cursor, full)`
  3. per row: `id = to_global_id(source, source_id)`; compute `dedupe_key`; `db.insert_company(row)`
     (existing upsert on `id` + `(source, source_id)`/`(source, slug)`)
  4. soft-mark `result.removed_source_ids` (never hard delete)
  5. persist new cursor + status to `sync_state`
  6. embedding backfill for the newly-upserted rows (see §3.8), then `company_cache.refresh(db)`

### 3.4 `dedupe_key` backfill

- Migration adds the column + index only.
- The **first `sync_service` run** (and a small idempotent `backfill_dedupe_keys()`
  utility) populate `dedupe_key` for every existing YC/a16z row using
  `normalize.norm_domain(website)` (else `source:slug`). Idempotent and re-runnable.

### 3.5 Merged presentation (`company_cache.py` + API)

- Add a `merged` grouping to the cache: when the caller requests the merged view, group
  loaded rows by `dedupe_key` and emit one canonical entry per group:
  - **Primary row** by source priority `yc > a16z > techstars > producthunt > hackernews`
    (richest/most-geocoded first).
  - **Gap-fill** missing display fields (`one_liner`, `small_logo_thumb_url`,
    `long_description`) from other rows in the group — presentation-level, non-destructive.
  - `is_hiring = any(...)` across the group.
  - Attach `merged_sources: [{key, source_url}]` for the badge cluster.
- **Default stays YC-only.** `CompanyFilter.source is None → YC only` is unchanged. Merging
  is a new explicit `merged: bool = false` flag on `CompanyFilter` (**not** overloaded onto
  `source`), so semantics are unambiguous:
  - Card surfaces (`CompaniesBrowser`, `CompanyDetailModal`, `CompanyPage`) request
    `merged=true` → grouped canonical entries with a badge cluster.
  - The `DatabasePage` **table keeps flat per-source rows** (`merged=false`) with its existing
    source-badge column, so the table's current row-level semantics are unchanged.
  - Similarity/search results dedupe by `dedupe_key` only when `merged=true`.
- Analytics endpoints (`/api/stats`, market-size %) keep their `WHERE source = 'yc'`
  queries untouched → **no counting regression**.

### 3.6 Scheduling / ops

- New `/api/cron/sync-sources` endpoint (protected by `CRON_SECRET`, same pattern as
  `/api/cron/daily-scrape` at `main.py:1714`) → `sync_service.run(all adapters)` →
  `company_cache.refresh(db)`.
- Add a step/time to `.github/workflows/daily-cron.yml` calling it.
- Optionally let `/api/scrape` accept `source="hackernews"` to dispatch a single-source
  manual run.
- **Delete** the PR's standalone `sync-companies.yml`.

### 3.7 Frontend (`frontend/src/`)

- `components/ui/SourceBadge.tsx`: add `hackernews`, `producthunt`, `techstars` branded
  badges + `sourceLabel()` cases.
- Render the `merged_sources` cluster (multiple badges) on `CompaniesBrowser` cards,
  `DatabasePage` rows, `CompanyDetailModal`, and `CompanyPage`.
- `Company` TS interface (`lib/api.ts`): add optional `dedupe_key?` and
  `merged_sources?: {key: string; source_url?: string}[]`.
- Source filter dropdown + `getSources()` pick up new sources automatically once rows
  exist; add a "merged" view affordance.
- Cards degrade gracefully for rows lacking `batch`/`all_locations` (HN launches).

### 3.8 Vector embeddings across all sources (`embedding_service.py`, `database_postgres.py`)

Vector search must cover the whole corpus. The pieces already exist (pgvector column,
HNSW index, batched generation, automated daily backfill) — the change is to stop scoping
them to YC. Three edits, plus one preservation:

- **Generation — cover all sources.** `get_companies_for_embedding` (`database_postgres.py:873`)
  and the parallel counters (`:811`/`:822`) currently hardcode `WHERE source = 'yc'`.
  Generalize the *embedding backfill* query to return every source's rows missing an
  `embedding` (keep it batched). `build_company_embedding_text` already uses
  `name, one_liner, long_description, industry, subindustry, tags, industries`, which HN /
  Product Hunt / Techstars rows populate well enough (with graceful fallback when sparse).
  The HNSW index at `20260710…` already covers the column regardless of source, so new
  vectors are query-visible immediately — directly avoiding the prior "new companies
  disappeared from search" (IVFFlat) regression.
- **Retrieval — search all sources.** `find_similar_companies_by_embedding`
  (`database_postgres.py:944`, filters `source = 'yc'` at `:980`/`:1023`) drops the source
  filter so similarity spans the full corpus, and **dedupes results by `dedupe_key`** (via
  a `DISTINCT ON (dedupe_key)` / window over cosine distance) so a company present in
  multiple sources returns once, tagged with its `merged_sources`.
- **Backfill wiring.** `sync_service` embeds newly-upserted rows in the same run; the
  existing daily embedding backfill (already automated) is broadened to all sources as the
  catch-all. New sources therefore get vectors without a manual step.
- **Preserve the YC-scoped metric.** The **market-size % / crowding** computation
  (`database_postgres.py:842`, currently `AND source = 'yc'`) keeps its own YC-only
  numerator+denominator path, unchanged. Broadened retrieval feeds the *similar-companies
  list*; it does **not** feed the metric's counts. This keeps "% of YC companies" honest
  and avoids re-triggering the market-size over-counting bug.

**Cost note:** embedding the added corpus (HN + stubs) is a one-time batched backfill plus
small daily deltas — negligible against the existing ~6k YC embeddings.

| From the PR | Disposition |
| --- | --- |
| HN Launch/Show parsing, cursor concept, domain dedupe | **Keep**, ported to Python |
| Generic UUID migration, `text[]`, `logo_url`/`locations` | **Drop** (conflicts with real schema) |
| Redundant yc-oss YC adapter | **Drop** (YC stays on Algolia) |
| Standalone TS worker (`scripts/sync/**`) + `sync-companies.yml` | **Drop** (fold into Python cron) |
| Separate `company_sources` provenance table | **Drop** (row `raw_json`/`source_url` suffices) |

## 5. Data flow

```
daily cron ─▶ /api/cron/sync-sources ─▶ sync_service.run()
     for each adapter (hackernews, [producthunt], [techstars]):
        sync_state.last_cursor ─▶ adapter.fetch(cursor) ─▶ rows + new cursor
        rows ─▶ to_global_id + dedupe_key ─▶ db.insert_company (upsert on id)
        new cursor ─▶ sync_state
     company_cache.refresh(db)

read path (merged view):
   cache rows ─grouped by dedupe_key─▶ primary + merged_sources[] ─▶ API ─▶ UI badge cluster
```

## 6. Testing (matches `backend/test_*.py` style)

- `test_normalize.py`: `norm_domain` (www/path/port stripping, denylist), `slugify`,
  `dedupe_key`, `country_from_locations`.
- `test_hackernews_parse.py`: title-parsing fixtures from real Launch/Show HN titles
  (with/without `(YC S26)`, em/en dash variants, non-company noise).
- `test_merge_grouping.py`: rows across sources sharing a domain collapse to one canonical
  entry with correct primary selection, gap-fill, and `merged_sources`.
- `test_embedding_all_sources.py`: `get_companies_for_embedding` returns non-YC rows;
  `find_similar_companies_by_embedding` returns cross-source matches deduped by `dedupe_key`;
  and the market-size % path stays YC-only (regression guard).
- `sync_service` dry-run against live HN (bounded lookback) as a smoke check.

## 7. Risks & mitigations

- **False merges on shared hosts** → domain denylist + `source:slug` fallback.
- **HN noise (non-company Show HN posts)** → require URL/domain or YC-batch marker; source
  tag allows later filtering.
- **Merged-view correctness vs. YC-only analytics** → merge is read-only and opt-in;
  market-size %/crowding keep their separate `WHERE source = 'yc'` path (§3.8).
- **Broadened retrieval changing hero results** → intended (search now spans all sources),
  but the market-size metric is preserved on its own path; regression guarded by
  `test_embedding_all_sources.py`.
- **Sparse embedding text for HN/stub rows** → `build_company_embedding_text` fallback
  handles missing industry/tags; embedding still keys on name + one_liner + description.
- **SQLite/Postgres drift** → schema change applied to both; tests run on SQLite locally.
  (Note: vector retrieval is Postgres/pgvector-only, as today.)

## 8. Rollout

1. Migration (+ SQLite parity) — additive only.
2. Register sources, ship ingestion package + HN adapter (+ stubs), backfill `dedupe_key`.
3. Broaden embedding generation + retrieval to all sources (§3.8), keeping the YC-only
   market-size path separate; run a one-time all-source embedding backfill.
4. Wire merged read path + cron endpoint (behind opt-in flag), keep default YC-only.
5. Frontend badges + merged cluster.
6. Trigger a bounded HN run, verify grouping + cross-source vector hits, then enable in
   daily cron.
