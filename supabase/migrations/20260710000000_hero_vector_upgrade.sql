-- Migration: Hero vector upgrade — HNSW index + idea answer cache
-- Date: 2026-07-10

-- Swap IVFFlat for HNSW: far better recall at query time, healthy under
-- incremental inserts. Build cost is trivial at ~6k rows.
DROP INDEX IF EXISTS idx_companies_embedding;
CREATE INDEX IF NOT EXISTS idx_companies_embedding_hnsw
ON companies USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Deterministic answer cache with TTL (idea_answer_cache).
CREATE TABLE IF NOT EXISTS idea_answer_cache (
    id           BIGSERIAL PRIMARY KEY,
    query_key    TEXT NOT NULL UNIQUE,      -- normalized idea text
    answer_json  JSONB NOT NULL,            -- full HeroAnswer payload
    prose        TEXT,                      -- optional gpt-4.1-mini prose (offline)
    hit_count    INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_idea_answer_cache_expires ON idea_answer_cache (expires_at);
