-- =============================================================================
-- Founder Leaderboards + centralized founder dataset (design spec 2026-07-15).
-- Additive, idempotent DDL only — no existing rows/ids/FKs are changed.
--
-- Two data tiers, never mixed in rankings (spec §8):
--   * AUTHORITATIVE: founders, company_founders, founder_stats — sourced from YC
--     (Script 1) + derived from existing company fields. Drives all core boards.
--   * SUPPLEMENTARY: founder_enrichment — LLM/web-sourced, cited, confidence-scored,
--     UI-labeled. Never drives an authoritative ranking.
--
-- founder_stats is a MATERIALIZED VIEW refreshed at the end of a founder sync
-- (REFRESH MATERIALIZED VIEW CONCURRENTLY — requires the unique index below).
-- =============================================================================

-- 1. founders (authoritative) — the deduplicated people, keyed on YC user_id.
CREATE TABLE IF NOT EXISTS founders (
    id           BIGSERIAL PRIMARY KEY,
    yc_user_id   BIGINT UNIQUE,          -- stable dedup key from YC `user_id`
    full_name    TEXT NOT NULL,
    slug         TEXT UNIQUE,            -- URL slug, e.g. patrick-collison-<id>
    bio          TEXT,                   -- YC `founder_bio`
    avatar_url   TEXT,                   -- our re-hosted avatar (see spec §5.4)
    linkedin_url TEXT,
    twitter_url  TEXT,
    is_active    BOOLEAN,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. company_founders (junction) — the founder <-> company graph, one row per edge.
CREATE TABLE IF NOT EXISTS company_founders (
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    founder_id BIGINT NOT NULL REFERENCES founders(id) ON DELETE CASCADE,
    title      TEXT,                     -- e.g. "Founder/CEO" (per-company)
    source     TEXT NOT NULL DEFAULT 'yc',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (company_id, founder_id)
);

CREATE INDEX IF NOT EXISTS idx_company_founders_founder ON company_founders(founder_id);
CREATE INDEX IF NOT EXISTS idx_company_founders_company ON company_founders(company_id);

-- 3. founder_enrichment (supplementary — separate table, never overrides authoritative).
--    Doubles as the enrichment cache: upsert per founder, TTL via enriched_at.
CREATE TABLE IF NOT EXISTS founder_enrichment (
    founder_id            BIGINT PRIMARY KEY REFERENCES founders(id) ON DELETE CASCADE,
    twitter_followers     INTEGER,
    linkedin_followers    INTEGER,
    education             JSONB,
    awards                JSONB,
    notable_exits         JSONB,
    angel_investments_count INTEGER,
    notable_prior_roles   JSONB,
    bio_long              TEXT,
    citations             JSONB,          -- flat list of source URLs
    confidence            JSONB,          -- per-field confidence signal
    model                 TEXT,
    raw_response          JSONB,          -- full model payload for audit
    enriched_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. founder_stats (derived) — MATERIALIZED VIEW over company_founders ⋈ companies.
--    Only authoritative company fields are aggregated here.
CREATE MATERIALIZED VIEW IF NOT EXISTS founder_stats AS
SELECT
    cf.founder_id                                                    AS founder_id,
    COUNT(DISTINCT c.id)                                             AS companies_count,
    ARRAY_AGG(DISTINCT c.batch) FILTER (WHERE c.batch IS NOT NULL)   AS batches,
    MAX(c.batch)                                                     AS latest_batch,
    COALESCE(SUM(c.funding_total_usd), 0)                            AS total_funding_usd,
    COALESCE(MAX(c.valuation_usd), 0)                                AS max_valuation_usd,
    (COALESCE(MAX(c.valuation_usd), 0) >= 1000000000)                AS has_unicorn,
    (ARRAY_AGG(c.exit_type ORDER BY c.valuation_usd DESC NULLS LAST)
        FILTER (WHERE c.exit_type IS NOT NULL))[1]                   AS best_exit_type,
    (ARRAY_AGG(c.acquirer ORDER BY c.valuation_usd DESC NULLS LAST)
        FILTER (WHERE c.acquirer IS NOT NULL))[1]                    AS best_exit_acquirer,
    COALESCE(SUM(c.employee_count), 0)                               AS total_employee_count,
    (COUNT(DISTINCT c.id) > 1)                                       AS is_repeat_founder
FROM company_founders cf
JOIN companies c ON c.id = cf.company_id
GROUP BY cf.founder_id;

-- Unique index on founder_id is REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS uq_founder_stats_founder ON founder_stats(founder_id);

-- Leaderboard sort columns.
CREATE INDEX IF NOT EXISTS idx_founder_stats_companies ON founder_stats(companies_count DESC);
CREATE INDEX IF NOT EXISTS idx_founder_stats_funding   ON founder_stats(total_funding_usd DESC);
CREATE INDEX IF NOT EXISTS idx_founder_stats_valuation ON founder_stats(max_valuation_usd DESC);

-- Operational tables — service-role-only, matching the app's other internal tables
-- (the sync/cron worker uses the service key and bypasses RLS). No anon policies.
ALTER TABLE founders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_founders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_enrichment ENABLE ROW LEVEL SECURITY;
