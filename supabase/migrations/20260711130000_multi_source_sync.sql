-- =============================================================================
-- Multi-source company sync — dedupe_key merge column + per-source cursor.
-- NON-DESTRUCTIVE and IDEMPOTENT. Additive DDL only.
--   * dedupe_key: normalized domain (else source:slug) used for read-time merge
--     of the same company across sources (YC + Launch HN + a16z ...).
--   * sync_state: per-source incremental cursor for the daily sync worker.
-- No existing rows/ids/FKs are changed. Backfill of dedupe_key is done by the
-- app (backfill_dedupe_keys) using the same normalizer the adapters use.
-- =============================================================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

CREATE INDEX IF NOT EXISTS idx_companies_dedupe_key
  ON companies (dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS sync_state (
  source           TEXT PRIMARY KEY,
  last_run_at      TIMESTAMPTZ,
  last_cursor      TEXT,
  last_status      TEXT,
  records_upserted INTEGER DEFAULT 0,
  error            TEXT,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Service-role-only, like the app's other operational tables. The sync worker
-- uses the service key (bypasses RLS); no anon/authenticated policies added.
ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;
