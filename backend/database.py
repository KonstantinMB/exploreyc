"""
Database models and operations for YC Company Scraper
Uses SQLite with persistent storage
"""

import sqlite3
import json
from typing import List, Dict, Optional, Any
from pathlib import Path
from contextlib import contextmanager


class Database:
    """Persistent SQLite database for YC companies"""

    def __init__(self, db_path: str = "yc_companies.db"):
        self.db_path = db_path
        self._create_tables()

    @contextmanager
    def get_connection(self):
        """Context manager for database connections"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

    def _create_tables(self):
        """Create database tables if they don't exist"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Companies table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS companies (
                    id INTEGER PRIMARY KEY,
                    source TEXT NOT NULL DEFAULT 'yc',
                    source_id TEXT,
                    name TEXT NOT NULL,
                    slug TEXT NOT NULL,
                    website TEXT,
                    one_liner TEXT,
                    long_description TEXT,
                    team_size INTEGER,
                    batch TEXT,
                    status TEXT,
                    industry TEXT,
                    subindustry TEXT,
                    all_locations TEXT,
                    is_hiring BOOLEAN,
                    top_company BOOLEAN,
                    nonprofit BOOLEAN,
                    stage TEXT,
                    small_logo_thumb_url TEXT,
                    tags TEXT,
                    regions TEXT,
                    industries TEXT,
                    latitude REAL,
                    longitude REAL,
                    country TEXT,
                    founders TEXT,
                    year_founded INTEGER,
                    exit_type TEXT,
                    acquirer TEXT,
                    ticker_symbol TEXT,
                    funded_date TEXT,
                    source_url TEXT,
                    raw_json TEXT,
                    funding_total_usd REAL,
                    funding_last_round_usd REAL,
                    funding_last_round_date TEXT,
                    funding_last_round_name TEXT,
                    funding_rounds_count INTEGER,
                    investors_count INTEGER,
                    valuation_usd REAL,
                    employee_count INTEGER,
                    employee_growth_6m REAL,
                    coresignal_last_updated TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # Scrape jobs table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS scrape_jobs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    status TEXT NOT NULL,
                    filters TEXT,
                    total_scraped INTEGER DEFAULT 0,
                    current_page INTEGER DEFAULT 0,
                    error TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # Investors table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS investors (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    investor_type TEXT,
                    portfolio_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # Company-Investors junction table (funding rounds)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS company_investors (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER NOT NULL,
                    investor_id INTEGER NOT NULL,
                    round_name TEXT,
                    amount_usd REAL,
                    funding_date TEXT,
                    is_lead_investor BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (company_id) REFERENCES companies(id),
                    FOREIGN KEY (investor_id) REFERENCES investors(id),
                    UNIQUE(company_id, investor_id, round_name)
                )
            ''')

            # Hiring Board - Companies (from WorkAtAStartup)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS hiring_companies (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    slug TEXT UNIQUE,
                    batch TEXT,
                    team_size INTEGER,
                    location TEXT,
                    logo_url TEXT,
                    small_logo_url TEXT,
                    website TEXT,
                    one_liner TEXT,
                    primary_vertical TEXT,
                    raw_json TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # Hiring Board - Jobs (from WorkAtAStartup)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS hiring_jobs (
                    id INTEGER PRIMARY KEY,
                    company_id INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    pretty_role TEXT,
                    salary_min INTEGER,
                    salary_max INTEGER,
                    salary_currency TEXT DEFAULT 'USD',
                    job_type TEXT,
                    remote TEXT,
                    locations TEXT,  -- JSON array
                    pretty_location_or_remote TEXT,
                    pretty_job_type TEXT,
                    pretty_min_experience TEXT,
                    pretty_updated_at TEXT,
                    show_path TEXT,
                    raw_json TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (company_id) REFERENCES hiring_companies(id)
                )
            ''')

            # Research Cache (Perplexity API results)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS research_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    query TEXT NOT NULL UNIQUE,
                    query_type TEXT DEFAULT 'company',  -- 'company' or 'custom'
                    response_data TEXT NOT NULL,  -- Full Perplexity response as JSON
                    parsed_sections TEXT,  -- Structured sections: news, funding, leadership, market
                    citations TEXT,  -- JSON array of source URLs
                    view_count INTEGER DEFAULT 1,
                    search_count INTEGER DEFAULT 1,  -- How many times searched
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS company_changes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER NOT NULL,
                    change_type TEXT NOT NULL,
                    field_name TEXT,
                    old_value TEXT,
                    new_value TEXT,
                    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS predictions (
                    id TEXT PRIMARY KEY,
                    idea_description TEXT,
                    team_info TEXT,
                    industry TEXT,
                    location TEXT,
                    market_type TEXT,
                    idea_score REAL,
                    team_score REAL,
                    market_score REAL,
                    combined_score REAL,
                    percentile REAL,
                    tier TEXT,
                    top_matches TEXT,
                    achievements TEXT,
                    challenges TEXT,
                    username TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # ---- Public API: developer accounts, keys, usage, sessions ----
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS api_users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    company_name TEXT,
                    plan TEXT NOT NULL DEFAULT 'free',
                    status TEXT NOT NULL DEFAULT 'active',
                    email_verified BOOLEAN NOT NULL DEFAULT 0,
                    verification_token TEXT,
                    stripe_customer_id TEXT,
                    stripe_subscription_id TEXT,
                    subscription_status TEXT,
                    avatar_url TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            # Existing local DBs: add columns that landed after the table shipped
            existing_cols = {r[1] for r in cursor.execute("PRAGMA table_info(api_users)").fetchall()}
            for col in ('avatar_url', 'stripe_subscription_id', 'subscription_status'):
                if col not in existing_cols:
                    cursor.execute(f'ALTER TABLE api_users ADD COLUMN {col} TEXT')
            # One-shot remap of the pre-Stripe plan ladder (starter/pro/enterprise →
            # pro/max/unlimited). Guarded by user_version because 'pro' changed meaning
            # (5000/day → 500/day) and re-running would wrongly bump new-pro users to max.
            if cursor.execute('PRAGMA user_version').fetchone()[0] < 1:
                cursor.execute('''
                    UPDATE api_users SET plan = CASE plan
                        WHEN 'enterprise' THEN 'unlimited'
                        WHEN 'pro' THEN 'max'
                        WHEN 'starter' THEN 'pro'
                        ELSE plan END
                ''')
                cursor.execute('PRAGMA user_version = 1')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS api_keys (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    key_prefix TEXT NOT NULL,
                    key_hash TEXT NOT NULL UNIQUE,
                    name TEXT,
                    is_active BOOLEAN NOT NULL DEFAULT 1,
                    revoked_at TIMESTAMP,
                    last_used_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES api_users(id)
                )
            ''')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS api_usage (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    api_key_id INTEGER NOT NULL,
                    endpoint TEXT,
                    status_code INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
                )
            ''')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS api_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    token_hash TEXT NOT NULL UNIQUE,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES api_users(id)
                )
            ''')

            # Interest in currently-unavailable features (e.g. data export).
            # Deduped per (feature, user_identifier) so one browser counts once.
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS feature_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    feature TEXT NOT NULL,
                    user_identifier TEXT,
                    email TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (feature, user_identifier)
                )
            ''')

            # Per-source incremental sync cursor (parity with the Postgres migration)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS sync_state (
                    source TEXT PRIMARY KEY,
                    last_run_at TEXT,
                    last_cursor TEXT,
                    last_status TEXT,
                    records_upserted INTEGER DEFAULT 0,
                    error TEXT,
                    updated_at TEXT
                )
            ''')

            # Founder leaderboards — parity with 20260715000000_founder_leaderboards.sql.
            # founders (authoritative), company_founders (graph), founder_enrichment
            # (supplementary, cited), founder_stats (recomputed table since SQLite has
            # no materialized views — refreshed via refresh_founder_stats()).
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS founders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    yc_user_id INTEGER UNIQUE,
                    full_name TEXT NOT NULL,
                    slug TEXT UNIQUE,
                    bio TEXT,
                    avatar_url TEXT,
                    linkedin_url TEXT,
                    twitter_url TEXT,
                    is_active BOOLEAN,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS company_founders (
                    company_id INTEGER NOT NULL,
                    founder_id INTEGER NOT NULL,
                    title TEXT,
                    source TEXT NOT NULL DEFAULT 'yc',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (company_id, founder_id),
                    FOREIGN KEY (company_id) REFERENCES companies(id),
                    FOREIGN KEY (founder_id) REFERENCES founders(id)
                )
            ''')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS founder_enrichment (
                    founder_id INTEGER PRIMARY KEY,
                    twitter_followers INTEGER,
                    linkedin_followers INTEGER,
                    education TEXT,
                    awards TEXT,
                    notable_exits TEXT,
                    angel_investments_count INTEGER,
                    notable_prior_roles TEXT,
                    bio_long TEXT,
                    citations TEXT,
                    confidence TEXT,
                    model TEXT,
                    raw_response TEXT,
                    enriched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (founder_id) REFERENCES founders(id)
                )
            ''')
            # SQLite equivalent of the Postgres materialized view (recomputed table).
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS founder_stats (
                    founder_id INTEGER PRIMARY KEY,
                    companies_count INTEGER DEFAULT 0,
                    batches TEXT,
                    latest_batch TEXT,
                    total_funding_usd REAL DEFAULT 0,
                    max_valuation_usd REAL DEFAULT 0,
                    has_unicorn BOOLEAN DEFAULT 0,
                    best_exit_type TEXT,
                    best_exit_acquirer TEXT,
                    total_employee_count INTEGER DEFAULT 0,
                    is_repeat_founder BOOLEAN DEFAULT 0,
                    FOREIGN KEY (founder_id) REFERENCES founders(id)
                )
            ''')

            # ---- ExploreYC World — mirrors supabase/migrations/20260909100000_world.sql ----
            # Reference: countries present in world-atlas countries-10m (239).
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS world_countries (
                    iso2 TEXT PRIMARY KEY,
                    iso3 TEXT NOT NULL,
                    name TEXT NOT NULL,
                    flag_emoji TEXT,
                    centroid_lat REAL NOT NULL,
                    centroid_lng REAL NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            # Reference: Natural Earth 10m populated places (7,328); id = ne_id.
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS world_cities (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    country_iso TEXT NOT NULL,
                    lat REAL NOT NULL,
                    lng REAL NOT NULL,
                    population INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (country_iso) REFERENCES world_countries(iso2)
                )
            ''')
            # A claimed pin. Seeds are virtual (companies table) — user_id is
            # always a real buyer. status: 'active' | 'pending' (moderation).
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS world_plots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    company_id INTEGER,
                    name TEXT NOT NULL,
                    url TEXT,
                    tagline TEXT,
                    founder_name TEXT,
                    founder_title TEXT,
                    founder_link TEXT,
                    logo_url TEXT,
                    lat REAL NOT NULL,
                    lng REAL NOT NULL,
                    country_iso TEXT NOT NULL,
                    city_id INTEGER,
                    total_cents INTEGER NOT NULL DEFAULT 0,
                    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending')),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES api_users(id),
                    FOREIGN KEY (company_id) REFERENCES companies(id),
                    FOREIGN KEY (country_iso) REFERENCES world_countries(iso2),
                    FOREIGN KEY (city_id) REFERENCES world_cities(id)
                )
            ''')
            # One row per completed Stripe checkout. stripe_session_id UNIQUE
            # is the webhook idempotency key (DB-enforced).
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS world_payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    plot_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    stripe_session_id TEXT NOT NULL UNIQUE,
                    amount_cents INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (plot_id) REFERENCES world_plots(id),
                    FOREIGN KEY (user_id) REFERENCES api_users(id)
                )
            ''')
            # Time-boxed placement: 'featured' (paid, plot_id set) or
            # 'sponsor' (admin slot, plot_id NULL). country_iso NULL = global.
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS world_promotions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    kind TEXT NOT NULL CHECK (kind IN ('featured', 'sponsor')),
                    plot_id INTEGER,
                    user_id INTEGER,
                    label TEXT,
                    url TEXT,
                    logo_url TEXT,
                    country_iso TEXT,
                    starts_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ends_at TIMESTAMP NOT NULL,
                    amount_cents INTEGER NOT NULL DEFAULT 0,
                    stripe_session_id TEXT UNIQUE,
                    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (plot_id) REFERENCES world_plots(id),
                    FOREIGN KEY (user_id) REFERENCES api_users(id),
                    FOREIGN KEY (country_iso) REFERENCES world_countries(iso2)
                )
            ''')

            # Bring existing databases up to the multi-source schema before indexing
            self._migrate_schema(cursor)

            # Create indexes
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_batch ON companies(batch)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_hiring ON companies(is_hiring)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_industry ON companies(industry)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_country ON companies(country)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_funding_total ON companies(funding_total_usd)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_companies_source ON companies(source)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_dedupe_key ON companies(dedupe_key)')
            cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_source_slug ON companies(source, slug)')
            cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_source_native ON companies(source, source_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_investor_name ON investors(name)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_company_investor_company ON company_investors(company_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_company_investor_investor ON company_investors(investor_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_hiring_company_id ON hiring_jobs(company_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_hiring_role ON hiring_jobs(pretty_role)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_hiring_updated ON hiring_jobs(pretty_updated_at)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_api_usage_key_created ON api_usage(api_key_id, created_at)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_api_sessions_token ON api_sessions(token_hash)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_api_sessions_expires ON api_sessions(expires_at)')

            # Founder leaderboards
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_founders_slug ON founders(slug)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_company_founders_founder ON company_founders(founder_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_company_founders_company ON company_founders(company_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_founder_stats_companies ON founder_stats(companies_count DESC)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_founder_stats_funding ON founder_stats(total_funding_usd DESC)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_founder_stats_valuation ON founder_stats(max_valuation_usd DESC)')

            # ExploreYC World
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_world_cities_country ON world_cities(country_iso)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_world_cities_lat_lng ON world_cities(lat, lng)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_world_plots_country ON world_plots(country_iso)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_world_plots_city ON world_plots(city_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_world_plots_total ON world_plots(total_cents DESC)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_world_plots_user ON world_plots(user_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_world_plots_company ON world_plots(company_id) WHERE company_id IS NOT NULL')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_world_payments_plot ON world_payments(plot_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_world_payments_created ON world_payments(created_at)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_world_promotions_active ON world_promotions(status, ends_at)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_world_promotions_country ON world_promotions(country_iso)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_world_promotions_plot ON world_promotions(plot_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_world_promotions_user ON world_promotions(user_id)')

    def _migrate_schema(self, cursor):
        """Bring an existing SQLite DB up to the multi-source schema.

        SQLite has no `ADD COLUMN IF NOT EXISTS`, so we gate on PRAGMA table_info.
        The legacy inline `slug TEXT UNIQUE NOT NULL` creates an un-droppable auto
        index; we replace it with the composite UNIQUE(source, slug) via a guarded
        table rebuild. Local-dev only (production is Postgres via database_factory).
        """
        existing = {row[1] for row in cursor.execute("PRAGMA table_info(companies)").fetchall()}
        additions = {
            "source": "TEXT NOT NULL DEFAULT 'yc'",
            "source_id": "TEXT",
            "founders": "TEXT",
            "year_founded": "INTEGER",
            "exit_type": "TEXT",
            "acquirer": "TEXT",
            "ticker_symbol": "TEXT",
            "funded_date": "TEXT",
            "source_url": "TEXT",
            "dedupe_key": "TEXT",
            # Funding provenance (Perplexity-sourced funding; see
            # supabase/migrations/20260716000000_company_funding_provenance.sql).
            "funding_source": "TEXT",
            "funding_enriched_at": "TEXT",
            "funding_citations": "TEXT",
            "funding_confidence": "TEXT",
        }
        for col, ddl in additions.items():
            if col not in existing:
                cursor.execute(f"ALTER TABLE companies ADD COLUMN {col} {ddl}")

        # Backfill provenance for pre-existing (YC) rows
        cursor.execute("UPDATE companies SET source='yc' WHERE source IS NULL")
        cursor.execute("UPDATE companies SET source_id=CAST(id AS TEXT) WHERE source_id IS NULL")

        # Drop the legacy global UNIQUE(slug) by rebuilding the table, if present.
        create_sql = cursor.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='companies'"
        ).fetchone()[0]
        if "slug TEXT UNIQUE" in create_sql:
            cols = [row[1] for row in cursor.execute("PRAGMA table_info(companies)").fetchall()]
            col_list = ", ".join(f'"{c}"' for c in cols)
            new_sql = (create_sql
                       .replace("slug TEXT UNIQUE NOT NULL", "slug TEXT NOT NULL")
                       .replace("CREATE TABLE IF NOT EXISTS companies", "CREATE TABLE companies_new")
                       .replace("CREATE TABLE companies", "CREATE TABLE companies_new"))
            cursor.execute("DROP TABLE IF EXISTS companies_new")
            cursor.execute(new_sql)
            cursor.execute(f"INSERT INTO companies_new ({col_list}) SELECT {col_list} FROM companies")
            cursor.execute("DROP TABLE companies")
            cursor.execute("ALTER TABLE companies_new RENAME TO companies")

    # ========================================================================
    # PUBLIC API: developer accounts, keys, usage, sessions
    # ========================================================================

    @staticmethod
    def _fmt_dt(value):
        """Format a datetime for SQLite's CURRENT_TIMESTAMP text comparison (UTC)."""
        return value.strftime('%Y-%m-%d %H:%M:%S') if hasattr(value, 'strftime') else value

    def create_api_user(self, email, password_hash, company_name=None, verification_token=None) -> int:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                'INSERT INTO api_users (email, password_hash, company_name, verification_token) VALUES (?, ?, ?, ?)',
                (email, password_hash, company_name, verification_token))
            return cur.lastrowid

    def get_api_user_by_email(self, email) -> Optional[Dict]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('SELECT * FROM api_users WHERE email = ?', (email,))
            row = cur.fetchone()
            return dict(row) if row else None

    def get_api_user_by_id(self, user_id) -> Optional[Dict]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('SELECT * FROM api_users WHERE id = ?', (user_id,))
            row = cur.fetchone()
            return dict(row) if row else None

    def verify_api_user_email(self, token) -> bool:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                'UPDATE api_users SET email_verified = 1, verification_token = NULL, updated_at = CURRENT_TIMESTAMP '
                'WHERE verification_token = ?', (token,))
            return cur.rowcount > 0

    def set_api_user_plan(self, user_id, plan) -> bool:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('UPDATE api_users SET plan = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', (plan, user_id))
            return cur.rowcount > 0

    def set_api_user_status(self, user_id, status) -> bool:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('UPDATE api_users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', (status, user_id))
            return cur.rowcount > 0

    def set_api_user_stripe_customer(self, user_id, customer_id) -> bool:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('UPDATE api_users SET stripe_customer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        (customer_id, user_id))
            return cur.rowcount > 0

    def set_api_user_subscription(self, user_id, subscription_id, status) -> bool:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('UPDATE api_users SET stripe_subscription_id = ?, subscription_status = ?, '
                        'updated_at = CURRENT_TIMESTAMP WHERE id = ?', (subscription_id, status, user_id))
            return cur.rowcount > 0

    def get_api_user_by_stripe_customer(self, customer_id) -> Optional[Dict]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('SELECT * FROM api_users WHERE stripe_customer_id = ?', (customer_id,))
            row = cur.fetchone()
            return dict(row) if row else None

    def update_api_user_profile(self, user_id, company_name=None, avatar_url=None) -> bool:
        sets, params = [], []
        if company_name is not None:
            sets.append('company_name = ?'); params.append(company_name)
        if avatar_url is not None:
            sets.append('avatar_url = ?'); params.append(avatar_url)
        if not sets:
            return False
        params.append(user_id)
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(f"UPDATE api_users SET {', '.join(sets)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?", params)
            return cur.rowcount > 0

    def list_api_users(self) -> List[Dict]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('''
                SELECT u.id, u.email, u.company_name, u.plan, u.status, u.email_verified, u.created_at,
                       (SELECT COUNT(*) FROM api_keys k WHERE k.user_id = u.id AND k.is_active = 1) AS active_keys
                FROM api_users u ORDER BY u.created_at DESC''')
            return [dict(r) for r in cur.fetchall()]

    def create_api_key(self, user_id, key_prefix, key_hash, name=None) -> int:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('INSERT INTO api_keys (user_id, key_prefix, key_hash, name) VALUES (?, ?, ?, ?)',
                        (user_id, key_prefix, key_hash, name))
            return cur.lastrowid

    def get_api_key_by_hash(self, key_hash) -> Optional[Dict]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('''
                SELECT k.id, k.user_id, k.is_active, u.plan, u.status AS user_status
                FROM api_keys k JOIN api_users u ON u.id = k.user_id
                WHERE k.key_hash = ?''', (key_hash,))
            row = cur.fetchone()
            return dict(row) if row else None

    def list_api_keys_for_user(self, user_id) -> List[Dict]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('''
                SELECT k.id, k.key_prefix, k.name, k.is_active, k.revoked_at, k.created_at,
                       (SELECT MAX(created_at) FROM api_usage WHERE api_key_id = k.id) AS last_used_at
                FROM api_keys k WHERE k.user_id = ? ORDER BY k.created_at DESC''', (user_id,))
            return [dict(r) for r in cur.fetchall()]

    def revoke_api_key(self, key_id, user_id=None) -> bool:
        with self.get_connection() as conn:
            cur = conn.cursor()
            if user_id is not None:
                cur.execute('UPDATE api_keys SET is_active = 0, revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
                            (key_id, user_id))
            else:
                cur.execute('UPDATE api_keys SET is_active = 0, revoked_at = CURRENT_TIMESTAMP WHERE id = ?', (key_id,))
            return cur.rowcount > 0

    def list_all_api_keys(self) -> List[Dict]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('''
                SELECT k.id, k.user_id, u.email, k.key_prefix, k.name, k.is_active, k.revoked_at, k.created_at,
                       (SELECT MAX(created_at) FROM api_usage WHERE api_key_id = k.id) AS last_used_at
                FROM api_keys k JOIN api_users u ON u.id = k.user_id ORDER BY k.created_at DESC''')
            return [dict(r) for r in cur.fetchall()]

    def log_api_usage(self, api_key_id, endpoint, status_code) -> None:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('INSERT INTO api_usage (api_key_id, endpoint, status_code) VALUES (?, ?, ?)',
                        (api_key_id, endpoint, status_code))

    def count_api_usage_since(self, api_key_id, since):
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('SELECT COUNT(*), MIN(created_at) FROM api_usage WHERE api_key_id = ? AND created_at > ?',
                        (api_key_id, self._fmt_dt(since)))
            row = cur.fetchone()
            return (row[0] or 0, row[1])

    def create_api_session(self, user_id, token_hash, expires_at) -> int:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('INSERT INTO api_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
                        (user_id, token_hash, self._fmt_dt(expires_at)))
            return cur.lastrowid

    def get_api_session(self, token_hash) -> Optional[Dict]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('''
                SELECT s.user_id, s.expires_at, u.email, u.company_name, u.plan, u.status AS user_status
                FROM api_sessions s JOIN api_users u ON u.id = s.user_id
                WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP''', (token_hash,))
            row = cur.fetchone()
            return dict(row) if row else None

    def delete_api_session(self, token_hash) -> None:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('DELETE FROM api_sessions WHERE token_hash = ?', (token_hash,))

    def delete_expired_api_sessions(self) -> int:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('DELETE FROM api_sessions WHERE expires_at < CURRENT_TIMESTAMP')
            return cur.rowcount

    def cleanup_api_usage(self, older_than) -> int:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('DELETE FROM api_usage WHERE created_at < ?', (self._fmt_dt(older_than),))
            return cur.rowcount

    def get_api_usage_timeseries(self, user_id, since) -> List[Dict]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('''
                SELECT DATE(u.created_at) AS day, COUNT(*) AS count
                FROM api_usage u JOIN api_keys k ON k.id = u.api_key_id
                WHERE k.user_id = ? AND u.created_at > ?
                GROUP BY DATE(u.created_at) ORDER BY day''', (user_id, self._fmt_dt(since)))
            return [dict(r) for r in cur.fetchall()]

    def get_api_usage_by_endpoint(self, user_id, since, limit=10) -> List[Dict]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute('''
                SELECT u.endpoint AS endpoint, COUNT(*) AS count
                FROM api_usage u JOIN api_keys k ON k.id = u.api_key_id
                WHERE k.user_id = ? AND u.created_at > ?
                GROUP BY u.endpoint ORDER BY count DESC LIMIT ?''', (user_id, self._fmt_dt(since), limit))
            return [dict(r) for r in cur.fetchall()]

    def insert_company(self, company: Dict[str, Any]) -> int:
        """Insert or update a company"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO companies
                (id, source, source_id, name, slug, website, one_liner, long_description, team_size,
                 batch, status, industry, subindustry, all_locations, is_hiring,
                 top_company, nonprofit, stage, small_logo_thumb_url, tags, regions,
                 industries, latitude, longitude, country,
                 founders, year_founded, exit_type, acquirer, ticker_symbol, funded_date, source_url,
                 dedupe_key, raw_json, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ''', (
                company.get('id'),
                company.get('source', 'yc'),
                company.get('source_id') if company.get('source_id') is not None else str(company.get('id')),
                company.get('name'),
                company.get('slug'),
                company.get('website'),
                company.get('one_liner'),
                company.get('long_description'),
                company.get('team_size'),
                company.get('batch'),
                company.get('status'),
                company.get('industry'),
                company.get('subindustry'),
                company.get('all_locations'),
                company.get('isHiring'),
                company.get('top_company'),
                company.get('nonprofit'),
                company.get('stage'),
                company.get('small_logo_thumb_url'),
                json.dumps(company.get('tags', [])),
                json.dumps(company.get('regions', [])),
                json.dumps(company.get('industries', [])),
                company.get('latitude'),
                company.get('longitude'),
                company.get('country'),
                company.get('founders'),
                company.get('year_founded'),
                company.get('exit_type'),
                company.get('acquirer'),
                company.get('ticker_symbol'),
                company.get('funded_date'),
                company.get('source_url'),
                company.get('dedupe_key'),
                json.dumps(company)
            ))
            return cursor.lastrowid

    def update_company_funding(self, company_id: int, data: Dict[str, Any]) -> None:
        """Write Perplexity-sourced funding onto a company + its provenance.

        Funding is now web-sourced (Perplexity sonar-pro), so we stamp funding_source,
        funding_enriched_at, the cited source URLs, and a confidence signal. COALESCE
        keeps any existing value when `data` supplies a NULL for that field, so a
        partial enrichment never wipes a previously known number.
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE companies SET
                    funding_total_usd       = COALESCE(?, funding_total_usd),
                    valuation_usd           = COALESCE(?, valuation_usd),
                    employee_count          = COALESCE(?, employee_count),
                    funding_last_round_usd  = COALESCE(?, funding_last_round_usd),
                    funding_last_round_name = COALESCE(?, funding_last_round_name),
                    exit_type               = COALESCE(?, exit_type),
                    acquirer                = COALESCE(?, acquirer),
                    funding_source          = 'perplexity',
                    funding_enriched_at     = CURRENT_TIMESTAMP,
                    funding_citations       = ?,
                    funding_confidence      = COALESCE(?, funding_confidence),
                    updated_at              = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (
                data.get("funding_total_usd"),
                data.get("valuation_usd"),
                data.get("employee_count"),
                data.get("funding_last_round_usd"),
                data.get("funding_last_round_name"),
                data.get("exit_type"),
                data.get("acquirer"),
                json.dumps(data.get("funding_citations")) if data.get("funding_citations") is not None else None,
                data.get("funding_confidence"),
                company_id,
            ))

    # ========== MULTI-SOURCE SYNC: cursor + dedupe_key ==========

    def get_sync_cursor(self, source: str) -> Optional[str]:
        """Return the stored incremental cursor for a source (None if never run)."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT last_cursor FROM sync_state WHERE source = ?", (source,))
            row = cursor.fetchone()
            return row[0] if row else None

    def save_sync_state(self, source: str, cursor_value: Optional[str], status: str,
                        records_upserted: int, error: Optional[str] = None) -> None:
        """Upsert the per-source sync bookkeeping row."""
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT OR REPLACE INTO sync_state
                (source, last_run_at, last_cursor, last_status, records_upserted, error, updated_at)
                VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (source, cursor_value, status, records_upserted, error),
            )

    def set_dedupe_key(self, company_id: int, key: str) -> None:
        with self.get_connection() as conn:
            conn.cursor().execute(
                "UPDATE companies SET dedupe_key = ? WHERE id = ?", (key, company_id)
            )

    def backfill_dedupe_keys(self) -> int:
        """Populate dedupe_key for any rows missing one, using the shared normalizer."""
        from ingestion.normalize import norm_domain, dedupe_key
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, source, slug, website FROM companies WHERE dedupe_key IS NULL"
            )
            rows = cursor.fetchall()
            for r in rows:
                key = dedupe_key(
                    norm_domain(r["website"]), r["source"] or "yc", r["slug"] or str(r["id"])
                )
                cursor.execute(
                    "UPDATE companies SET dedupe_key = ? WHERE id = ?", (key, r["id"])
                )
            return len(rows)

    def delete_source_companies_with_batch(self, sources=("hackernews", "producthunt")) -> int:
        """Delete rows from the given non-YC sources that carry a YC batch (they
        duplicate the canonical source='yc' row). Never touches source='yc'."""
        placeholders = ",".join("?" for _ in sources)
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"DELETE FROM companies WHERE source IN ({placeholders}) "
                f"AND source <> 'yc' AND batch IS NOT NULL AND batch <> ''",
                tuple(sources),
            )
            return cursor.rowcount

    def clear_broken_logos(self) -> int:
        """Null out known-broken logo URLs (Clearbit fallbacks that mostly 404'd)."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE companies SET small_logo_thumb_url = NULL "
                "WHERE small_logo_thumb_url LIKE '%clearbit.com%'"
            )
            return cursor.rowcount

    def record_feature_interest(self, feature: str, user_identifier: Optional[str] = None,
                                email: Optional[str] = None) -> Dict:
        """Record interest in a currently-unavailable feature.

        Deduped per (feature, user_identifier). Returns {"created": bool, "count": int}.
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                '''INSERT OR IGNORE INTO feature_requests (feature, user_identifier, email)
                   VALUES (?, ?, ?)''',
                (feature, user_identifier, email),
            )
            created = cursor.rowcount > 0
            # Keep the email fresh if the same browser re-submits with one
            if not created and email is not None and user_identifier is not None:
                cursor.execute(
                    '''UPDATE feature_requests SET email = ?
                       WHERE feature = ? AND user_identifier = ?''',
                    (email, feature, user_identifier),
                )
            cursor.execute(
                'SELECT COUNT(*) FROM feature_requests WHERE feature = ?', (feature,)
            )
            count = cursor.fetchone()[0]
            return {"created": created, "count": count}

    def get_feature_interest_count(self, feature: str) -> int:
        """Return the number of distinct interest registrations for a feature."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT COUNT(*) FROM feature_requests WHERE feature = ?', (feature,)
            )
            return cursor.fetchone()[0] or 0

    def get_companies(self,
                     limit: int = 100,
                     offset: int = 0,
                     batch: Optional[str] = None,
                     is_hiring: Optional[bool] = None,
                     industry: Optional[str] = None,
                     country: Optional[str] = None,
                     search: Optional[str] = None) -> List[Dict]:
        """Get companies with filters and pagination"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            query = "SELECT * FROM companies WHERE 1=1"
            params = []

            if batch:
                query += " AND batch = ?"
                params.append(batch)

            if is_hiring is not None:
                query += " AND is_hiring = ?"
                params.append(is_hiring)

            if industry:
                query += " AND industry = ?"
                params.append(industry)

            if country:
                query += " AND country = ?"
                params.append(country)

            if search:
                query += " AND (name LIKE ? OR one_liner LIKE ? OR long_description LIKE ?)"
                search_term = f"%{search}%"
                params.extend([search_term, search_term, search_term])

            query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])

            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def get_company_by_id(self, company_id: int) -> Optional[Dict]:
        """Get a single company by ID"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM companies WHERE id = ?", (company_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_company_by_slug(self, slug: str) -> Optional[Dict]:
        """Get a single company by slug"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM companies WHERE slug = ?", (slug,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def count_companies(self,
                       batch: Optional[str] = None,
                       is_hiring: Optional[bool] = None,
                       industry: Optional[str] = None,
                       country: Optional[str] = None,
                       search: Optional[str] = None) -> int:
        """Count companies with filters"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            query = "SELECT COUNT(*) FROM companies WHERE 1=1"
            params = []

            if batch:
                query += " AND batch = ?"
                params.append(batch)

            if is_hiring is not None:
                query += " AND is_hiring = ?"
                params.append(is_hiring)

            if industry:
                query += " AND industry = ?"
                params.append(industry)

            if country:
                query += " AND country = ?"
                params.append(country)

            if search:
                query += " AND (name LIKE ? OR one_liner LIKE ? OR long_description LIKE ?)"
                search_term = f"%{search}%"
                params.extend([search_term, search_term, search_term])

            cursor.execute(query, params)
            return cursor.fetchone()[0]

    def get_stats(self) -> Dict:
        """Get database statistics"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Total companies
            total = cursor.execute('SELECT COUNT(*) FROM companies').fetchone()[0]

            # Companies hiring
            hiring = cursor.execute('SELECT COUNT(*) FROM companies WHERE is_hiring = 1').fetchone()[0]

            # By batch
            by_batch = dict(cursor.execute(
                'SELECT batch, COUNT(*) as count FROM companies GROUP BY batch ORDER BY count DESC'
            ).fetchall())

            # By industry
            by_industry = dict(cursor.execute(
                'SELECT industry, COUNT(*) as count FROM companies WHERE industry IS NOT NULL GROUP BY industry ORDER BY count DESC LIMIT 10'
            ).fetchall())

            # By country
            by_country = dict(cursor.execute(
                'SELECT country, COUNT(*) as count FROM companies WHERE country IS NOT NULL GROUP BY country ORDER BY count DESC LIMIT 10'
            ).fetchall())

            # By status
            by_status = dict(cursor.execute(
                'SELECT status, COUNT(*) as count FROM companies GROUP BY status'
            ).fetchall())

            return {
                'total_companies': total,
                'hiring': hiring,
                'by_batch': by_batch,
                'by_industry': by_industry,
                'by_country': by_country,
                'by_status': by_status
            }

    def get_total_map_companies(self) -> int:
        """Count of companies with geo coordinates (for 'Show all' button)"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT COUNT(*) FROM companies WHERE latitude IS NOT NULL AND longitude IS NOT NULL"
            )
            return cursor.fetchone()[0]

    def get_companies_for_map(self,
                             batch: Optional[str] = None,
                             is_hiring: Optional[bool] = None,
                             recent_batches: Optional[int] = None) -> List[Dict]:
        """Get companies with geo coordinates for map visualization"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            query = """
                SELECT id, name, slug, website, one_liner, batch, is_hiring,
                       top_company, small_logo_thumb_url,
                       latitude, longitude, country, all_locations
                FROM companies
                WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            """
            params = []

            if batch:
                query += " AND batch = ?"
                params.append(batch)

            if is_hiring is not None:
                query += " AND is_hiring = ?"
                params.append(is_hiring)

            if recent_batches is not None and recent_batches > 0:
                query += """
                    AND batch IN (
                        SELECT batch FROM (
                            SELECT DISTINCT batch FROM companies
                            WHERE batch IS NOT NULL
                            ORDER BY batch DESC
                            LIMIT ?
                        ) recent
                    )
                """
                params.append(recent_batches)

            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def create_scrape_job(self, filters: Dict) -> int:
        """Create a new scrape job"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO scrape_jobs (status, filters)
                VALUES (?, ?)
            ''', ('pending', json.dumps(filters)))
            return cursor.lastrowid

    def update_scrape_job(self, job_id: int, status: str, total_scraped: int,
                         current_page: int, error: Optional[str] = None):
        """Update scrape job status"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE scrape_jobs
                SET status = ?, total_scraped = ?, current_page = ?, error = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (status, total_scraped, current_page, error, job_id))

    def get_scrape_job(self, job_id: int) -> Optional[Dict]:
        """Get scrape job status"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM scrape_jobs WHERE id = ?', (job_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_unique_batches(self) -> List[str]:
        """Get list of unique batches"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT DISTINCT batch FROM companies WHERE batch IS NOT NULL ORDER BY batch DESC')
            return [row[0] for row in cursor.fetchall()]

    def get_unique_industries(self) -> List[str]:
        """Get list of unique industries"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT DISTINCT industry FROM companies WHERE industry IS NOT NULL ORDER BY industry')
            return [row[0] for row in cursor.fetchall()]

    def get_unique_countries(self) -> List[str]:
        """Get list of unique countries"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT DISTINCT country FROM companies WHERE country IS NOT NULL ORDER BY country')
            return [row[0] for row in cursor.fetchall()]

    def get_all_companies(self) -> List[Dict]:
        """Get all companies for snapshot creation"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, batch, is_hiring, team_size, status, industry
                FROM companies
            """)
            return [dict(row) for row in cursor.fetchall()]

    def get_all_companies_full(self) -> List[Dict]:
        """Get all companies with full columns for in-memory cache hydration."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM companies")
            return [dict(row) for row in cursor.fetchall()]

    # ============================================================================
    # COMPANY CHANGES LOG METHODS (replaces snapshots)
    # ============================================================================

    def log_change(
        self,
        company_id: int,
        change_type: str,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
        field_name: Optional[str] = None
    ) -> int:
        """Log a company change to the change log table"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR IGNORE INTO company_changes (company_id, change_type, field_name, old_value, new_value)
                VALUES (?, ?, ?, ?, ?)
            ''', (company_id, change_type, field_name, old_value, new_value))
            return cursor.lastrowid

    def get_recent_changes(
        self,
        hours: int = 24,
        change_types: Optional[List[str]] = None
    ) -> List[Dict]:
        """Get recent changes from the change log"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            query = """
                SELECT
                    cc.id,
                    cc.company_id,
                    c.name as company_name,
                    c.slug as company_slug,
                    c.batch,
                    c.industry,
                    c.is_hiring,
                    c.small_logo_thumb_url as logo,
                    cc.change_type,
                    cc.field_name,
                    cc.old_value,
                    cc.new_value,
                    cc.changed_at
                FROM company_changes cc
                JOIN companies c ON c.id = cc.company_id
                WHERE cc.changed_at >= datetime('now', '-' || ? || ' hours')
            """
            params = [hours]

            if change_types:
                placeholders = ','.join('?' * len(change_types))
                query += f" AND cc.change_type IN ({placeholders})"
                params.extend(change_types)

            query += " ORDER BY cc.changed_at DESC"

            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def get_changes_by_type(
        self,
        change_type: str,
        hours: int = 24,
        limit: int = 100
    ) -> List[Dict]:
        """Get changes of a specific type"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT
                    cc.id,
                    cc.company_id,
                    c.name as company_name,
                    c.slug as company_slug,
                    c.batch,
                    c.industry,
                    c.one_liner,
                    c.website,
                    c.small_logo_thumb_url as logo,
                    c.team_size,
                    c.all_locations,
                    cc.old_value,
                    cc.new_value,
                    cc.changed_at
                FROM company_changes cc
                JOIN companies c ON c.id = cc.company_id
                WHERE cc.change_type = ?
                    AND cc.changed_at >= datetime('now', '-' || ? || ' hours')
                ORDER BY cc.changed_at DESC
                LIMIT ?
            """, (change_type, hours, limit))
            return [dict(row) for row in cursor.fetchall()]

    def cleanup_old_changes(self, days_to_keep: int = 90) -> int:
        """Delete change log entries older than specified days"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM company_changes WHERE changed_at < datetime('now', '-' || ? || ' days')",
                (days_to_keep,)
            )
            return cursor.rowcount

    def get_change_stats(self, days: int = 7) -> Dict:
        """Get statistics about changes over the last N days"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT
                    DATE(changed_at) as date,
                    change_type,
                    COUNT(*) as count
                FROM company_changes
                WHERE changed_at >= datetime('now', '-' || ? || ' days')
                GROUP BY DATE(changed_at), change_type
                ORDER BY date DESC, change_type
            """, (days,))
            results = [dict(row) for row in cursor.fetchall()]

            stats_by_date = {}
            for row in results:
                date_str = str(row['date'])
                if date_str not in stats_by_date:
                    stats_by_date[date_str] = {}
                stats_by_date[date_str][row['change_type']] = row['count']

            return {
                'by_date': stats_by_date,
                'raw': results
            }

    def get_hiring_board(self) -> Dict[str, Any]:
        """Get all hiring companies and jobs from database"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Get companies
            cursor.execute('SELECT * FROM hiring_companies')
            companies = [dict(row) for row in cursor.fetchall()]

            # Get jobs
            cursor.execute('SELECT * FROM hiring_jobs')
            jobs = []
            for row in cursor.fetchall():
                job = dict(row)
                # Parse locations JSON
                try:
                    import json
                    if job.get('locations'):
                        job['locations'] = json.loads(job['locations'])
                except (json.JSONDecodeError, TypeError):
                    job['locations'] = []
                jobs.append(job)

            return {
                "companies": companies,
                "jobs": jobs
            }

    def update_hiring_board(self, data: Dict[str, Any]) -> bool:
        """Update hiring companies and jobs in database"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                import json

                companies = data.get("companies", [])
                jobs = data.get("jobs", [])

                # Clear existing data or use upsert to maintain consistency
                # Using upsert pattern for companies
                for company in companies:
                    cursor.execute('''
                        INSERT OR REPLACE INTO hiring_companies
                        (id, name, slug, batch, team_size, location, logo_url, small_logo_url, website, one_liner, primary_vertical, raw_json, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                    ''', (
                        company.get('id'),
                        company.get('name'),
                        company.get('slug'),
                        company.get('batch'),
                        company.get('team_size'),
                        company.get('location'),
                        company.get('logo_url'),
                        company.get('small_logo_url'),
                        company.get('website'),
                        company.get('one_liner'),
                        company.get('primary_vertical'),
                        json.dumps(company)
                    ))

                # Using upsert pattern for jobs
                for job in jobs:
                    locations_json = json.dumps(job.get('locations', []))
                    cursor.execute('''
                        INSERT OR REPLACE INTO hiring_jobs
                        (id, company_id, title, description, pretty_role, salary_min, salary_max,
                         job_type, remote, locations, pretty_location_or_remote, pretty_job_type,
                         pretty_min_experience, pretty_updated_at, show_path, raw_json, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                    ''', (
                        job.get('id'),
                        job.get('company_id'),
                        job.get('title'),
                        job.get('description'),
                        job.get('pretty_role'),
                        job.get('salary_min'),
                        job.get('salary_max'),
                        job.get('job_type'),
                        job.get('remote'),
                        locations_json,
                        job.get('pretty_location_or_remote'),
                        job.get('pretty_job_type'),
                        job.get('pretty_min_experience'),
                        job.get('pretty_updated_at'),
                        job.get('show_path'),
                        json.dumps(job)
                    ))

                logger.info(f"Updated hiring board: {len(companies)} companies, {len(jobs)} jobs")
                return True

        except Exception as e:
            logger.error(f"Error updating hiring board: {e}")
            return False

    # ============================================================================
    # GAMIFICATION & PREDICTION METHODS
    # ============================================================================

    def store_prediction(self, idea_description, team_info, industry, location, market_type,
                        idea_score, team_score, market_score, combined_score, percentile, tier,
                        top_matches, achievements, challenges):
        """Store a prediction result in the database."""
        import json
        import uuid

        try:
            prediction_id = str(uuid.uuid4())

            with self.connection:
                cursor = self.connection.cursor()
                cursor.execute('''
                    INSERT INTO predictions (
                        id, idea_description, team_info, industry, location, market_type,
                        idea_score, team_score, market_score, combined_score, percentile, tier,
                        top_matches, achievements, challenges, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                ''', (
                    prediction_id,
                    idea_description,
                    json.dumps(team_info) if team_info else None,
                    industry,
                    location,
                    market_type,
                    idea_score,
                    team_score,
                    market_score,
                    combined_score,
                    percentile,
                    tier,
                    json.dumps(top_matches),
                    json.dumps(achievements),
                    json.dumps(challenges)
                ))
                self.connection.commit()

            return prediction_id
        except Exception as e:
            logger.error(f"Error storing prediction: {e}")
            return None

    def get_all_company_success_scores(self):
        """Get success scores for all YC companies for percentile calculation."""
        try:
            cursor = self.connection.cursor()
            cursor.execute('''
                SELECT
                    CASE
                        WHEN funding_total_usd >= 1000000000 THEN 95
                        WHEN funding_total_usd >= 100000000 THEN 85
                        WHEN funding_total_usd >= 50000000 THEN 75
                        WHEN funding_total_usd >= 10000000 THEN 65
                        ELSE 50
                    END as success_score
                FROM companies
                WHERE funding_total_usd IS NOT NULL
                ORDER BY funding_total_usd DESC
            ''')
            scores = [row[0] for row in cursor.fetchall()]
            return scores if scores else [50] * 100
        except Exception as e:
            logger.error(f"Error getting company success scores: {e}")
            return [50] * 100

    def get_prediction_leaderboard_position(self, combined_score):
        """Get leaderboard position for a given score."""
        try:
            cursor = self.connection.cursor()
            cursor.execute('''
                SELECT COUNT(*) + 1 FROM predictions
                WHERE combined_score > ? AND is_public = true
            ''', (combined_score,))
            position = cursor.fetchone()[0]
            return position if position else 0
        except Exception as e:
            logger.error(f"Error getting leaderboard position: {e}")
            return 0

    def get_leaderboard(self, industry=None, timeframe="all-time", limit=100):
        """Get the leaderboard of predictions."""
        import json
        from datetime import datetime, timedelta

        try:
            cursor = self.connection.cursor()

            # Build WHERE clause based on timeframe
            where_clauses = ["is_public = true"]

            if timeframe == "this-week":
                one_week_ago = (datetime.now() - timedelta(days=7)).isoformat()
                where_clauses.append(f"created_at >= '{one_week_ago}'")
            elif timeframe == "this-month":
                one_month_ago = (datetime.now() - timedelta(days=30)).isoformat()
                where_clauses.append(f"created_at >= '{one_month_ago}'")

            if industry:
                where_clauses.append(f"industry = ?")

            where_sql = " AND ".join(where_clauses)

            query = f"""
                SELECT id, idea_description, combined_score, tier, industry, achievements, created_at
                FROM predictions
                WHERE {where_sql}
                ORDER BY combined_score DESC
                LIMIT ?
            """

            params = []
            if industry:
                params.append(industry)
            params.append(limit)

            cursor.execute(query, tuple(params))
            results = cursor.fetchall()

            return [
                {
                    "id": row[0],
                    "idea_description": row[1],
                    "combined_score": row[2],
                    "tier": row[3],
                    "industry": row[4],
                    "achievements": json.loads(row[5]) if row[5] else [],
                    "created_at": row[6],
                    "rank": idx + 1
                }
                for idx, row in enumerate(results)
            ]
        except Exception as e:
            logger.error(f"Error getting leaderboard: {e}")
            return []

    def get_prediction(self, prediction_id):
        """Get a specific prediction by ID."""
        import json

        try:
            cursor = self.connection.cursor()
            cursor.execute('''
                SELECT id, idea_description, team_info, industry, location, market_type,
                       idea_score, team_score, market_score, combined_score, percentile, tier,
                       top_matches, achievements, challenges, created_at
                FROM predictions
                WHERE id = ?
            ''', (prediction_id,))
            row = cursor.fetchone()

            if row:
                return {
                    "id": row[0],
                    "idea_description": row[1],
                    "team_info": json.loads(row[2]) if row[2] else None,
                    "industry": row[3],
                    "location": row[4],
                    "market_type": row[5],
                    "idea_score": row[6],
                    "team_score": row[7],
                    "market_score": row[8],
                    "combined_score": row[9],
                    "percentile": row[10],
                    "tier": row[11],
                    "top_matches": json.loads(row[12]) if row[12] else [],
                    "achievements": json.loads(row[13]) if row[13] else [],
                    "challenges": json.loads(row[14]) if row[14] else [],
                    "created_at": row[15]
                }
            return None
        except Exception as e:
            logger.error(f"Error getting prediction: {e}")
            return None

    def update_prediction_sharing(self, prediction_id, is_public):
        """Update prediction sharing status."""
        try:
            with self.connection:
                cursor = self.connection.cursor()
                cursor.execute('''
                    UPDATE predictions
                    SET is_public = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (is_public, prediction_id))
            return True
        except Exception as e:
            logger.error(f"Error updating prediction sharing: {e}")
            return False

    def set_prediction_share_token(self, prediction_id, share_token):
        """Set share token for a prediction."""
        try:
            with self.connection:
                cursor = self.connection.cursor()
                cursor.execute('''
                    UPDATE predictions
                    SET share_token = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (share_token, prediction_id))
            return True
        except Exception as e:
            logger.error(f"Error setting share token: {e}")
            return False

    def get_prediction_by_share_token(self, share_token):
        """Get prediction by share token."""
        import json

        try:
            cursor = self.connection.cursor()
            cursor.execute('''
                SELECT id, idea_description, team_info, industry, location, market_type,
                       idea_score, team_score, market_score, combined_score, percentile, tier,
                       top_matches, achievements, challenges, created_at
                FROM predictions
                WHERE share_token = ? AND is_public = true
            ''', (share_token,))
            row = cursor.fetchone()

            if row:
                return {
                    "id": row[0],
                    "idea_description": row[1],
                    "team_info": json.loads(row[2]) if row[2] else None,
                    "industry": row[3],
                    "location": row[4],
                    "market_type": row[5],
                    "idea_score": row[6],
                    "team_score": row[7],
                    "market_score": row[8],
                    "combined_score": row[9],
                    "percentile": row[10],
                    "tier": row[11],
                    "top_matches": json.loads(row[12]) if row[12] else [],
                    "achievements": json.loads(row[13]) if row[13] else [],
                    "challenges": json.loads(row[14]) if row[14] else [],
                    "created_at": row[15]
                }
            return None
        except Exception as e:
            logger.error(f"Error getting prediction by share token: {e}")
            return None

    def get_cached_research(self, query: str) -> Optional[Dict]:
        """Get cached research result for a query"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM research_cache WHERE LOWER(query) = LOWER(?) LIMIT 1",
                (query,)
            )
            row = cursor.fetchone()
            if row:
                # Parse JSON fields - handle both string and already-parsed data
                response_data = row[3]
                if isinstance(response_data, str):
                    response_data = json.loads(response_data)

                parsed_sections = row[4]
                if parsed_sections and isinstance(parsed_sections, str):
                    parsed_sections = json.loads(parsed_sections)

                citations = row[5]
                if citations:
                    if isinstance(citations, str):
                        citations = json.loads(citations)
                else:
                    citations = []

                return {
                    "id": row[0],
                    "query": row[1],
                    "query_type": row[2],
                    "response_data": response_data,
                    "parsed_sections": parsed_sections,
                    "citations": citations,
                    "view_count": row[6],
                    "search_count": row[7],
                    "created_at": row[8],
                    "updated_at": row[9],
                    "cached": True
                }
            return None

    def store_research(self, query: str, query_type: str, response_data: Dict, parsed_sections: Optional[Dict] = None) -> int:
        """Store research result in cache"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            citations = response_data.get("citations", [])

            # Ensure citations is a list and convert to JSON string
            if isinstance(citations, str):
                citations_json = citations
            else:
                citations_json = json.dumps(citations) if citations else json.dumps([])

            # Make a clean copy of response_data with serializable citations
            clean_response_data = response_data.copy()
            clean_response_data["citations"] = json.loads(citations_json)  # Ensure it's a list

            try:
                cursor.execute('''
                    INSERT OR REPLACE INTO research_cache
                    (query, query_type, response_data, parsed_sections, citations, updated_at)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ''', (
                    query,
                    query_type,
                    json.dumps(clean_response_data),
                    json.dumps(parsed_sections) if parsed_sections else None,
                    citations_json
                ))
                return cursor.lastrowid
            except Exception as e:
                logger.error(f"Error storing research: {e}")
                raise

    def increment_research_view_count(self, query: str) -> None:
        """Increment view count for cached research"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE research_cache SET view_count = view_count + 1, search_count = search_count + 1, updated_at = CURRENT_TIMESTAMP WHERE LOWER(query) = LOWER(?)",
                (query,)
            )

    def get_all_research_history(self, limit: int = 50, offset: int = 0, sort_by: str = "recent") -> List[Dict]:
        """Get all research history with optional sorting"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            order_by = "updated_at DESC"  # default: recent
            if sort_by == "popular":
                order_by = "view_count DESC"
            elif sort_by == "oldest":
                order_by = "created_at ASC"

            cursor.execute(f'''
                SELECT id, query, query_type, response_data, citations, view_count, search_count, created_at, updated_at
                FROM research_cache
                ORDER BY {order_by}
                LIMIT ? OFFSET ?
            ''', (limit, offset))

            results = []
            for row in cursor.fetchall():
                # Parse JSON fields - handle both string and already-parsed data
                response_data = row[3]
                if isinstance(response_data, str):
                    response_data = json.loads(response_data)

                citations = row[4]
                if citations:
                    if isinstance(citations, str):
                        citations = json.loads(citations)
                else:
                    citations = []

                results.append({
                    "id": row[0],
                    "query": row[1],
                    "query_type": row[2],
                    "response_data": response_data,
                    "citations": citations,
                    "view_count": row[5],
                    "search_count": row[6],
                    "created_at": row[7],
                    "updated_at": row[8]
                })
            return results

    def get_popular_research(self, limit: int = 10) -> List[Dict]:
        """Get most popular research queries"""
        return self.get_all_research_history(limit=limit, sort_by="popular")

    def search_research_history(self, search_query: str, limit: int = 20) -> List[Dict]:
        """Search research history by company name or query"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            search_pattern = f"%{search_query}%"

            cursor.execute('''
                SELECT id, query, query_type, response_data, citations, view_count, search_count, created_at, updated_at
                FROM research_cache
                WHERE query LIKE ? OR response_data LIKE ?
                ORDER BY view_count DESC, updated_at DESC
                LIMIT ?
            ''', (search_pattern, search_pattern, limit))

            results = []
            for row in cursor.fetchall():
                # Parse JSON fields - handle both string and already-parsed data
                response_data = row[3]
                if isinstance(response_data, str):
                    response_data = json.loads(response_data)

                citations = row[4]
                if citations:
                    if isinstance(citations, str):
                        citations = json.loads(citations)
                else:
                    citations = []

                results.append({
                    "id": row[0],
                    "query": row[1],
                    "query_type": row[2],
                    "response_data": response_data,
                    "citations": citations,
                    "view_count": row[5],
                    "search_count": row[6],
                    "created_at": row[7],
                    "updated_at": row[8]
                })
            return results

    def get_research_stats(self) -> Dict:
        """Get research statistics"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM research_cache")
            total_searches = cursor.fetchone()[0]

            cursor.execute("SELECT SUM(view_count) FROM research_cache")
            total_views = cursor.fetchone()[0] or 0

            cursor.execute("SELECT AVG(view_count) FROM research_cache")
            avg_views = cursor.fetchone()[0] or 0

            return {
                "total_searches": total_searches,
                "total_views": total_views,
                "avg_views_per_search": round(avg_views, 2)
            }

    # ============================================================================
    # FOUNDER LEADERBOARDS (authoritative dataset + derived stats)
    # ============================================================================

    # Metric -> founder_stats sort column for the leaderboards.
    _FOUNDER_METRIC_COLUMNS = {
        "serial": "companies_count",
        "funded": "total_funding_usd",
        "exits": "max_valuation_usd",   # biggest-exit proxy (valuation of largest company)
        "unicorns": "max_valuation_usd",
    }

    def upsert_founder(self, founder: Dict[str, Any]) -> int:
        """Insert or update a founder, deduped on yc_user_id. Returns founder_id."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            yc_user_id = founder.get("yc_user_id")
            existing = None
            if yc_user_id is not None:
                cursor.execute("SELECT id FROM founders WHERE yc_user_id = ?", (yc_user_id,))
                existing = cursor.fetchone()
            if existing:
                founder_id = existing[0]
                cursor.execute('''
                    UPDATE founders SET
                        full_name = ?, slug = COALESCE(?, slug), bio = ?, avatar_url = ?,
                        linkedin_url = ?, twitter_url = ?, is_active = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (
                    founder.get("full_name") or "Unknown",
                    founder.get("slug"),
                    founder.get("bio"),
                    founder.get("avatar_url"),
                    founder.get("linkedin_url"),
                    founder.get("twitter_url"),
                    founder.get("is_active"),
                    founder_id,
                ))
                return founder_id
            cursor.execute('''
                INSERT INTO founders
                    (yc_user_id, full_name, slug, bio, avatar_url, linkedin_url,
                     twitter_url, is_active, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ''', (
                yc_user_id,
                founder.get("full_name") or "Unknown",
                founder.get("slug"),
                founder.get("bio"),
                founder.get("avatar_url"),
                founder.get("linkedin_url"),
                founder.get("twitter_url"),
                founder.get("is_active"),
            ))
            return cursor.lastrowid

    def link_company_founder(self, company_id: int, founder_id: int,
                             title: Optional[str] = None, source: str = "yc") -> None:
        """Insert (or update the title of) a founder <-> company edge."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO company_founders (company_id, founder_id, title, source)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (company_id, founder_id) DO UPDATE SET
                    title = COALESCE(excluded.title, company_founders.title),
                    source = excluded.source
            ''', (company_id, founder_id, title, source))

    def refresh_founder_stats(self) -> int:
        """Recompute the derived founder_stats table (SQLite has no matviews).

        Aggregates company_founders ⋈ companies. Returns the number of founder rows.
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM founder_stats")
            cursor.execute('''
                INSERT INTO founder_stats (
                    founder_id, companies_count, batches, latest_batch,
                    total_funding_usd, max_valuation_usd, has_unicorn,
                    best_exit_type, best_exit_acquirer, total_employee_count,
                    is_repeat_founder
                )
                SELECT
                    cf.founder_id,
                    COUNT(DISTINCT c.id),
                    GROUP_CONCAT(DISTINCT c.batch),
                    MAX(c.batch),
                    COALESCE(SUM(c.funding_total_usd), 0),
                    COALESCE(MAX(c.valuation_usd), 0),
                    CASE WHEN COALESCE(MAX(c.valuation_usd), 0) >= 1000000000 THEN 1 ELSE 0 END,
                    NULL,
                    NULL,
                    COALESCE(SUM(c.employee_count), 0),
                    CASE WHEN COUNT(DISTINCT c.id) > 1 THEN 1 ELSE 0 END
                FROM company_founders cf
                JOIN companies c ON c.id = cf.company_id
                GROUP BY cf.founder_id
            ''')
            # best exit type/acquirer: the exit of the founder's highest-valued company.
            cursor.execute('''
                SELECT cf.founder_id, c.exit_type, c.acquirer,
                       COALESCE(c.valuation_usd, 0) AS val
                FROM company_founders cf
                JOIN companies c ON c.id = cf.company_id
                WHERE c.exit_type IS NOT NULL OR c.acquirer IS NOT NULL
            ''')
            best: Dict[int, tuple] = {}
            for fid, exit_type, acquirer, val in cursor.fetchall():
                cur_best = best.get(fid)
                if cur_best is None or val > cur_best[0]:
                    best[fid] = (val, exit_type, acquirer)
            for fid, (_val, exit_type, acquirer) in best.items():
                cursor.execute(
                    "UPDATE founder_stats SET best_exit_type = ?, best_exit_acquirer = ? WHERE founder_id = ?",
                    (exit_type, acquirer, fid),
                )
            cursor.execute("SELECT COUNT(*) FROM founder_stats")
            return cursor.fetchone()[0]

    @staticmethod
    def _founder_batches_list(raw) -> List[str]:
        """Normalize the stored batches value (GROUP_CONCAT string) into a list."""
        if not raw:
            return []
        if isinstance(raw, list):
            return [b for b in raw if b]
        return [b for b in str(raw).split(",") if b]

    def get_founder_by_slug(self, slug: str) -> Optional[Dict]:
        """Return a founder profile: founder fields, derived stats, their companies,
        every leaderboard rank they hold, and enrichment (or None). See spec §7.1."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM founders WHERE slug = ?", (slug,))
            frow = cursor.fetchone()
            if not frow:
                return None
            founder = dict(frow)
            founder_id = founder["id"]

            cursor.execute("SELECT * FROM founder_stats WHERE founder_id = ?", (founder_id,))
            srow = cursor.fetchone()
            stats = self._normalize_founder_stats(dict(srow) if srow else {})

            cursor.execute('''
                SELECT c.slug, c.name, c.batch, cf.title, c.one_liner, c.status,
                       c.funding_total_usd, c.team_size, c.all_locations
                FROM company_founders cf
                JOIN companies c ON c.id = cf.company_id
                WHERE cf.founder_id = ?
                ORDER BY COALESCE(c.funding_total_usd, 0) DESC
            ''', (founder_id,))
            companies = [
                {
                    "slug": r[0], "name": r[1], "batch": r[2], "title": r[3],
                    "one_liner": r[4], "status": r[5],
                    "funding_total_usd": r[6], "team_size": r[7], "location": r[8],
                }
                for r in cursor.fetchall()
            ]

            ranks = self._get_founder_ranks(cursor, founder_id)
            enrichment = self._get_founder_enrichment(cursor, founder_id)

            return {
                "founder": {
                    "id": founder_id,
                    "slug": founder.get("slug"),
                    "full_name": founder.get("full_name"),
                    "title": companies[0]["title"] if companies else None,
                    "avatar_url": founder.get("avatar_url"),
                    "linkedin_url": founder.get("linkedin_url"),
                    "twitter_url": founder.get("twitter_url"),
                    "bio": founder.get("bio"),
                },
                "stats": stats,
                "companies": companies,
                "ranks": ranks,
                "enrichment": enrichment,
            }

    def _normalize_founder_stats(self, s: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "companies_count": s.get("companies_count") or 0,
            "batches": self._founder_batches_list(s.get("batches")),
            "latest_batch": s.get("latest_batch"),
            "total_funding_usd": s.get("total_funding_usd") or 0,
            "max_valuation_usd": s.get("max_valuation_usd") or 0,
            "has_unicorn": bool(s.get("has_unicorn")),
            "best_exit_type": s.get("best_exit_type"),
            "best_exit_acquirer": s.get("best_exit_acquirer"),
            "total_employee_count": s.get("total_employee_count") or 0,
            "is_repeat_founder": bool(s.get("is_repeat_founder")),
        }

    def _get_founder_ranks(self, cursor, founder_id: int) -> List[Dict]:
        """Rank position for this founder in each authoritative metric board."""
        ranks = []
        for metric, column in self._FOUNDER_METRIC_COLUMNS.items():
            where = ""
            if metric == "serial":
                where = "WHERE companies_count > 1"
            elif metric == "unicorns":
                where = "WHERE has_unicorn = 1"
            cursor.execute(f'''
                SELECT founder_id FROM founder_stats
                {where}
                ORDER BY {column} DESC, founder_id ASC
            ''')
            for idx, row in enumerate(cursor.fetchall(), start=1):
                if row[0] == founder_id:
                    ranks.append({"metric": metric, "rank": idx})
                    break
        return ranks

    def _get_founder_enrichment(self, cursor, founder_id: int) -> Optional[Dict]:
        cursor.execute("SELECT * FROM founder_enrichment WHERE founder_id = ?", (founder_id,))
        row = cursor.fetchone()
        if not row:
            return None
        e = dict(row)
        for k in ("education", "awards", "notable_exits", "notable_prior_roles",
                  "citations", "confidence", "raw_response"):
            v = e.get(k)
            if isinstance(v, str):
                try:
                    e[k] = json.loads(v)
                except (json.JSONDecodeError, TypeError):
                    e[k] = None
        return e

    def get_founder_leaderboard(self, metric: str, batch: Optional[str] = None,
                                industry: Optional[str] = None, limit: int = 50,
                                offset: int = 0) -> Dict[str, Any]:
        """Ranked founders for an authoritative metric. Returns {total, results}
        where each result is {founder, stats}; rank/headline are added by the caller."""
        column = self._FOUNDER_METRIC_COLUMNS.get(metric)
        if column is None:
            raise ValueError(f"unknown metric: {metric}")

        with self.get_connection() as conn:
            cursor = conn.cursor()

            filters = []
            params: List[Any] = []
            if metric == "serial":
                filters.append("fs.companies_count > 1")
            elif metric == "unicorns":
                filters.append("fs.has_unicorn = 1")

            # batch/industry filters require joining back to the founder's companies.
            join = ""
            if batch or industry:
                join = ("JOIN company_founders cf ON cf.founder_id = fs.founder_id "
                        "JOIN companies c ON c.id = cf.company_id")
                if batch:
                    filters.append("c.batch = ?")
                    params.append(batch)
                if industry:
                    filters.append("c.industry = ?")
                    params.append(industry)

            where = ("WHERE " + " AND ".join(filters)) if filters else ""

            count_sql = f'''
                SELECT COUNT(*) FROM (
                    SELECT fs.founder_id FROM founder_stats fs {join} {where}
                    GROUP BY fs.founder_id
                )
            '''
            cursor.execute(count_sql, params)
            total = cursor.fetchone()[0]

            list_sql = f'''
                SELECT fs.founder_id,
                       fs.companies_count, fs.batches, fs.latest_batch,
                       fs.total_funding_usd, fs.max_valuation_usd, fs.has_unicorn,
                       fs.best_exit_type, fs.best_exit_acquirer,
                       fs.total_employee_count, fs.is_repeat_founder,
                       f.slug, f.full_name, f.avatar_url, f.linkedin_url, f.twitter_url
                FROM founder_stats fs
                JOIN founders f ON f.id = fs.founder_id
                {join}
                {where}
                GROUP BY fs.founder_id
                ORDER BY {column} DESC, fs.founder_id ASC
                LIMIT ? OFFSET ?
            '''
            cursor.execute(list_sql, params + [limit, offset])
            rows = cursor.fetchall()

            results = []
            for r in rows:
                d = dict(r)
                # per-founder title: pull from their highest-funded company edge.
                cursor.execute('''
                    SELECT cf.title FROM company_founders cf
                    JOIN companies c ON c.id = cf.company_id
                    WHERE cf.founder_id = ?
                    ORDER BY COALESCE(c.funding_total_usd, 0) DESC LIMIT 1
                ''', (d["founder_id"],))
                trow = cursor.fetchone()
                results.append({
                    "founder": {
                        "id": d["founder_id"],
                        "slug": d["slug"],
                        "full_name": d["full_name"],
                        "title": trow[0] if trow else None,
                        "avatar_url": d["avatar_url"],
                        "linkedin_url": d["linkedin_url"],
                        "twitter_url": d["twitter_url"],
                    },
                    "stats": self._normalize_founder_stats(d),
                })

            return {"total": total, "results": results}

    def get_founders_for_enrichment(self, limit: int = 25, stale_days: int = 30,
                                    include_all: bool = False) -> List[Dict]:
        """Prioritized founders to enrich (spec §6.2). Skips rows enriched within
        stale_days unless include_all. Prioritizes highest derived stats first."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            ttl_clause = "" if include_all else (
                "AND (e.enriched_at IS NULL OR "
                "e.enriched_at < datetime('now', ?))"
            )
            params: List[Any] = []
            if not include_all:
                params.append(f"-{stale_days} days")
            params.append(limit)
            cursor.execute(f'''
                SELECT f.id, f.yc_user_id, f.full_name, f.slug,
                       fs.latest_batch, fs.total_funding_usd, fs.max_valuation_usd,
                       fs.companies_count
                FROM founders f
                LEFT JOIN founder_stats fs ON fs.founder_id = f.id
                LEFT JOIN founder_enrichment e ON e.founder_id = f.id
                WHERE 1=1 {ttl_clause}
                ORDER BY COALESCE(fs.total_funding_usd, 0) DESC,
                         COALESCE(fs.max_valuation_usd, 0) DESC,
                         COALESCE(fs.companies_count, 0) DESC
                LIMIT ?
            ''', params)
            cols = [c[0] for c in cursor.description]
            out = [dict(zip(cols, row)) for row in cursor.fetchall()]
            # attach a representative company name for the enrichment prompt.
            for f in out:
                cursor.execute('''
                    SELECT c.name FROM company_founders cf
                    JOIN companies c ON c.id = cf.company_id
                    WHERE cf.founder_id = ?
                    ORDER BY COALESCE(c.funding_total_usd, 0) DESC LIMIT 1
                ''', (f["id"],))
                crow = cursor.fetchone()
                f["company_name"] = crow[0] if crow else None
            return out

    def get_companies_for_funding_enrichment(self, limit: int = 50, stale_days: int = 30,
                                              include_all: bool = False) -> List[Dict]:
        """Prioritized YC companies to enrich funding for (Perplexity-sourced).

        Founder-linked companies come first (they feed the Founder Leaderboards),
        then by known funding size. Rows enriched within stale_days are skipped
        unless include_all (a deliberate full backfill).
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            ttl_clause = "" if include_all else (
                "AND (c.funding_enriched_at IS NULL OR "
                "c.funding_enriched_at < datetime('now', ?))"
            )
            params: List[Any] = []
            if not include_all:
                params.append(f"-{stale_days} days")
            params.append(limit)
            cursor.execute(f'''
                SELECT c.id, c.name, c.slug, c.batch, c.one_liner,
                       (SELECT COUNT(*) FROM company_founders cf WHERE cf.company_id = c.id) AS founder_count
                FROM companies c
                WHERE LOWER(COALESCE(c.source, 'yc')) = 'yc'
                  AND c.slug IS NOT NULL AND c.slug <> ''
                  {ttl_clause}
                ORDER BY founder_count DESC,
                         COALESCE(c.funding_total_usd, 0) DESC,
                         c.id DESC
                LIMIT ?
            ''', params)
            cols = [d[0] for d in cursor.description]
            return [dict(zip(cols, row)) for row in cursor.fetchall()]

    def upsert_founder_enrichment(self, founder_id: int, data: Dict[str, Any]) -> None:
        """Upsert supplementary enrichment for a founder (doubles as the TTL cache)."""
        def _j(v):
            return json.dumps(v) if v is not None else None
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO founder_enrichment (
                    founder_id, twitter_followers, linkedin_followers, education,
                    awards, notable_exits, angel_investments_count, notable_prior_roles,
                    bio_long, citations, confidence, model, raw_response, enriched_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (founder_id) DO UPDATE SET
                    twitter_followers = excluded.twitter_followers,
                    linkedin_followers = excluded.linkedin_followers,
                    education = excluded.education,
                    awards = excluded.awards,
                    notable_exits = excluded.notable_exits,
                    angel_investments_count = excluded.angel_investments_count,
                    notable_prior_roles = excluded.notable_prior_roles,
                    bio_long = excluded.bio_long,
                    citations = excluded.citations,
                    confidence = excluded.confidence,
                    model = excluded.model,
                    raw_response = excluded.raw_response,
                    enriched_at = CURRENT_TIMESTAMP
            ''', (
                founder_id,
                data.get("twitter_followers"),
                data.get("linkedin_followers"),
                _j(data.get("education")),
                _j(data.get("awards")),
                _j(data.get("notable_exits")),
                data.get("angel_investments_count"),
                _j(data.get("notable_prior_roles")),
                data.get("bio_long"),
                _j(data.get("citations")),
                _j(data.get("confidence")),
                data.get("model"),
                _j(data.get("raw_response")),
            ))

    def get_yc_company_slugs(self) -> List[Dict]:
        """source='yc' companies with a slug — the founder scraper's input set."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, slug FROM companies
                WHERE LOWER(COALESCE(source, 'yc')) = 'yc'
                  AND slug IS NOT NULL AND slug <> ''
            ''')
            return [{"id": r[0], "slug": r[1]} for r in cursor.fetchall()]

    def get_unsourced_yc_company_slugs(self, limit: int) -> List[Dict]:
        """YC companies never sourced for founders yet (no company_founders rows).

        Bounded incremental input for the nightly founder-sourcing cron: returns up to
        ``limit`` source='yc' companies with a slug that have zero founder edges, most
        notable first (top_company, then largest team) so marquee companies get founders
        before the long tail. Drains the backlog over successive runs without re-scraping
        every company each night.
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT c.id, c.slug FROM companies c
                WHERE LOWER(COALESCE(c.source, 'yc')) = 'yc'
                  AND c.slug IS NOT NULL AND c.slug <> ''
                  AND NOT EXISTS (
                      SELECT 1 FROM company_founders cf WHERE cf.company_id = c.id
                  )
                ORDER BY c.top_company DESC, COALESCE(c.team_size, 0) DESC, c.id DESC
                LIMIT ?
            ''', (limit,))
            return [{"id": r[0], "slug": r[1]} for r in cursor.fetchall()]

    def get_company_id_by_slug(self, slug: str) -> Optional[int]:
        """Resolve a YC company slug to its internal id (for edge insertion)."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id FROM companies WHERE slug = ? AND LOWER(COALESCE(source,'yc')) = 'yc' LIMIT 1",
                (slug,),
            )
            row = cursor.fetchone()
            return row[0] if row else None

    # ============================================================================
    # IDEA ANSWER CACHE METHODS (no-op stubs — caching is Postgres-only)
    # ============================================================================

    def get_idea_answer_cache(self, query_key: str):
        return None  # caching is Postgres-only; local dev always computes fresh

    def set_idea_answer_cache(self, query_key: str, answer_json: dict, ttl_hours: int = 24, prose: str = None) -> None:
        return None

    # ============================================================================
    # EXPLOREYC WORLD (plots, payments, boards, promotions)
    # Signatures are identical in database_postgres.py — keep them in lockstep.
    # ============================================================================

    #: Columns a plot owner may edit via update_world_plot. `status` is included
    #: so moderation can flip active/pending; money fields never appear here.
    WORLD_PLOT_EDITABLE_FIELDS = frozenset({
        "name", "url", "tagline", "founder_name", "founder_title",
        "founder_link", "logo_url", "status", "city_id",
    })

    @staticmethod
    def _world_ts(value):
        """Normalize datetimes to SQLite's CURRENT_TIMESTAMP text format (UTC)."""
        if value is None:
            return None
        if hasattr(value, "strftime"):
            return value.strftime("%Y-%m-%d %H:%M:%S")
        return str(value)

    def seed_world_reference_data(self, data_dir: Optional[str] = None) -> Dict[str, int]:
        """Idempotently load world_countries + world_cities from backend/data/.

        INSERT OR IGNORE keyed on the primary keys, so re-running never touches
        a plot or payment. Skips entirely when row counts already match the
        files (startup fast path). Returns {'countries': n, 'cities': n} counts
        now present in the DB.
        """
        base = data_dir or str(Path(__file__).parent / "data")
        with open(Path(base) / "world_countries.json") as f:
            countries = json.load(f)["countries"]
        with open(Path(base) / "world_cities.json") as f:
            cities = json.load(f)["cities"]
        with self.get_connection() as conn:
            cursor = conn.cursor()
            have_countries = cursor.execute("SELECT COUNT(*) FROM world_countries").fetchone()[0]
            have_cities = cursor.execute("SELECT COUNT(*) FROM world_cities").fetchone()[0]
            if have_countries < len(countries):
                cursor.executemany(
                    '''INSERT OR IGNORE INTO world_countries
                       (iso2, iso3, name, flag_emoji, centroid_lat, centroid_lng)
                       VALUES (?, ?, ?, ?, ?, ?)''',
                    [(c["iso2"], c["iso3"], c["name"], c["flag_emoji"],
                      c["centroid_lat"], c["centroid_lng"]) for c in countries],
                )
            if have_cities < len(cities):
                cursor.executemany(
                    '''INSERT OR IGNORE INTO world_cities
                       (id, name, country_iso, lat, lng, population)
                       VALUES (?, ?, ?, ?, ?, ?)''',
                    [(c["id"], c["name"], c["country_iso"], c["lat"], c["lng"],
                      c["population"]) for c in cities],
                )
            return {
                "countries": cursor.execute("SELECT COUNT(*) FROM world_countries").fetchone()[0],
                "cities": cursor.execute("SELECT COUNT(*) FROM world_cities").fetchone()[0],
            }

    def get_world_country(self, iso2: str) -> Optional[Dict]:
        """Reference row for a country (iso2/iso3/name/flag/centroid), or None."""
        with self.get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM world_countries WHERE iso2 = ?", (iso2.upper(),)
            ).fetchone()
            return dict(row) if row else None

    def list_world_countries(self) -> List[Dict]:
        """All country reference rows, ordered by iso2."""
        with self.get_connection() as conn:
            return [dict(r) for r in conn.execute(
                "SELECT * FROM world_countries ORDER BY iso2").fetchall()]

    def get_world_city(self, city_id: int) -> Optional[Dict]:
        """Reference row for a city (name/country_iso/lat/lng/population), or None."""
        with self.get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM world_cities WHERE id = ?", (city_id,)).fetchone()
            return dict(row) if row else None

    def list_world_cities(self) -> List[Dict]:
        """All city reference rows (id, name, country_iso, lat, lng,
        population), biggest population first. Feeds the globe's city-label
        layer via GET /api/world/cities."""
        with self.get_connection() as conn:
            rows = conn.execute(
                '''SELECT id, name, country_iso, lat, lng, population
                   FROM world_cities ORDER BY population DESC, id''').fetchall()
            return [dict(r) for r in rows]

    def get_world_cities_in_bbox(self, min_lat: float, max_lat: float,
                                 min_lng: float, max_lng: float,
                                 limit: int = 256) -> List[Dict]:
        """Cities inside a bounding box, biggest population first.

        Prefilter for the nearest-city snap: the caller haversines the result.
        When min_lng > max_lng the box wraps the antimeridian and matches
        (lng >= min_lng OR lng <= max_lng).
        """
        lng_clause = "(lng >= ? AND lng <= ?)" if min_lng <= max_lng else "(lng >= ? OR lng <= ?)"
        with self.get_connection() as conn:
            rows = conn.execute(
                f'''SELECT * FROM world_cities
                    WHERE lat >= ? AND lat <= ? AND {lng_clause}
                    ORDER BY population DESC LIMIT ?''',
                (min_lat, max_lat, min_lng, max_lng, limit),
            ).fetchall()
            return [dict(r) for r in rows]

    def create_world_plot(self, plot: Dict[str, Any]) -> int:
        """Insert a plot and return its id.

        Required keys: user_id, name, lat, lng, country_iso. Optional:
        company_id, url, tagline, founder_name, founder_title, founder_link,
        logo_url, city_id, total_cents, status ('active'|'pending').
        """
        with self.get_connection() as conn:
            cursor = conn.execute(
                '''INSERT INTO world_plots
                   (user_id, company_id, name, url, tagline, founder_name,
                    founder_title, founder_link, logo_url, lat, lng,
                    country_iso, city_id, total_cents, status)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (plot["user_id"], plot.get("company_id"), plot["name"],
                 plot.get("url"), plot.get("tagline"), plot.get("founder_name"),
                 plot.get("founder_title"), plot.get("founder_link"),
                 plot.get("logo_url"), plot["lat"], plot["lng"],
                 plot["country_iso"].upper(), plot.get("city_id"),
                 plot.get("total_cents", 0), plot.get("status", "active")),
            )
            return cursor.lastrowid

    def get_world_plot(self, plot_id: int) -> Optional[Dict]:
        """Full plot row plus country_name, city_name, company_slug and a
        `promoted` flag (active featured promotion). None when missing."""
        with self.get_connection() as conn:
            row = conn.execute(
                '''SELECT p.*, wc.name AS country_name, ci.name AS city_name,
                          co.slug AS company_slug,
                          EXISTS(SELECT 1 FROM world_promotions pr
                                 WHERE pr.plot_id = p.id AND pr.kind = 'featured'
                                   AND pr.status = 'active'
                                   AND pr.ends_at > datetime('now')) AS promoted
                   FROM world_plots p
                   JOIN world_countries wc ON wc.iso2 = p.country_iso
                   LEFT JOIN world_cities ci ON ci.id = p.city_id
                   LEFT JOIN companies co ON co.id = p.company_id
                   WHERE p.id = ?''', (plot_id,)).fetchone()
            if not row:
                return None
            plot = dict(row)
            plot["promoted"] = bool(plot["promoted"])
            return plot

    def get_world_plot_by_company(self, company_id: int) -> Optional[Dict]:
        """The plot that claimed a seed company, or None if still unclaimed."""
        with self.get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM world_plots WHERE company_id = ?", (company_id,)
            ).fetchone()
            return dict(row) if row else None

    def get_world_plots_for_globe(self) -> List[Dict]:
        """All active plots for globe rendering: id, lat, lng, name,
        total_cents, country_iso, company_slug, logo_url and promoted flag.

        `logo_url` is the plot's own mark, falling back to the linked company's
        thumbnail — the same precedence the boards use. It rides on the globe
        payload because a paid plot's logo IS the product: the merged globe
        sells a branded marker, and a marker that has to wait for a second
        request per plot renders as an anonymous letter tile for the first
        second of every visit. There are tens of these rows, not thousands, so
        the width costs nothing measurable."""
        with self.get_connection() as conn:
            rows = conn.execute(
                '''SELECT p.id, p.lat, p.lng, p.name, p.total_cents,
                          p.country_iso, p.company_id, co.slug AS company_slug,
                          COALESCE(NULLIF(p.logo_url, ''),
                                   NULLIF(co.small_logo_thumb_url, '')) AS logo_url,
                          EXISTS(SELECT 1 FROM world_promotions pr
                                 WHERE pr.plot_id = p.id AND pr.kind = 'featured'
                                   AND pr.status = 'active'
                                   AND pr.ends_at > datetime('now')) AS promoted
                   FROM world_plots p
                   LEFT JOIN companies co ON co.id = p.company_id
                   WHERE p.status = 'active' '''
            ).fetchall()
            out = []
            for r in rows:
                d = dict(r)
                d["promoted"] = bool(d["promoted"])
                out.append(d)
            return out

    def get_world_seed_companies(self) -> List[Dict]:
        """Geo-located companies not yet claimed as plots — the virtual seed
        pins. Excluded automatically once a plot row references the company.

        Columns: id, name, slug, lat, lng, batch, industry, is_hiring,
        team_size, top_company, logo_url, all_locations. Everything past lng
        exists so the merged globe can FILTER and RENDER the imported layer
        without a second round trip — industry and all_locations in particular
        are what computeHubs() needs to name a hub something better than
        'Unknown'. Blank logo strings collapse to NULL so the client never has
        to distinguish '' from absent.

        The pins are serialized to a compact columnar shape in world.py
        (_encode_seed_layer); this method stays row-shaped and boring."""
        with self.get_connection() as conn:
            rows = conn.execute(
                '''SELECT c.id, c.name, c.slug,
                          c.latitude AS lat, c.longitude AS lng,
                          c.batch, c.industry, c.is_hiring, c.team_size,
                          c.top_company, c.all_locations,
                          NULLIF(c.small_logo_thumb_url, '') AS logo_url
                   FROM companies c
                   WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL
                     AND NOT EXISTS (SELECT 1 FROM world_plots p
                                     WHERE p.company_id = c.id)'''
            ).fetchall()
            return [dict(r) for r in rows]

    def update_world_plot(self, plot_id: int, fields: Dict[str, Any]) -> bool:
        """Update whitelisted identity fields (WORLD_PLOT_EDITABLE_FIELDS) and
        bump updated_at. Unknown keys are ignored. Returns True when a row
        changed. Money (total_cents) is never editable here — use
        credit_world_plot."""
        safe = {k: v for k, v in fields.items() if k in self.WORLD_PLOT_EDITABLE_FIELDS}
        if not safe:
            return False
        sets = ", ".join(f"{k} = ?" for k in safe)
        with self.get_connection() as conn:
            cursor = conn.execute(
                f"UPDATE world_plots SET {sets}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (*safe.values(), plot_id),
            )
            return cursor.rowcount > 0

    def credit_world_plot(self, plot_id: int, amount_cents: int) -> bool:
        """Atomically add to a plot's stake via SQL increment (never
        read-modify-write). Returns True when the plot exists."""
        with self.get_connection() as conn:
            cursor = conn.execute(
                '''UPDATE world_plots
                   SET total_cents = total_cents + ?, updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?''', (amount_cents, plot_id))
            return cursor.rowcount > 0

    def delete_world_plot_if_unreferenced(self, plot_id: int) -> bool:
        """Delete a plot only when no payment and no promotion reference it.

        Exists for exactly one caller: webhook-redelivery cleanup of an orphan
        row that lost the insert_world_payment race — a row whose id was never
        returned to anyone. The guards make it a no-op on any plot that ever
        took money, so it can never destroy a paid listing."""
        with self.get_connection() as conn:
            cursor = conn.execute(
                '''DELETE FROM world_plots WHERE id = ?
                   AND NOT EXISTS (SELECT 1 FROM world_payments WHERE plot_id = ?)
                   AND NOT EXISTS (SELECT 1 FROM world_promotions WHERE plot_id = ?)''',
                (plot_id, plot_id, plot_id))
            return cursor.rowcount > 0

    def insert_world_payment(self, plot_id: int, user_id: int,
                             stripe_session_id: str, amount_cents: int) -> Dict:
        """Record a completed checkout. stripe_session_id UNIQUE is the
        idempotency key: a duplicate insert is reported as
        {'id': existing_id, 'already_processed': True} so webhook retries
        never double-credit."""
        with self.get_connection() as conn:
            cursor = conn.execute(
                '''INSERT OR IGNORE INTO world_payments
                   (plot_id, user_id, stripe_session_id, amount_cents)
                   VALUES (?, ?, ?, ?)''',
                (plot_id, user_id, stripe_session_id, amount_cents))
            if cursor.rowcount:
                return {"id": cursor.lastrowid, "already_processed": False}
            row = conn.execute(
                "SELECT id FROM world_payments WHERE stripe_session_id = ?",
                (stripe_session_id,)).fetchone()
            return {"id": row["id"] if row else None, "already_processed": True}

    def get_world_payment_by_session(self, stripe_session_id: str) -> Optional[Dict]:
        """Payment row for a Stripe checkout session id, or None (used by the
        post-checkout /claimed poll)."""
        with self.get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM world_payments WHERE stripe_session_id = ?",
                (stripe_session_id,)).fetchone()
            return dict(row) if row else None

    def get_world_country_board(self, kind: str, limit: int = 100) -> List[Dict]:
        """World-scope country leaderboard with joint ranks over the FULL set.

        kind: 'richest' (sum of stakes), 'planted' (plot count) or 'rising'
        (sum of payments in the trailing 24h; delta_cents carries the sum).
        Rows: rank, iso, name, flag_emoji, total_cents, plots_count,
        delta_cents (None unless rising), logo_url (always None — a country is
        not a company; the UI renders flag_emoji). Only active plots count, so
        virtual seeds can never appear."""
        if kind == "rising":
            sql = '''
                SELECT c.iso2 AS iso, c.name, c.flag_emoji,
                       agg.delta_cents, tot.total_cents, tot.plots_count,
                       NULL AS logo_url,
                       rank() OVER (ORDER BY agg.delta_cents DESC) AS rank
                FROM (SELECT p.country_iso, SUM(pay.amount_cents) AS delta_cents
                      FROM world_payments pay
                      JOIN world_plots p ON p.id = pay.plot_id
                      WHERE p.status = 'active'
                        AND pay.created_at >= datetime('now', '-1 day')
                      GROUP BY p.country_iso) agg
                JOIN world_countries c ON c.iso2 = agg.country_iso
                LEFT JOIN (SELECT country_iso, SUM(total_cents) AS total_cents,
                                  COUNT(*) AS plots_count
                           FROM world_plots WHERE status = 'active'
                           GROUP BY country_iso) tot
                       ON tot.country_iso = agg.country_iso
                ORDER BY rank, c.iso2 LIMIT ?'''
        else:
            metric = "agg.total_cents" if kind == "richest" else "agg.plots_count"
            sql = f'''
                SELECT c.iso2 AS iso, c.name, c.flag_emoji,
                       agg.total_cents, agg.plots_count, NULL AS delta_cents,
                       NULL AS logo_url,
                       rank() OVER (ORDER BY {metric} DESC) AS rank
                FROM (SELECT country_iso, SUM(total_cents) AS total_cents,
                             COUNT(*) AS plots_count
                      FROM world_plots WHERE status = 'active'
                      GROUP BY country_iso) agg
                JOIN world_countries c ON c.iso2 = agg.country_iso
                ORDER BY rank, c.iso2 LIMIT ?'''
        with self.get_connection() as conn:
            return [dict(r) for r in conn.execute(sql, (limit,)).fetchall()]

    def get_world_plot_board(self, kind: str, country_iso: Optional[str] = None,
                             city_id: Optional[int] = None,
                             limit: int = 100) -> List[Dict]:
        """Plot leaderboard, optionally scoped to a country or a city.

        kind: 'richest' (stake desc), 'planted' (earliest first) or 'rising'
        (payments in trailing 24h, delta_cents carries the sum). Joint ranks
        via rank() over the full filtered set. Rows: rank, plot_id, name, iso,
        total_cents, delta_cents (None unless rising), created_at, logo_url.

        logo_url is the plot's own logo, falling back to the linked company's
        small_logo_thumb_url (one LEFT JOIN, never a per-row lookup). Blank
        strings collapse to None so a missing logo stays honestly absent."""
        where, params = ["p.status = 'active'"], []
        if country_iso:
            where.append("p.country_iso = ?")
            params.append(country_iso.upper())
        if city_id is not None:
            where.append("p.city_id = ?")
            params.append(city_id)
        where_sql = " AND ".join(where)
        logo_sql = ("COALESCE(NULLIF(p.logo_url, ''), "
                    "NULLIF(co.small_logo_thumb_url, '')) AS logo_url")
        if kind == "rising":
            sql = f'''
                SELECT p.id AS plot_id, p.name, p.country_iso AS iso,
                       p.total_cents, agg.delta_cents, p.created_at,
                       {logo_sql},
                       rank() OVER (ORDER BY agg.delta_cents DESC) AS rank
                FROM (SELECT plot_id, SUM(amount_cents) AS delta_cents
                      FROM world_payments
                      WHERE created_at >= datetime('now', '-1 day')
                      GROUP BY plot_id) agg
                JOIN world_plots p ON p.id = agg.plot_id
                LEFT JOIN companies co ON co.id = p.company_id
                WHERE {where_sql}
                ORDER BY rank, p.id LIMIT ?'''
        elif kind == "planted":
            sql = f'''
                SELECT p.id AS plot_id, p.name, p.country_iso AS iso,
                       p.total_cents, NULL AS delta_cents, p.created_at,
                       {logo_sql},
                       rank() OVER (ORDER BY p.created_at ASC) AS rank
                FROM world_plots p
                LEFT JOIN companies co ON co.id = p.company_id
                WHERE {where_sql}
                ORDER BY rank, p.id LIMIT ?'''
        else:
            sql = f'''
                SELECT p.id AS plot_id, p.name, p.country_iso AS iso,
                       p.total_cents, NULL AS delta_cents, p.created_at,
                       {logo_sql},
                       rank() OVER (ORDER BY p.total_cents DESC) AS rank
                FROM world_plots p
                LEFT JOIN companies co ON co.id = p.company_id
                WHERE {where_sql}
                ORDER BY rank, p.id LIMIT ?'''
        with self.get_connection() as conn:
            return [dict(r) for r in conn.execute(sql, (*params, limit)).fetchall()]

    def get_world_founder_board(self, kind: str, limit: int = 100) -> List[Dict]:
        """Founder leaderboard over active plots that carry a founder_name.

        kind: 'staked' (stake desc) or 'pioneers' (earliest plant first).
        Rows: rank, founder_name, plot_id, name, total_cents, created_at,
        logo_url (plot logo, else the linked company's thumb, else None)."""
        order = "p.created_at ASC" if kind == "pioneers" else "p.total_cents DESC"
        with self.get_connection() as conn:
            rows = conn.execute(
                f'''SELECT rank() OVER (ORDER BY {order}) AS rank,
                           p.founder_name, p.id AS plot_id, p.name,
                           p.total_cents, p.created_at,
                           COALESCE(NULLIF(p.logo_url, ''),
                                    NULLIF(co.small_logo_thumb_url, '')) AS logo_url
                    FROM world_plots p
                    LEFT JOIN companies co ON co.id = p.company_id
                    WHERE p.status = 'active' AND p.founder_name IS NOT NULL
                      AND p.founder_name != ''
                    ORDER BY rank, p.id LIMIT ?''', (limit,)).fetchall()
            return [dict(r) for r in rows]

    def get_company_brief(self, company_id: int) -> Optional[Dict]:
        """The handful of company columns the World detail card renders.

        Returns slug, name, logo_url (small_logo_thumb_url, blank -> None),
        batch, one_liner, industry, team_size, is_hiring — or None when the id
        matches no row. Missing values stay None; nothing is invented."""
        if company_id is None:
            return None
        with self.get_connection() as conn:
            row = conn.execute(
                '''SELECT slug, name,
                          NULLIF(small_logo_thumb_url, '') AS logo_url,
                          batch, one_liner, industry, team_size, is_hiring
                   FROM companies WHERE id = ?''', (company_id,)).fetchone()
            if not row:
                return None
            brief = dict(row)
            brief["is_hiring"] = bool(brief.get("is_hiring"))
            brief["team_size"] = (int(brief["team_size"])
                                  if brief.get("team_size") is not None else None)
            return brief

    def get_world_country_stats(self, iso2: str) -> Optional[Dict]:
        """Country reference row + aggregates: total_cents, plots_count,
        rank_richest, rank_planted (joint ranks over all countries with
        active plots; None while the country has no plots)."""
        with self.get_connection() as conn:
            row = conn.execute(
                '''SELECT c.iso2, c.iso3, c.name, c.flag_emoji,
                          c.centroid_lat, c.centroid_lng,
                          ranked.total_cents, ranked.plots_count,
                          ranked.rank_richest, ranked.rank_planted
                   FROM world_countries c
                   LEFT JOIN (SELECT country_iso, total_cents, plots_count,
                                     rank() OVER (ORDER BY total_cents DESC) AS rank_richest,
                                     rank() OVER (ORDER BY plots_count DESC) AS rank_planted
                              FROM (SELECT country_iso,
                                           SUM(total_cents) AS total_cents,
                                           COUNT(*) AS plots_count
                                    FROM world_plots WHERE status = 'active'
                                    GROUP BY country_iso)) ranked
                          ON ranked.country_iso = c.iso2
                   WHERE c.iso2 = ?''', (iso2.upper(),)).fetchone()
            if not row:
                return None
            stats = dict(row)
            if stats["total_cents"] is None:
                stats["total_cents"] = 0
                stats["plots_count"] = 0
            return stats

    def get_world_country_cities(self, iso2: str, limit: int = 50) -> List[Dict]:
        """Cities of a country that have active plots, richest first:
        id, name, total_cents, plots_count, top_plot_id, top_plot_name,
        top_plot_total_cents."""
        with self.get_connection() as conn:
            rows = conn.execute(
                '''SELECT ci.id, ci.name, agg.total_cents, agg.plots_count,
                          top.plot_id AS top_plot_id, top.plot_name AS top_plot_name,
                          top.plot_total_cents AS top_plot_total_cents
                   FROM (SELECT city_id, SUM(total_cents) AS total_cents,
                                COUNT(*) AS plots_count
                         FROM world_plots
                         WHERE status = 'active' AND country_iso = ?
                           AND city_id IS NOT NULL
                         GROUP BY city_id) agg
                   JOIN world_cities ci ON ci.id = agg.city_id
                   LEFT JOIN (SELECT city_id, id AS plot_id, name AS plot_name,
                                     total_cents AS plot_total_cents
                              FROM (SELECT city_id, id, name, total_cents,
                                           row_number() OVER (PARTITION BY city_id
                                                              ORDER BY total_cents DESC, id) AS rn
                                    FROM world_plots
                                    WHERE status = 'active' AND country_iso = ?
                                      AND city_id IS NOT NULL)
                              WHERE rn = 1) top
                          ON top.city_id = ci.id
                   ORDER BY agg.total_cents DESC, ci.id LIMIT ?''',
                (iso2.upper(), iso2.upper(), limit)).fetchall()
            return [dict(r) for r in rows]

    def get_world_pulse(self, limit: int = 30) -> List[Dict]:
        """Recent activity feed, newest first. Rows: type ('plant' when the
        payment is the plot's first, 'topup' otherwise, or 'promotion'),
        name, country_iso, amount_cents, at."""
        with self.get_connection() as conn:
            rows = conn.execute(
                '''SELECT * FROM (
                       SELECT CASE WHEN pay.rn = 1 THEN 'plant' ELSE 'topup' END AS type,
                              p.name, p.country_iso, pay.amount_cents,
                              pay.created_at AS at
                       FROM (SELECT id, plot_id, amount_cents, created_at,
                                    row_number() OVER (PARTITION BY plot_id
                                                       ORDER BY created_at, id) AS rn
                             FROM world_payments) pay
                       JOIN world_plots p ON p.id = pay.plot_id
                       WHERE p.status = 'active'
                       UNION ALL
                       SELECT 'promotion' AS type,
                              COALESCE(pl.name, pr.label) AS name,
                              COALESCE(pr.country_iso, pl.country_iso) AS country_iso,
                              pr.amount_cents, pr.created_at AS at
                       FROM world_promotions pr
                       LEFT JOIN world_plots pl ON pl.id = pr.plot_id
                       WHERE pr.status = 'active' AND pr.kind = 'featured'
                   ) ORDER BY at DESC LIMIT ?''', (limit,)).fetchall()
            return [dict(r) for r in rows]

    def create_world_promotion(self, promo: Dict[str, Any]) -> Dict:
        """Insert a promotion. Required: kind ('featured'|'sponsor'), ends_at.
        Optional: plot_id, user_id, label, url, logo_url, country_iso
        (None = global), starts_at, amount_cents, stripe_session_id, status.
        stripe_session_id UNIQUE gives webhook idempotency: duplicates return
        {'id': existing_id, 'already_processed': True}."""
        with self.get_connection() as conn:
            cursor = conn.execute(
                '''INSERT OR IGNORE INTO world_promotions
                   (kind, plot_id, user_id, label, url, logo_url, country_iso,
                    starts_at, ends_at, amount_cents, stripe_session_id, status)
                   VALUES (?, ?, ?, ?, ?, ?, ?,
                           COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?)''',
                (promo["kind"], promo.get("plot_id"), promo.get("user_id"),
                 promo.get("label"), promo.get("url"), promo.get("logo_url"),
                 (promo.get("country_iso") or None) and promo["country_iso"].upper(),
                 self._world_ts(promo.get("starts_at")),
                 self._world_ts(promo["ends_at"]),
                 promo.get("amount_cents", 0), promo.get("stripe_session_id"),
                 promo.get("status", "active")))
            if cursor.rowcount:
                return {"id": cursor.lastrowid, "already_processed": False}
            row = conn.execute(
                "SELECT id FROM world_promotions WHERE stripe_session_id = ?",
                (promo.get("stripe_session_id"),)).fetchone()
            return {"id": row["id"] if row else None, "already_processed": True}

    def get_world_promotion(self, promo_id: int) -> Optional[Dict]:
        """Promotion row by id, or None."""
        with self.get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM world_promotions WHERE id = ?", (promo_id,)).fetchone()
            return dict(row) if row else None

    def get_world_promotion_by_session(self, stripe_session_id: str) -> Optional[Dict]:
        """Promotion row for a Stripe checkout session id, or None."""
        with self.get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM world_promotions WHERE stripe_session_id = ?",
                (stripe_session_id,)).fetchone()
            return dict(row) if row else None

    def get_active_world_promotions(self, country_iso: Optional[str] = None,
                                    include_global: bool = True) -> List[Dict]:
        """Currently-running promotions (status active, inside their window),
        joined with plot name/logo for featured ones. country_iso=None returns
        the global pool only; a country returns its pool, plus the global pool
        when include_global is True."""
        params: list = []
        if country_iso:
            scope = "(pr.country_iso = ?" + (" OR pr.country_iso IS NULL)" if include_global else ")")
            params.append(country_iso.upper())
        else:
            scope = "pr.country_iso IS NULL"
        with self.get_connection() as conn:
            rows = conn.execute(
                f'''SELECT pr.*, pl.name AS plot_name, pl.logo_url AS plot_logo_url
                    FROM world_promotions pr
                    LEFT JOIN world_plots pl ON pl.id = pr.plot_id
                    WHERE pr.status = 'active'
                      AND pr.starts_at <= datetime('now')
                      AND pr.ends_at > datetime('now')
                      AND {scope}
                    ORDER BY pr.ends_at ASC''', params).fetchall()
            return [dict(r) for r in rows]

    def count_active_featured(self, country_iso: Optional[str]) -> int:
        """How many 'featured' promotions are currently active in a country's
        pool (None = the global pool, which counts separately). Used to
        enforce MAX_ACTIVE_FEATURED_PER_COUNTRY at checkout time."""
        iso = country_iso.upper() if country_iso else None
        with self.get_connection() as conn:
            row = conn.execute(
                '''SELECT COUNT(*) FROM world_promotions
                   WHERE kind = 'featured' AND status = 'active'
                     AND ends_at > datetime('now')
                     AND ((country_iso IS NULL AND ? IS NULL) OR country_iso = ?)''',
                (iso, iso)).fetchone()
            return row[0]

    def expire_world_promotions(self) -> int:
        """Hygiene: flip status to 'expired' on active promotions whose window
        has passed (queries already filter on ends_at). Returns rows changed."""
        with self.get_connection() as conn:
            cursor = conn.execute(
                '''UPDATE world_promotions SET status = 'expired'
                   WHERE status = 'active' AND ends_at <= datetime('now')''')
            return cursor.rowcount

    def revoke_world_promotion(self, promo_id: int) -> bool:
        """Admin removal: set status 'revoked'. Returns True when a row changed."""
        with self.get_connection() as conn:
            cursor = conn.execute(
                "UPDATE world_promotions SET status = 'revoked' WHERE id = ?",
                (promo_id,))
            return cursor.rowcount > 0

    def get_world_plots_for_user(self, user_id: int) -> List[Dict]:
        """All plots owned by a user (any status), newest first, with
        country_name and city_name attached."""
        with self.get_connection() as conn:
            rows = conn.execute(
                '''SELECT p.*, wc.name AS country_name, ci.name AS city_name
                   FROM world_plots p
                   JOIN world_countries wc ON wc.iso2 = p.country_iso
                   LEFT JOIN world_cities ci ON ci.id = p.city_id
                   WHERE p.user_id = ?
                   ORDER BY p.created_at DESC, p.id DESC''', (user_id,)).fetchall()
            return [dict(r) for r in rows]

    def get_world_promotions_for_user(self, user_id: int) -> List[Dict]:
        """A user's promotions (any status), newest first, with plot names."""
        with self.get_connection() as conn:
            rows = conn.execute(
                '''SELECT pr.*, pl.name AS plot_name
                   FROM world_promotions pr
                   LEFT JOIN world_plots pl ON pl.id = pr.plot_id
                   WHERE pr.user_id = ?
                   ORDER BY pr.created_at DESC, pr.id DESC''', (user_id,)).fetchall()
            return [dict(r) for r in rows]
