-- Public API: developer accounts, non-expiring API keys, usage log (rate limiting),
-- and DB-backed dashboard sessions (multi-instance safe, unlike the in-memory admin sessions).

CREATE TABLE IF NOT EXISTS api_users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    company_name TEXT,
    plan TEXT NOT NULL DEFAULT 'free',        -- see backend/plans.py
    status TEXT NOT NULL DEFAULT 'active',     -- 'active' | 'suspended'
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_token TEXT,
    stripe_customer_id TEXT,                   -- populated when Stripe lands
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES api_users(id) ON DELETE CASCADE,
    key_prefix TEXT NOT NULL,                  -- e.g. 'eyc_live_A1b2C3d4' for display
    key_hash TEXT NOT NULL UNIQUE,             -- sha256 hex of the full key; plaintext never stored
    name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_usage (
    id BIGSERIAL PRIMARY KEY,
    api_key_id BIGINT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    endpoint TEXT,
    status_code INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES api_users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,           -- sha256 hex of the session token
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user         ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_key_created ON api_usage(api_key_id, created_at);  -- rate-limit query
CREATE INDEX IF NOT EXISTS idx_api_sessions_token    ON api_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_api_sessions_expires  ON api_sessions(expires_at);
