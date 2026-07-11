-- Multi-source portfolios: generalize the companies table beyond Y Combinator so
-- it can hold companies from multiple incubators / VCs (a16z, and others later).
--
-- Provenance is tracked with `source` (e.g. 'yc', 'a16z') + `source_id` (the native
-- id in that source's own id space). The integer primary key `id` stays collision-free
-- across sources via reserved 1e9-wide offset blocks defined in backend/sources.py
-- (YC keeps offset 0, so existing YC ids / rows / foreign keys are unchanged).
--
-- Uniqueness moves from a single global UNIQUE(slug) to per-source composite
-- uniqueness, because slugs can legitimately repeat across sources (e.g. 'pagerduty').

-- 1. Provenance + source-agnostic columns useful across VC/incubator portfolios
ALTER TABLE companies ADD COLUMN IF NOT EXISTS source        TEXT NOT NULL DEFAULT 'yc';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS source_id     TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS founders      TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS year_founded  INTEGER;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS exit_type     TEXT;   -- 'IPO' | 'M&A' | 'SPAC' | 'Exit' | NULL
ALTER TABLE companies ADD COLUMN IF NOT EXISTS acquirer      TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ticker_symbol TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS funded_date   TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS source_url    TEXT;   -- canonical page on the source's site

-- 2. Backfill existing rows as Y Combinator
UPDATE companies SET source = 'yc'        WHERE source IS NULL;
UPDATE companies SET source_id = id::text WHERE source_id IS NULL;

-- 3. Replace the global UNIQUE(slug) with per-source uniqueness.
--    `companies_slug_key` is the auto-generated name for the inline UNIQUE(slug).
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_source_slug   ON companies (source, slug);
CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_source_native ON companies (source, source_id);
CREATE INDEX        IF NOT EXISTS idx_companies_source        ON companies (source);
