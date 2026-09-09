-- ExploreYC World: plots on a 3D globe, country/city leaderboards, promotions.
--
-- Additive and idempotent. Reference tables (world_countries, world_cities)
-- are seeded from backend/data/world_countries.json + world_cities.json by
-- Database.seed_world_reference_data() (ON CONFLICT DO NOTHING), not here —
-- 7.5k rows of reference data do not belong in a migration file.
--
-- Money invariants live in the schema, not the application:
--   * world_payments.stripe_session_id UNIQUE is the webhook idempotency key;
--     a duplicate delivery hits the constraint and is treated as
--     already-processed.
--   * world_promotions.stripe_session_id UNIQUE (nullable — admin sponsor
--     slots have no payment) for the same reason.
-- Seed pins are virtual (companies table), so nothing here references them.

-- Reference: one row per ISO country present in world-atlas countries-10m
-- (239: 238 ISO-numeric countries + Kosovo 'XK').
CREATE TABLE IF NOT EXISTS world_countries (
    iso2 TEXT PRIMARY KEY,
    iso3 TEXT NOT NULL,
    name TEXT NOT NULL,
    flag_emoji TEXT,
    centroid_lat DOUBLE PRECISION NOT NULL,
    centroid_lng DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reference: Natural Earth 10m populated places (7,328). id is Natural
-- Earth's stable ne_id, so re-seeding upserts cleanly.
CREATE TABLE IF NOT EXISTS world_cities (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    country_iso TEXT NOT NULL REFERENCES world_countries(iso2),
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    population BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_world_cities_country ON world_cities (country_iso);
-- Bounding-box prefilter for the 50 km nearest-city snap.
CREATE INDEX IF NOT EXISTS idx_world_cities_lat_lng ON world_cities (lat, lng);

-- A claimed pin. user_id is always set (seed pins are virtual — rendered
-- from `companies` until claimed). company_id links a claimed seed back to
-- its company. status: 'active' | 'pending' (keyword moderation hit).
CREATE TABLE IF NOT EXISTS world_plots (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES api_users(id),
    company_id BIGINT REFERENCES companies(id),
    name TEXT NOT NULL,
    url TEXT,
    tagline TEXT,
    founder_name TEXT,
    founder_title TEXT,
    founder_link TEXT,
    logo_url TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    country_iso TEXT NOT NULL REFERENCES world_countries(iso2),
    city_id BIGINT REFERENCES world_cities(id),
    total_cents BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_world_plots_country ON world_plots (country_iso);
CREATE INDEX IF NOT EXISTS idx_world_plots_city ON world_plots (city_id);
CREATE INDEX IF NOT EXISTS idx_world_plots_total ON world_plots (total_cents DESC);
CREATE INDEX IF NOT EXISTS idx_world_plots_user ON world_plots (user_id);
-- Seed exclusion: "is this company already claimed?" runs on every globe load.
CREATE INDEX IF NOT EXISTS idx_world_plots_company
    ON world_plots (company_id) WHERE company_id IS NOT NULL;

-- One row per completed Stripe checkout (plant or top-up). Written only by
-- the webhook, inside the same transaction that credits the plot.
CREATE TABLE IF NOT EXISTS world_payments (
    id BIGSERIAL PRIMARY KEY,
    plot_id BIGINT NOT NULL REFERENCES world_plots(id),
    user_id BIGINT NOT NULL REFERENCES api_users(id),
    stripe_session_id TEXT NOT NULL UNIQUE,
    amount_cents BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_world_payments_plot ON world_payments (plot_id);
-- Rising-24h board scans by recency.
CREATE INDEX IF NOT EXISTS idx_world_payments_created ON world_payments (created_at);

-- Time-boxed placement. kind 'featured' = self-serve paid (plot_id set);
-- kind 'sponsor' = admin slot (plot_id NULL, label/url/logo_url set).
-- country_iso NULL = global scope. status: 'active' | 'expired' | 'revoked'
-- ('expired' is hygiene — queries filter on ends_at regardless).
CREATE TABLE IF NOT EXISTS world_promotions (
    id BIGSERIAL PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('featured', 'sponsor')),
    plot_id BIGINT REFERENCES world_plots(id),
    user_id BIGINT REFERENCES api_users(id),
    label TEXT,
    url TEXT,
    logo_url TEXT,
    country_iso TEXT REFERENCES world_countries(iso2),
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ NOT NULL,
    amount_cents BIGINT NOT NULL DEFAULT 0,
    stripe_session_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_world_promotions_active
    ON world_promotions (status, ends_at);
CREATE INDEX IF NOT EXISTS idx_world_promotions_country ON world_promotions (country_iso);
CREATE INDEX IF NOT EXISTS idx_world_promotions_plot ON world_promotions (plot_id);
CREATE INDEX IF NOT EXISTS idx_world_promotions_user ON world_promotions (user_id);
