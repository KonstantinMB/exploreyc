-- =============================================================================
-- Company funding provenance (2026-07-16).
--
-- Funding data (total raised, valuation, employee count, last round) is now sourced
-- from Perplexity `sonar-pro` (web-grounded, cited) instead of CoreSignal — CoreSignal
-- was too expensive. These company funding fields feed the Founder Leaderboards'
-- "Most Funded" and "Unicorn" boards via the founder_stats rollup, so the numbers are
-- now web-sourced / estimated rather than vendor-authoritative.
--
-- Because they are estimated, we track provenance alongside the existing funding
-- columns (funding_total_usd, valuation_usd, employee_count, funding_last_round_usd,
-- funding_last_round_name, exit_type, acquirer): the source, when it was enriched,
-- the source URLs Perplexity cited, and a confidence signal.
--
-- Additive, idempotent DDL only — no existing rows/ids/FKs are changed.
-- =============================================================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS funding_source      TEXT;        -- e.g. 'perplexity'
ALTER TABLE companies ADD COLUMN IF NOT EXISTS funding_enriched_at TIMESTAMPTZ; -- when funding was last enriched
ALTER TABLE companies ADD COLUMN IF NOT EXISTS funding_citations   JSONB;       -- source URLs Perplexity cited
ALTER TABLE companies ADD COLUMN IF NOT EXISTS funding_confidence  TEXT;        -- 'high' | 'medium' | 'low'

-- Lets the enrichment picker cheaply find companies never enriched or gone stale.
CREATE INDEX IF NOT EXISTS idx_companies_funding_enriched_at ON companies (funding_enriched_at);
