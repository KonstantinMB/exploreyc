"""
PostgreSQL database adapter for YC Company Scraper (Supabase)
Uses DATABASE_URL environment variable (Supabase connection string)
"""

import os
import json
from typing import List, Dict, Optional, Any
from contextlib import contextmanager

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor, execute_values
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False
    execute_values = None


class DatabasePostgres:
    """PostgreSQL database for YC companies (Supabase)"""

    def __init__(self):
        self.database_url = os.environ.get("DATABASE_URL")
        if not self.database_url:
            raise ValueError("DATABASE_URL environment variable is required for PostgreSQL")
        if not HAS_PSYCOPG2:
            raise ImportError("psycopg2-binary is required. Install with: pip install psycopg2-binary")
        self._ensure_tables()

    @contextmanager
    def get_connection(self):
        conn = psycopg2.connect(self.database_url)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _ensure_tables(self):
        """Tables should be created via Supabase migration - this is a no-op for production"""
        pass

    def _row_to_dict(self, row) -> Dict:
        if hasattr(row, "keys"):
            return dict(row)
        return dict(zip([c[0] for c in row.cursor_description], row))

    def insert_company(self, company: Dict[str, Any]) -> int:
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO companies
                    (id, source, source_id, name, slug, website, one_liner, long_description, team_size,
                     batch, status, industry, subindustry, all_locations, is_hiring,
                     top_company, nonprofit, stage, small_logo_thumb_url, tags, regions,
                     industries, latitude, longitude, country,
                     founders, year_founded, exit_type, acquirer, ticker_symbol, funded_date, source_url,
                     dedupe_key, raw_json, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        source = EXCLUDED.source,
                        source_id = EXCLUDED.source_id,
                        name = EXCLUDED.name,
                        slug = EXCLUDED.slug,
                        website = EXCLUDED.website,
                        one_liner = EXCLUDED.one_liner,
                        long_description = EXCLUDED.long_description,
                        team_size = EXCLUDED.team_size,
                        batch = EXCLUDED.batch,
                        status = EXCLUDED.status,
                        industry = EXCLUDED.industry,
                        subindustry = EXCLUDED.subindustry,
                        all_locations = EXCLUDED.all_locations,
                        is_hiring = EXCLUDED.is_hiring,
                        top_company = EXCLUDED.top_company,
                        nonprofit = EXCLUDED.nonprofit,
                        stage = EXCLUDED.stage,
                        small_logo_thumb_url = EXCLUDED.small_logo_thumb_url,
                        tags = EXCLUDED.tags,
                        regions = EXCLUDED.regions,
                        industries = EXCLUDED.industries,
                        latitude = EXCLUDED.latitude,
                        longitude = EXCLUDED.longitude,
                        country = EXCLUDED.country,
                        founders = EXCLUDED.founders,
                        year_founded = EXCLUDED.year_founded,
                        exit_type = EXCLUDED.exit_type,
                        acquirer = EXCLUDED.acquirer,
                        ticker_symbol = EXCLUDED.ticker_symbol,
                        funded_date = EXCLUDED.funded_date,
                        source_url = EXCLUDED.source_url,
                        dedupe_key = COALESCE(EXCLUDED.dedupe_key, companies.dedupe_key),
                        raw_json = EXCLUDED.raw_json,
                        updated_at = NOW()
                """, (
                    company.get("id"),
                    company.get("source", "yc"),
                    company.get("source_id") if company.get("source_id") is not None else str(company.get("id")),
                    company.get("name"),
                    company.get("slug"),
                    company.get("website"),
                    company.get("one_liner"),
                    company.get("long_description"),
                    company.get("team_size"),
                    company.get("batch"),
                    company.get("status"),
                    company.get("industry"),
                    company.get("subindustry"),
                    company.get("all_locations"),
                    company.get("isHiring"),
                    company.get("top_company"),
                    company.get("nonprofit"),
                    company.get("stage"),
                    company.get("small_logo_thumb_url"),
                    json.dumps(company.get("tags", [])),
                    json.dumps(company.get("regions", [])),
                    json.dumps(company.get("industries", [])),
                    company.get("latitude"),
                    company.get("longitude"),
                    company.get("country"),
                    company.get("founders"),
                    company.get("year_founded"),
                    company.get("exit_type"),
                    company.get("acquirer"),
                    company.get("ticker_symbol"),
                    company.get("funded_date"),
                    company.get("source_url"),
                    company.get("dedupe_key"),
                    json.dumps(company) if company else None,
                ))
                return cur.rowcount

    def bulk_insert_companies(self, companies: List[Dict[str, Any]], batch_size: int = 500) -> int:
        """Bulk insert companies (upsert). Use for migration/seeding. Returns count inserted."""
        if not companies:
            return 0
        if not execute_values:
            raise ImportError("psycopg2.extras.execute_values required for bulk insert")

        def _row(company: Dict) -> tuple:
            def _json(val):
                if val is None:
                    return "[]"
                if isinstance(val, str):
                    return val
                return json.dumps(val)

            def _bool(val):
                if val is None:
                    return False
                return bool(val) if not isinstance(val, bool) else val

            is_hiring = company.get("is_hiring") if company.get("is_hiring") is not None else company.get("isHiring")
            return (
                company.get("id"),
                company.get("source", "yc"),
                company.get("source_id") if company.get("source_id") is not None else str(company.get("id")),
                company.get("name"),
                company.get("slug"),
                company.get("website"),
                company.get("one_liner"),
                company.get("long_description"),
                company.get("team_size"),
                company.get("batch"),
                company.get("status"),
                company.get("industry"),
                company.get("subindustry"),
                company.get("all_locations"),
                _bool(is_hiring),
                _bool(company.get("top_company")),
                _bool(company.get("nonprofit")),
                company.get("stage"),
                company.get("small_logo_thumb_url"),
                _json(company.get("tags")),
                _json(company.get("regions")),
                _json(company.get("industries")),
                company.get("latitude"),
                company.get("longitude"),
                company.get("country"),
                company.get("founders"),
                company.get("year_founded"),
                company.get("exit_type"),
                company.get("acquirer"),
                company.get("ticker_symbol"),
                company.get("funded_date"),
                company.get("source_url"),
                company.get("dedupe_key"),
                json.dumps(company) if company else None,
            )

        total = 0
        cols = "(id, source, source_id, name, slug, website, one_liner, long_description, team_size, batch, status, industry, subindustry, all_locations, is_hiring, top_company, nonprofit, stage, small_logo_thumb_url, tags, regions, industries, latitude, longitude, country, founders, year_founded, exit_type, acquirer, ticker_symbol, funded_date, source_url, dedupe_key, raw_json)"
        upsert_sql = f"""
            INSERT INTO companies {cols}
            VALUES %s
            ON CONFLICT (id) DO UPDATE SET
                source = EXCLUDED.source, source_id = EXCLUDED.source_id,
                name = EXCLUDED.name, slug = EXCLUDED.slug, website = EXCLUDED.website,
                one_liner = EXCLUDED.one_liner, long_description = EXCLUDED.long_description,
                team_size = EXCLUDED.team_size, batch = EXCLUDED.batch, status = EXCLUDED.status,
                industry = EXCLUDED.industry, subindustry = EXCLUDED.subindustry,
                all_locations = EXCLUDED.all_locations, is_hiring = EXCLUDED.is_hiring,
                top_company = EXCLUDED.top_company, nonprofit = EXCLUDED.nonprofit,
                stage = EXCLUDED.stage, small_logo_thumb_url = EXCLUDED.small_logo_thumb_url,
                tags = EXCLUDED.tags, regions = EXCLUDED.regions, industries = EXCLUDED.industries,
                latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, country = EXCLUDED.country,
                founders = EXCLUDED.founders, year_founded = EXCLUDED.year_founded,
                exit_type = EXCLUDED.exit_type, acquirer = EXCLUDED.acquirer,
                ticker_symbol = EXCLUDED.ticker_symbol, funded_date = EXCLUDED.funded_date,
                source_url = EXCLUDED.source_url,
                dedupe_key = COALESCE(EXCLUDED.dedupe_key, companies.dedupe_key),
                raw_json = EXCLUDED.raw_json, updated_at = NOW()
        """
        rows = [_row(c) for c in companies]
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                execute_values(cur, upsert_sql, rows, page_size=batch_size)
                total = cur.rowcount
        return total

    # ========== MULTI-SOURCE SYNC: cursor + dedupe_key ==========

    def get_sync_cursor(self, source: str) -> Optional[str]:
        """Return the stored incremental cursor for a source (None if never run)."""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT last_cursor FROM sync_state WHERE source = %s", (source,))
                row = cur.fetchone()
                return row[0] if row else None

    def save_sync_state(self, source: str, cursor_value: Optional[str], status: str,
                        records_upserted: int, error: Optional[str] = None) -> None:
        """Upsert the per-source sync bookkeeping row."""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO sync_state
                    (source, last_run_at, last_cursor, last_status, records_upserted, error, updated_at)
                    VALUES (%s, NOW(), %s, %s, %s, %s, NOW())
                    ON CONFLICT (source) DO UPDATE SET
                        last_run_at = NOW(), last_cursor = EXCLUDED.last_cursor,
                        last_status = EXCLUDED.last_status,
                        records_upserted = EXCLUDED.records_upserted,
                        error = EXCLUDED.error, updated_at = NOW()
                    """,
                    (source, cursor_value, status, records_upserted, error),
                )
                conn.commit()

    def set_dedupe_key(self, company_id: int, key: str) -> None:
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE companies SET dedupe_key = %s WHERE id = %s", (key, company_id)
                )
                conn.commit()

    def backfill_dedupe_keys(self) -> int:
        """Populate dedupe_key for any rows missing one, using the shared normalizer."""
        from ingestion.normalize import norm_domain, dedupe_key
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT id, source, slug, website FROM companies WHERE dedupe_key IS NULL"
                )
                rows = cur.fetchall()
            with conn.cursor() as cur:
                for r in rows:
                    key = dedupe_key(
                        norm_domain(r["website"]), r["source"] or "yc",
                        r["slug"] or str(r["id"]),
                    )
                    cur.execute(
                        "UPDATE companies SET dedupe_key = %s WHERE id = %s", (key, r["id"])
                    )
            conn.commit()
        return len(rows)

    def delete_source_companies_with_batch(self, sources=("hackernews", "producthunt")) -> int:
        """Delete rows from the given non-YC sources that carry a YC batch (e.g. a
        Launch HN advertising '(YC W26)'). A batch means the company is a YC company
        that already exists as the canonical source='yc' row, so the duplicate is
        removed. Never touches source='yc'. Safe to run repeatedly / on a schedule."""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM companies "
                    "WHERE source = ANY(%s) AND source <> 'yc' "
                    "AND batch IS NOT NULL AND batch <> ''",
                    (list(sources),),
                )
                n = cur.rowcount
            conn.commit()
        return n

    def get_companies(
        self,
        limit: int = 100,
        offset: int = 0,
        batch: Optional[str] = None,
        is_hiring: Optional[bool] = None,
        industry: Optional[str] = None,
        country: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[Dict]:
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = "SELECT * FROM companies WHERE 1=1"
                params = []
                if batch:
                    query += " AND batch = %s"
                    params.append(batch)
                if is_hiring is not None:
                    query += " AND is_hiring = %s"
                    params.append(is_hiring)
                if industry:
                    query += " AND industry = %s"
                    params.append(industry)
                if country:
                    query += " AND country = %s"
                    params.append(country)
                if search:
                    query += " AND (name ILIKE %s OR one_liner ILIKE %s OR long_description ILIKE %s)"
                    search_term = f"%{search}%"
                    params.extend([search_term, search_term, search_term])
                query += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
                params.extend([limit, offset])
                cur.execute(query, params)
                return [dict(row) for row in cur.fetchall()]

    def get_company_by_id(self, company_id: int) -> Optional[Dict]:
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM companies WHERE id = %s", (company_id,))
                row = cur.fetchone()
                return dict(row) if row else None

    def get_company_by_slug(self, slug: str) -> Optional[Dict]:
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM companies WHERE slug = %s", (slug,))
                row = cur.fetchone()
                return dict(row) if row else None

    def count_companies(
        self,
        batch: Optional[str] = None,
        is_hiring: Optional[bool] = None,
        industry: Optional[str] = None,
        country: Optional[str] = None,
        search: Optional[str] = None,
    ) -> int:
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                query = "SELECT COUNT(*) FROM companies WHERE 1=1"
                params = []
                if batch:
                    query += " AND batch = %s"
                    params.append(batch)
                if is_hiring is not None:
                    query += " AND is_hiring = %s"
                    params.append(is_hiring)
                if industry:
                    query += " AND industry = %s"
                    params.append(industry)
                if country:
                    query += " AND country = %s"
                    params.append(country)
                if search:
                    query += " AND (name ILIKE %s OR one_liner ILIKE %s OR long_description ILIKE %s)"
                    search_term = f"%{search}%"
                    params.extend([search_term, search_term, search_term])
                cur.execute(query, params)
                return cur.fetchone()[0]

    def get_stats(self) -> Dict:
        """Single-query stats for fast initial load"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                # One query for totals
                cur.execute("""
                    SELECT
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE is_hiring = TRUE) as hiring
                    FROM companies
                """)
                row = cur.fetchone()
                total = row[0]
                hiring = row[1]
                # Batch counts
                cur.execute(
                    "SELECT batch, COUNT(*) as count FROM companies GROUP BY batch ORDER BY count DESC"
                )
                by_batch = dict(cur.fetchall())
                # Industry (top 10)
                cur.execute(
                    "SELECT industry, COUNT(*) as count FROM companies WHERE industry IS NOT NULL GROUP BY industry ORDER BY count DESC LIMIT 10"
                )
                by_industry = dict(cur.fetchall())
                # Country (top 10)
                cur.execute(
                    "SELECT country, COUNT(*) as count FROM companies WHERE country IS NOT NULL GROUP BY country ORDER BY count DESC LIMIT 10"
                )
                by_country = dict(cur.fetchall())
                # Status
                cur.execute("SELECT status, COUNT(*) as count FROM companies GROUP BY status")
                by_status = dict(cur.fetchall())
                return {
                    "total_companies": total,
                    "hiring": hiring,
                    "by_batch": by_batch,
                    "by_industry": by_industry,
                    "by_country": by_country,
                    "by_status": by_status,
                }

    def get_recent_batch_names(self, n: int = 4) -> List[str]:
        """Get N most recent batch names (for limiting initial map payload)"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT DISTINCT batch FROM companies
                    WHERE batch IS NOT NULL
                    ORDER BY batch DESC
                    LIMIT %s
                    """,
                    (n,),
                )
                return [row[0] for row in cur.fetchall()]

    def get_total_map_companies(self) -> int:
        """Count of companies with geo coordinates (for 'Show all' button)"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM companies WHERE latitude IS NOT NULL AND longitude IS NOT NULL"
                )
                return cur.fetchone()[0]

    def get_companies_for_map(
        self,
        batch: Optional[str] = None,
        is_hiring: Optional[bool] = None,
        recent_batches: Optional[int] = None,
    ) -> List[Dict]:
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = """
                    SELECT id, name, slug, website, one_liner, batch, is_hiring,
                           top_company, small_logo_thumb_url,
                           latitude, longitude, country, all_locations
                    FROM companies
                    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
                """
                params: List[Any] = []
                if batch:
                    query += " AND batch = %s"
                    params.append(batch)
                if is_hiring is not None:
                    query += " AND is_hiring = %s"
                    params.append(is_hiring)
                if recent_batches is not None and recent_batches > 0:
                    query += """
                        AND batch IN (
                            SELECT batch FROM (
                                SELECT DISTINCT batch FROM companies
                                WHERE batch IS NOT NULL
                                ORDER BY batch DESC
                                LIMIT %s
                            ) recent
                        )
                    """
                    params.append(recent_batches)
                cur.execute(query, params)
                return [dict(row) for row in cur.fetchall()]

    def create_scrape_job(self, filters: Dict) -> int:
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO scrape_jobs (status, filters) VALUES (%s, %s) RETURNING id",
                    ("pending", json.dumps(filters)),
                )
                return cur.fetchone()[0]

    def update_scrape_job(
        self,
        job_id: int,
        status: str,
        total_scraped: int,
        current_page: int,
        error: Optional[str] = None,
    ):
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE scrape_jobs
                    SET status = %s, total_scraped = %s, current_page = %s, error = %s, updated_at = NOW()
                    WHERE id = %s
                    """,
                    (status, total_scraped, current_page, error, job_id),
                )

    def get_scrape_job(self, job_id: int) -> Optional[Dict]:
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM scrape_jobs WHERE id = %s", (job_id,))
                row = cur.fetchone()
                return dict(row) if row else None

    def get_unique_batches(self) -> List[str]:
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT DISTINCT batch FROM companies WHERE batch IS NOT NULL ORDER BY batch DESC"
                )
                return [row[0] for row in cur.fetchall()]

    def get_unique_industries(self) -> List[str]:
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT DISTINCT industry FROM companies WHERE industry IS NOT NULL ORDER BY industry"
                )
                return [row[0] for row in cur.fetchall()]

    def get_unique_countries(self) -> List[str]:
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT DISTINCT country FROM companies WHERE country IS NOT NULL ORDER BY country"
                )
                return [row[0] for row in cur.fetchall()]

    def get_all_companies(self) -> List[Dict]:
        """Get all companies for snapshot creation"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, batch, is_hiring, team_size, status, industry
                    FROM companies
                """)
                return [dict(row) for row in cur.fetchall()]

    def get_all_companies_full(self) -> List[Dict]:
        """Get all companies with full columns for in-memory cache hydration."""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM companies")
                return [dict(row) for row in cur.fetchall()]

    # ============================================================================
    # EMAIL SUBSCRIPTION METHODS
    # ============================================================================

    def create_subscription(
        self, email: str, verification_token: str, unsubscribe_token: str, preferences: Dict = None
    ) -> int:
        """Create a new email subscription"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO email_subscriptions (email, verification_token, unsubscribe_token, preferences)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (email) DO UPDATE SET
                        verification_token = EXCLUDED.verification_token,
                        is_active = FALSE,
                        verified_at = NULL,
                        updated_at = NOW()
                    RETURNING id
                    """,
                    (email, verification_token, unsubscribe_token, json.dumps(preferences or {})),
                )
                return cur.fetchone()[0]

    def verify_email(self, verification_token: str) -> bool:
        """Verify an email subscription"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE email_subscriptions
                    SET verified_at = NOW(), is_active = TRUE, verification_token = NULL
                    WHERE verification_token = %s AND verified_at IS NULL
                    RETURNING id
                    """,
                    (verification_token,),
                )
                return cur.fetchone() is not None

    def unsubscribe(self, unsubscribe_token: str) -> bool:
        """Unsubscribe using token"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE email_subscriptions SET is_active = FALSE WHERE unsubscribe_token = %s RETURNING id",
                    (unsubscribe_token,),
                )
                return cur.fetchone() is not None

    def get_subscription(self, email: str) -> Optional[Dict]:
        """Get subscription by email"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM email_subscriptions WHERE email = %s", (email,))
                row = cur.fetchone()
                return dict(row) if row else None

    def get_subscription_by_verification_token(self, token: str) -> Optional[Dict]:
        """Get subscription by verification token (before verify clears it)"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM email_subscriptions WHERE verification_token = %s AND verified_at IS NULL",
                    (token,),
                )
                row = cur.fetchone()
                return dict(row) if row else None

    def get_active_subscriptions(self) -> List[Dict]:
        """Get all active and verified subscriptions"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT * FROM email_subscriptions
                    WHERE is_active = TRUE AND verified_at IS NOT NULL
                    ORDER BY created_at DESC
                    """
                )
                return [dict(row) for row in cur.fetchall()]

    def update_subscription_preferences(self, email: str, preferences: Dict) -> bool:
        """Update subscription preferences"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE email_subscriptions SET preferences = %s WHERE email = %s RETURNING id",
                    (json.dumps(preferences), email),
                )
                return cur.fetchone() is not None

    # ============================================================================
    # COMPANY SNAPSHOT METHODS
    # ============================================================================

    def create_snapshot(self, snapshot_date: str, companies: List[Dict]) -> int:
        """Create a daily snapshot of all companies"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                # Batch insert snapshots (companies from get_all_companies use is_hiring)
                values = [
                    (
                        snapshot_date,
                        c.get("id"),
                        c.get("batch"),
                        c.get("is_hiring") or c.get("isHiring", False),
                        c.get("team_size"),
                        c.get("status"),
                        c.get("industry"),
                    )
                    for c in companies
                ]

                cur.executemany(
                    """
                    INSERT INTO company_snapshots
                    (snapshot_date, company_id, batch, is_hiring, team_size, status, industry)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (snapshot_date, company_id) DO UPDATE SET
                        batch = EXCLUDED.batch,
                        is_hiring = EXCLUDED.is_hiring,
                        team_size = EXCLUDED.team_size,
                        status = EXCLUDED.status,
                        industry = EXCLUDED.industry
                    """,
                    values,
                )
                return len(values)

    def get_snapshot(self, snapshot_date: str) -> Dict[int, Dict]:
        """Get all companies for a specific snapshot date"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM company_snapshots WHERE snapshot_date = %s", (snapshot_date,)
                )
                rows = cur.fetchall()
                return {row["company_id"]: dict(row) for row in rows}

    def get_latest_snapshot_date(self) -> Optional[str]:
        """Get the date of the most recent snapshot"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT MAX(snapshot_date) FROM company_snapshots")
                result = cur.fetchone()
                return result[0] if result and result[0] else None

    def snapshot_exists(self, snapshot_date: str) -> bool:
        """Check if a snapshot exists for the given date (has at least one row)"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM company_snapshots WHERE snapshot_date = %s LIMIT 1",
                    (snapshot_date,),
                )
                return cur.fetchone() is not None

    def compare_snapshots(self, old_date: str, new_date: str) -> Dict:
        """Compare two snapshots and find differences"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Find new companies (in new snapshot but not in old)
                cur.execute(
                    """
                    SELECT c.*, s_new.* FROM companies c
                    JOIN company_snapshots s_new ON c.id = s_new.company_id
                    LEFT JOIN company_snapshots s_old ON c.id = s_old.company_id AND s_old.snapshot_date = %s
                    WHERE s_new.snapshot_date = %s AND s_old.company_id IS NULL
                    """,
                    (old_date, new_date),
                )
                new_companies = [dict(row) for row in cur.fetchall()]

                # Find companies that started hiring
                cur.execute(
                    """
                    SELECT c.*, s_new.* FROM companies c
                    JOIN company_snapshots s_new ON c.id = s_new.company_id
                    JOIN company_snapshots s_old ON c.id = s_old.company_id AND s_old.snapshot_date = %s
                    WHERE s_new.snapshot_date = %s
                    AND s_new.is_hiring = TRUE AND s_old.is_hiring = FALSE
                    """,
                    (old_date, new_date),
                )
                newly_hiring = [dict(row) for row in cur.fetchall()]

                # Find batch changes
                cur.execute(
                    """
                    SELECT c.*, s_new.batch as new_batch, s_old.batch as old_batch FROM companies c
                    JOIN company_snapshots s_new ON c.id = s_new.company_id
                    JOIN company_snapshots s_old ON c.id = s_old.company_id AND s_old.snapshot_date = %s
                    WHERE s_new.snapshot_date = %s
                    AND s_new.batch != s_old.batch
                    """,
                    (old_date, new_date),
                )
                batch_changes = [dict(row) for row in cur.fetchall()]

                return {
                    "new_companies": new_companies,
                    "newly_hiring": newly_hiring,
                    "batch_changes": batch_changes,
                }

    def cleanup_old_snapshots(self, days_to_keep: int = 90):
        """Delete snapshots older than specified days"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM company_snapshots WHERE snapshot_date < NOW() - INTERVAL '%s days'",
                    (days_to_keep,),
                )
                return cur.rowcount

    # ============================================================================
    # ROADMAP VOTING METHODS
    # ============================================================================

    def add_vote(self, feature_id: str, user_identifier: str) -> bool:
        """Add a vote for a feature"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                try:
                    cur.execute(
                        "INSERT INTO roadmap_votes (feature_id, user_identifier) VALUES (%s, %s)",
                        (feature_id, user_identifier),
                    )
                    # Refresh materialized view
                    cur.execute("SELECT refresh_vote_counts()")
                    return True
                except psycopg2.errors.UniqueViolation:
                    # Already voted
                    return False

    def remove_vote(self, feature_id: str, user_identifier: str) -> bool:
        """Remove a vote for a feature"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM roadmap_votes WHERE feature_id = %s AND user_identifier = %s RETURNING id",
                    (feature_id, user_identifier),
                )
                result = cur.fetchone()
                if result:
                    # Refresh materialized view
                    cur.execute("SELECT refresh_vote_counts()")
                    return True
                return False

    def get_vote_counts(self) -> Dict[str, int]:
        """Get vote counts for all features"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT feature_id, vote_count FROM roadmap_vote_counts")
                return {row[0]: row[1] for row in cur.fetchall()}

    def get_user_votes(self, user_identifier: str) -> List[str]:
        """Get list of feature IDs the user has voted for"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT feature_id FROM roadmap_votes WHERE user_identifier = %s",
                    (user_identifier,),
                )
                return [row[0] for row in cur.fetchall()]

    def has_voted(self, feature_id: str, user_identifier: str) -> bool:
        """Check if user has voted for a feature"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM roadmap_votes WHERE feature_id = %s AND user_identifier = %s",
                    (feature_id, user_identifier),
                )
                return cur.fetchone() is not None

    # ========== FEATURE INTEREST METHODS ==========

    def record_feature_interest(self, feature: str, user_identifier: Optional[str] = None,
                                email: Optional[str] = None) -> Dict:
        """Record interest in a currently-unavailable feature.

        Deduped per (feature, user_identifier). Returns {"created": bool, "count": int}.
        The CREATE TABLE is defensive so the endpoint works even if the Supabase
        migration hasn't been applied yet (idempotent, cheap).
        """
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS feature_requests (
                        id BIGSERIAL PRIMARY KEY,
                        feature TEXT NOT NULL,
                        user_identifier TEXT,
                        email TEXT,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        UNIQUE (feature, user_identifier)
                    )
                    """
                )
                cur.execute(
                    """
                    INSERT INTO feature_requests (feature, user_identifier, email)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (feature, user_identifier)
                    DO UPDATE SET email = COALESCE(EXCLUDED.email, feature_requests.email)
                    RETURNING (xmax = 0) AS inserted
                    """,
                    (feature, user_identifier, email),
                )
                row = cur.fetchone()
                created = bool(row[0]) if row else False
                cur.execute(
                    "SELECT COUNT(*) FROM feature_requests WHERE feature = %s", (feature,)
                )
                count = cur.fetchone()[0]
                return {"created": created, "count": count}

    def get_feature_interest_count(self, feature: str) -> int:
        """Return the number of distinct interest registrations for a feature."""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM feature_requests WHERE feature = %s", (feature,)
                )
                return cur.fetchone()[0] or 0

    # ========== STARTUP IDEA VALIDATOR METHODS ==========

    def get_yc_company_count(self) -> int:
        """Return total number of source='yc' companies (denominator for market_size_percentage)."""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM companies WHERE source = 'yc'")
                return cur.fetchone()[0]

    def count_companies_with_embeddings(self) -> int:
        """Return number of companies that have embeddings (for validator setup check)"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM companies WHERE embedding IS NOT NULL"
                )
                return cur.fetchone()[0] or 0

    def get_companies_without_embeddings(self, limit: int = 100) -> List[Dict]:
        """
        Get companies that don't have embeddings yet

        Args:
            limit: Maximum number of companies to return

        Returns:
            List of company dictionaries with id, name, one_liner, long_description
        """
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, name, one_liner, long_description
                    FROM companies
                    WHERE embedding IS NULL
                        AND (one_liner IS NOT NULL OR long_description IS NOT NULL)
                    ORDER BY id DESC
                    LIMIT %s
                """, (limit,))
                return [dict(row) for row in cur.fetchall()]

    @staticmethod
    def build_company_embedding_text(company: dict) -> str:
        """Assemble the document text that gets embedded for a company.

        Order matters less than coverage: include every field that carries
        semantic signal about *what the company does*. The result MUST be run
        through get_search_text_for_embedding() by the caller before embedding,
        exactly like the user's query, to preserve query/document symmetry.
        """
        def _join(v):
            if isinstance(v, (list, tuple)):
                return " ".join(str(x) for x in v if x)
            return str(v) if v else ""
        parts = [
            company.get("name") or "",
            company.get("one_liner") or "",
            company.get("long_description") or "",
            company.get("industry") or "",
            company.get("subindustry") or "",
            _join(company.get("tags")),
            _join(company.get("industries")),
        ]
        return " ".join(p for p in (s.strip() for s in parts) if p)

    def get_companies_for_embedding(self, only_missing: bool = True, limit: int = 10000) -> List[Dict]:
        """Return companies for (re-)embedding.

        Args:
            only_missing: When True, returns only rows where embedding IS NULL.
                          When False, returns all source='yc' rows.
            limit: Maximum number of rows to return.

        Returns:
            List of dicts with id, name, one_liner, long_description,
            industry, subindustry, tags, industries.

        Covers ALL sources (not just YC) so vector search spans the full corpus.
        """
        where = "WHERE embedding IS NULL" if only_missing else "WHERE TRUE"
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    f"""
                    SELECT id, name, one_liner, long_description,
                           industry, subindustry, tags, industries
                    FROM companies
                    {where}
                    ORDER BY id DESC
                    LIMIT %s
                    """,
                    (limit,),
                )
                return [dict(r) for r in cur.fetchall()]

    def update_company_embedding(self, company_id: int, embedding: List[float]) -> bool:
        """
        Update the embedding vector for a company

        Args:
            company_id: Company ID
            embedding: Embedding vector (1536 dimensions)

        Returns:
            True if successful, False otherwise
        """
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    # Convert Python list to PostgreSQL vector format
                    embedding_str = '[' + ','.join(map(str, embedding)) + ']'

                    cur.execute("""
                        UPDATE companies
                        SET embedding = %s::vector
                        WHERE id = %s
                    """, (embedding_str, company_id))

                    conn.commit()
                    return True
        except Exception as e:
            logger.error(f"Failed to update embedding for company {company_id}: {e}")
            return False

    def update_company_embeddings_batch(self, pairs) -> int:
        if not pairs:
            return 0
        rows = [("[" + ",".join(map(str, emb)) + "]", cid) for cid, emb in pairs]
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.executemany(
                    "UPDATE companies SET embedding = %s::vector WHERE id = %s", rows
                )
            conn.commit()
        return len(rows)

    def find_similar_companies_by_embedding(
        self,
        embedding: List[float],
        limit: int = 10,
        min_similarity: float = 0.5,
        source_filter: Optional[str] = None,
    ) -> List[Dict]:
        """
        Find companies similar to the given embedding vector using cosine similarity.

        Args:
            embedding: The embedding vector (1536 dimensions)
            limit: Maximum number of results to return
            min_similarity: Minimum similarity score (0-1, where 1 is identical)
            source_filter:
                - a source key (e.g. 'yc') -> restrict to that source. The hero
                  idea-validator passes 'yc' so its market-size % / "N YC companies
                  overlap" verdict stays YC-scoped and unchanged.
                - None -> search ALL sources, deduped by dedupe_key so a company
                  present in several sources appears once (all-source semantic search).

        Returns:
            List of companies with similarity scores, ordered by similarity (highest first)
        """
        cols = ("id, name, slug, website, one_liner, long_description, "
                "industry, subindustry, tags, industries, batch, is_hiring, "
                "team_size, all_locations, country, small_logo_thumb_url, source, dedupe_key")
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Convert Python list to PostgreSQL vector format
                embedding_str = '[' + ','.join(map(str, embedding)) + ']'

                # Raise HNSW index recall (no-op for IVFFlat indexes)
                cur.execute("SET LOCAL hnsw.ef_search = 60")

                # <=> is the cosine distance operator in pgvector; 1 - dist = similarity
                if source_filter:
                    cur.execute(f"""
                        SELECT {cols},
                            (1 - (embedding <=> %s::vector)) AS similarity_score
                        FROM companies
                        WHERE embedding IS NOT NULL
                            AND source = %s
                            AND (1 - (embedding <=> %s::vector)) >= %s
                        ORDER BY embedding <=> %s::vector
                        LIMIT %s
                    """, (embedding_str, source_filter, embedding_str, min_similarity,
                          embedding_str, limit))
                else:
                    # All sources: keep one row per company (dedupe by domain), then rank.
                    cur.execute(f"""
                        SELECT * FROM (
                            SELECT DISTINCT ON (COALESCE(dedupe_key, id::text))
                                {cols},
                                (1 - (embedding <=> %s::vector)) AS similarity_score
                            FROM companies
                            WHERE embedding IS NOT NULL
                                AND (1 - (embedding <=> %s::vector)) >= %s
                            ORDER BY COALESCE(dedupe_key, id::text), embedding <=> %s::vector
                        ) sub
                        ORDER BY similarity_score DESC
                        LIMIT %s
                    """, (embedding_str, embedding_str, min_similarity, embedding_str, limit))

                companies = [dict(row) for row in cur.fetchall()]

                # Round similarity scores to 3 decimal places for readability
                for company in companies:
                    if 'similarity_score' in company:
                        company['similarity_score'] = round(float(company['similarity_score']), 3)

                return companies

    def find_companies_by_text_search(
        self,
        idea: str,
        limit: int = 10,
        source_filter: Optional[str] = None,
    ) -> List[Dict]:
        """
        Fallback: find companies by text match when embedding search returns nothing.
        Useful when user pastes a company description - finds companies whose
        one_liner or long_description overlaps with the pasted text.

        source_filter mirrors find_similar_companies_by_embedding: 'yc' restricts to
        YC (hero verdict), None searches all sources deduped by dedupe_key.
        """
        if not idea or len(idea.strip()) < 10:
            return []
        text = idea.strip()
        # Search: companies whose one_liner/long_description contains a phrase from the pasted text
        # When user pastes a company description, first 60 chars often match one_liner
        phrase = text[:60].strip()
        if len(phrase) < 10:
            return []
        search_term = f"%{phrase}%"
        src_clause = "AND source = %s" if source_filter else ""
        params = [search_term, search_term]
        if source_filter:
            params.append(source_filter)
        params.extend([search_term, limit])
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(f"""
                    SELECT
                        id, name, slug, website, one_liner, long_description,
                        industry, subindustry, tags, industries, batch, is_hiring,
                        team_size, all_locations, country, small_logo_thumb_url, source, dedupe_key
                    FROM companies
                    WHERE (one_liner ILIKE %s OR long_description ILIKE %s)
                        {src_clause}
                        AND (one_liner IS NOT NULL OR long_description IS NOT NULL)
                    ORDER BY CASE WHEN one_liner ILIKE %s THEN 0 ELSE 1 END
                    LIMIT %s
                """, params)
                companies = [dict(row) for row in cur.fetchall()]
                # When searching all sources, keep one row per company (dedupe by domain).
                if not source_filter:
                    seen, deduped = set(), []
                    for c in companies:
                        key = c.get("dedupe_key") or f'id:{c.get("id")}'
                        if key in seen:
                            continue
                        seen.add(key)
                        deduped.append(c)
                    companies = deduped
                for c in companies:
                    c["similarity_score"] = 0.65  # Placeholder for text match
                return companies

    def get_industry_stats(self, industry: str) -> Dict:
        """
        Get statistics for a specific industry

        Args:
            industry: The industry name

        Returns:
            Dictionary with stats: total_companies, hiring_count, avg_team_size, etc.
        """
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                # Get total companies in industry
                cur.execute(
                    "SELECT COUNT(*) FROM companies WHERE industry = %s AND source = 'yc'",
                    (industry,)
                )
                total_companies = cur.fetchone()[0]

                # Get hiring count
                cur.execute(
                    "SELECT COUNT(*) FROM companies WHERE industry = %s AND is_hiring = TRUE AND source = 'yc'",
                    (industry,)
                )
                hiring_count = cur.fetchone()[0]

                # Get average team size
                cur.execute(
                    "SELECT AVG(team_size) FROM companies WHERE industry = %s AND team_size IS NOT NULL AND source = 'yc'",
                    (industry,)
                )
                avg_team_size_result = cur.fetchone()[0]
                avg_team_size = round(float(avg_team_size_result), 1) if avg_team_size_result else 0

                # Get top batches for this industry
                cur.execute("""
                    SELECT batch, COUNT(*) as count
                    FROM companies
                    WHERE industry = %s AND batch IS NOT NULL AND source = 'yc'
                    GROUP BY batch
                    ORDER BY count DESC
                    LIMIT 5
                """, (industry,))
                top_batches = [{"batch": row[0], "count": row[1]} for row in cur.fetchall()]

                return {
                    "industry": industry,
                    "total_companies": total_companies,
                    "hiring_count": hiring_count,
                    "hiring_percentage": round((hiring_count / total_companies * 100), 1) if total_companies > 0 else 0,
                    "avg_team_size": avg_team_size,
                    "top_batches": top_batches
                }

    def get_market_analysis(self, similar_companies: List[Dict]) -> Dict:
        """
        Analyze the market based on similar companies found

        Args:
            similar_companies: List of similar companies from find_similar_companies_by_embedding

        Returns:
            Dictionary with market analysis metrics
        """
        if not similar_companies:
            return {
                "total_similar": 0,
                "market_indicator": "green",
                "market_analysis": "No similar companies found in YC portfolio. First mover advantage!",
                "industry_breakdown": {},
                "batch_timeline": [],
                "market_size_percentage": 0
            }

        total_similar = len(similar_companies)

        # Determine market indicator based on number of similar companies
        if total_similar <= 3:
            indicator = "green"
            analysis = f"Found {total_similar} similar companies. Green light - relatively uncrowded space with room to differentiate."
        elif total_similar <= 10:
            indicator = "yellow"
            analysis = f"Found {total_similar} similar companies. Competitive but viable - focus on differentiation and unique value proposition."
        else:
            indicator = "crowded"
            analysis = f"Found {total_similar} similar companies. Crowded space - you'll need strong differentiation or a unique angle to stand out."

        # Industry breakdown
        industry_breakdown = {}
        for company in similar_companies:
            industry = company.get('industry', 'Unknown')
            if industry:
                industry_breakdown[industry] = industry_breakdown.get(industry, 0) + 1

        # Sort by count
        industry_breakdown = dict(sorted(industry_breakdown.items(), key=lambda x: x[1], reverse=True))

        # Batch timeline
        batch_counts = {}
        for company in similar_companies:
            batch = company.get('batch')
            if batch:
                batch_counts[batch] = batch_counts.get(batch, 0) + 1

        # Sort batches chronologically (most recent first)
        batch_timeline = [{"batch": batch, "count": count} for batch, count in sorted(batch_counts.items(), reverse=True)]

        # Market size percentage (compared to total YC portfolio)
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM companies WHERE source = 'yc'")
                total_yc_companies = cur.fetchone()[0]
                market_size_percentage = round((total_similar / total_yc_companies * 100), 2) if total_yc_companies > 0 else 0

        return {
            "total_similar": total_similar,
            "market_indicator": indicator,
            "market_analysis": analysis,
            "industry_breakdown": industry_breakdown,
            "batch_timeline": batch_timeline,
            "market_size_percentage": market_size_percentage
        }

    def get_batch_wrapped_stats(self, batch: str) -> Dict:
        """Generate comprehensive Wrapped-style stats for a batch"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get total companies in batch
                cur.execute("""
                    SELECT COUNT(*) as total
                    FROM companies
                    WHERE batch = %s
                """, (batch,))
                total_result = cur.fetchone()
                total_companies = total_result['total'] if total_result else 0

                if total_companies == 0:
                    return None

                # Get hiring stats
                cur.execute("""
                    SELECT COUNT(*) as hiring_count
                    FROM companies
                    WHERE batch = %s AND is_hiring = true
                """, (batch,))
                hiring_result = cur.fetchone()
                hiring_count = hiring_result['hiring_count'] if hiring_result else 0
                hiring_percentage = round((hiring_count / total_companies * 100), 1) if total_companies > 0 else 0

                # Get top 5 industries with counts and percentages
                cur.execute("""
                    SELECT industry, COUNT(*) as count
                    FROM companies
                    WHERE batch = %s AND industry IS NOT NULL AND industry != ''
                    GROUP BY industry
                    ORDER BY count DESC
                    LIMIT 5
                """, (batch,))
                industries_raw = cur.fetchall()
                top_industries = [
                    {
                        "name": row['industry'],
                        "count": row['count'],
                        "percentage": round((row['count'] / total_companies * 100), 1)
                    }
                    for row in industries_raw
                ]

                # Get top 5 countries with counts and percentages
                cur.execute("""
                    SELECT country, COUNT(*) as count
                    FROM companies
                    WHERE batch = %s AND country IS NOT NULL AND country != ''
                    GROUP BY country
                    ORDER BY count DESC
                    LIMIT 5
                """, (batch,))
                countries_raw = cur.fetchall()
                top_countries = [
                    {
                        "name": row['country'],
                        "count": row['count'],
                        "percentage": round((row['count'] / total_companies * 100), 1)
                    }
                    for row in countries_raw
                ]

                # Get average team size
                cur.execute("""
                    SELECT AVG(team_size) as avg_team_size
                    FROM companies
                    WHERE batch = %s AND team_size IS NOT NULL AND team_size > 0
                """, (batch,))
                team_size_result = cur.fetchone()
                avg_team_size = round(team_size_result['avg_team_size'], 1) if team_size_result and team_size_result['avg_team_size'] else None

                # Get a sample of notable companies (highest team size or hiring)
                cur.execute("""
                    SELECT name, team_size, is_hiring, industry
                    FROM companies
                    WHERE batch = %s
                    ORDER BY team_size DESC NULLS LAST, is_hiring DESC
                    LIMIT 3
                """, (batch,))
                notable_companies = [dict(row) for row in cur.fetchall()]

                # Generate fun fact
                fun_fact = self._generate_fun_fact(
                    total_companies,
                    hiring_percentage,
                    top_industries,
                    top_countries,
                    avg_team_size
                )

                return {
                    "batch": batch,
                    "total_companies": total_companies,
                    "hiring_count": hiring_count,
                    "hiring_percentage": hiring_percentage,
                    "top_industries": top_industries,
                    "top_countries": top_countries,
                    "avg_team_size": avg_team_size,
                    "notable_companies": notable_companies,
                    "fun_fact": fun_fact
                }

    def _generate_fun_fact(
        self,
        total: int,
        hiring_pct: float,
        industries: List[Dict],
        countries: List[Dict],
        avg_team: float
    ) -> str:
        """Generate an interesting fun fact about the batch"""
        facts = []

        if hiring_pct >= 50:
            facts.append(f"{hiring_pct}% of companies are actively hiring!")

        if industries and len(industries) > 0:
            top_industry = industries[0]
            if top_industry['percentage'] >= 20:
                facts.append(f"{top_industry['name']} dominates with {top_industry['percentage']}% of companies")
            else:
                facts.append(f"Most diverse batch with {len(industries)} major industries represented")

        if countries and len(countries) > 0:
            if countries[0]['name'] == 'United States':
                us_pct = countries[0]['percentage']
                if us_pct < 50:
                    facts.append(f"Truly global: {100 - us_pct}% of companies are outside the US")

        if avg_team and avg_team > 20:
            facts.append(f"Scaling fast: average team size is {avg_team} people")
        elif avg_team and avg_team < 5:
            facts.append(f"Lean startups: average team size is just {avg_team} people")

        if total >= 200:
            facts.append(f"Massive batch with {total} companies!")

        return facts[0] if facts else f"This batch has {total} amazing companies"

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
        """
        Log a company change to the change log table

        Args:
            company_id: ID of the company
            change_type: Type of change (created, hiring_started, hiring_stopped, batch_changed, funding_updated)
            old_value: Previous value (optional)
            new_value: New value (optional)
            field_name: Name of field that changed (optional)

        Returns:
            ID of the inserted change record
        """
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO company_changes (company_id, change_type, field_name, old_value, new_value)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (company_id, change_type, changed_at) DO NOTHING
                    RETURNING id
                    """,
                    (company_id, change_type, field_name, old_value, new_value)
                )
                result = cur.fetchone()
                return result[0] if result else 0

    def get_recent_changes(
        self,
        hours: int = 24,
        change_types: Optional[List[str]] = None
    ) -> List[Dict]:
        """
        Get recent changes from the change log

        Args:
            hours: Number of hours to look back (default: 24)
            change_types: Optional list of change types to filter by

        Returns:
            List of change records with company details
        """
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
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
                    WHERE cc.changed_at >= NOW() - INTERVAL '%s hours'
                """
                params = [hours]

                if change_types:
                    query += " AND cc.change_type = ANY(%s)"
                    params.append(change_types)

                query += " ORDER BY cc.changed_at DESC"

                cur.execute(query, params)
                return [dict(row) for row in cur.fetchall()]

    def get_changes_by_type(
        self,
        change_type: str,
        hours: int = 24,
        limit: int = 100
    ) -> List[Dict]:
        """
        Get changes of a specific type from the last N hours

        Args:
            change_type: Type of change to get
            hours: Number of hours to look back
            limit: Maximum number of results

        Returns:
            List of change records with company details
        """
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
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
                    WHERE cc.change_type = %s
                        AND cc.changed_at >= NOW() - INTERVAL '%s hours'
                    ORDER BY cc.changed_at DESC
                    LIMIT %s
                    """,
                    (change_type, hours, limit)
                )
                return [dict(row) for row in cur.fetchall()]

    def cleanup_old_changes(self, days_to_keep: int = 90) -> int:
        """
        Delete change log entries older than specified days

        Args:
            days_to_keep: Number of days to retain (default: 90)

        Returns:
            Number of rows deleted
        """
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM company_changes WHERE changed_at < NOW() - INTERVAL '%s days'",
                    (days_to_keep,)
                )
                return cur.rowcount

    def get_change_stats(self, days: int = 7) -> Dict:
        """
        Get statistics about changes over the last N days

        Args:
            days: Number of days to analyze

        Returns:
            Dictionary with change statistics
        """
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT
                        DATE(changed_at) as date,
                        change_type,
                        COUNT(*) as count
                    FROM company_changes
                    WHERE changed_at >= NOW() - INTERVAL '%s days'
                    GROUP BY DATE(changed_at), change_type
                    ORDER BY date DESC, change_type
                    """,
                    (days,)
                )
                results = [dict(row) for row in cur.fetchall()]

                # Organize by date
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
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get companies
                cur.execute('SELECT * FROM hiring_companies ORDER BY updated_at DESC')
                companies = [dict(row) for row in cur.fetchall()]

                # Get jobs
                cur.execute('SELECT * FROM hiring_jobs ORDER BY pretty_updated_at DESC NULLS LAST')
                jobs = []
                for row in cur.fetchall():
                    job = dict(row)
                    # Parse locations JSON
                    try:
                        if job.get('locations') and isinstance(job['locations'], str):
                            job['locations'] = json.loads(job['locations'])
                        elif job.get('locations') is None:
                            job['locations'] = []
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
                with conn.cursor() as cur:
                    companies = data.get("companies", [])
                    jobs = data.get("jobs", [])

                    # Upsert companies
                    for company in companies:
                        cur.execute('''
                            INSERT INTO hiring_companies
                            (id, name, slug, batch, team_size, location, logo_url, small_logo_url, website, one_liner, primary_vertical, raw_json, updated_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                            ON CONFLICT (id) DO UPDATE SET
                                name = EXCLUDED.name,
                                slug = EXCLUDED.slug,
                                batch = EXCLUDED.batch,
                                team_size = EXCLUDED.team_size,
                                location = EXCLUDED.location,
                                logo_url = EXCLUDED.logo_url,
                                small_logo_url = EXCLUDED.small_logo_url,
                                website = EXCLUDED.website,
                                one_liner = EXCLUDED.one_liner,
                                primary_vertical = EXCLUDED.primary_vertical,
                                raw_json = EXCLUDED.raw_json,
                                updated_at = NOW()
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

                    # Upsert jobs
                    for job in jobs:
                        locations_json = json.dumps(job.get('locations', []))
                        cur.execute('''
                            INSERT INTO hiring_jobs
                            (id, company_id, title, description, pretty_role, salary_min, salary_max,
                             job_type, remote, locations, pretty_location_or_remote, pretty_job_type,
                             pretty_min_experience, pretty_updated_at, show_path, raw_json, updated_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                            ON CONFLICT (id) DO UPDATE SET
                                title = EXCLUDED.title,
                                description = EXCLUDED.description,
                                pretty_role = EXCLUDED.pretty_role,
                                salary_min = EXCLUDED.salary_min,
                                salary_max = EXCLUDED.salary_max,
                                job_type = EXCLUDED.job_type,
                                remote = EXCLUDED.remote,
                                locations = EXCLUDED.locations,
                                pretty_location_or_remote = EXCLUDED.pretty_location_or_remote,
                                pretty_job_type = EXCLUDED.pretty_job_type,
                                pretty_min_experience = EXCLUDED.pretty_min_experience,
                                pretty_updated_at = EXCLUDED.pretty_updated_at,
                                show_path = EXCLUDED.show_path,
                                raw_json = EXCLUDED.raw_json,
                                updated_at = NOW()
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

                    return True

        except Exception as e:
            import logging
            logging.error(f"Error updating hiring board: {e}")
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

            with self.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("""
                    INSERT INTO predictions (
                        id, idea_description, team_info, industry, location, market_type,
                        idea_score, team_score, market_score, combined_score, percentile, tier,
                        top_matches, achievements, challenges, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                """, (
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
                conn.commit()

            return prediction_id
        except Exception as e:
            import logging
            logging.error(f"Error storing prediction: {e}")
            return None

    def get_all_company_success_scores(self):
        """Get success scores for all YC companies for percentile calculation."""
        try:
            with self.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("""
                    SELECT
                        CASE
                            WHEN funding_total_usd >= 1000000000 THEN 95
                            WHEN funding_total_usd >= 100000000 THEN 85
                            WHEN funding_total_usd >= 50000000 THEN 75
                            WHEN funding_total_usd >= 10000000 THEN 65
                            ELSE 50
                        END as success_score
                    FROM companies
                    WHERE funding_total_usd IS NOT NULL AND source = 'yc'
                    ORDER BY funding_total_usd DESC
                """)
                scores = [row[0] for row in cur.fetchall()]
                return scores if scores else [50] * 100
        except Exception as e:
            import logging
            logging.error(f"Error getting company success scores: {e}")
            return [50] * 100

    def get_prediction_leaderboard_position(self, combined_score):
        """Get leaderboard position for a given score."""
        try:
            with self.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("""
                    SELECT COUNT(*) + 1 FROM predictions
                    WHERE combined_score > %s AND is_public = true
                """, (combined_score,))
                position = cur.fetchone()[0]
                return position if position else 0
        except Exception as e:
            import logging
            logging.error(f"Error getting leaderboard position: {e}")
            return 0

    def get_leaderboard(self, industry=None, timeframe="all-time", limit=100):
        """Get the leaderboard of predictions."""
        import json
        from datetime import datetime, timedelta

        try:
            with self.get_connection() as conn:
                cur = conn.cursor()

                # Build WHERE clause based on timeframe
                where_clauses = ["is_public = true"]

                if timeframe == "this-week":
                    where_clauses.append(f"created_at >= NOW() - INTERVAL '7 days'")
                elif timeframe == "this-month":
                    where_clauses.append(f"created_at >= NOW() - INTERVAL '30 days'")

                if industry:
                    where_clauses.append(f"industry = %s")

                where_sql = " AND ".join(where_clauses)

                query = f"""
                    SELECT id, idea_description, combined_score, tier, industry, achievements, created_at
                    FROM predictions
                    WHERE {where_sql}
                    ORDER BY combined_score DESC
                    LIMIT %s
                """

                params = []
                if industry:
                    params.append(industry)
                params.append(limit)

                cur.execute(query, tuple(params))
                results = cur.fetchall()

                return [
                    {
                        "id": row[0],
                        "idea_description": row[1],
                        "combined_score": row[2],
                        "tier": row[3],
                        "industry": row[4],
                        "achievements": json.loads(row[5]) if row[5] else [],
                        "created_at": row[6].isoformat() if row[6] else None,
                        "rank": idx + 1
                    }
                    for idx, row in enumerate(results)
                ]
        except Exception as e:
            import logging
            logging.error(f"Error getting leaderboard: {e}")
            return []

    def get_prediction(self, prediction_id):
        """Get a specific prediction by ID."""
        import json

        try:
            with self.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("""
                    SELECT id, idea_description, team_info, industry, location, market_type,
                           idea_score, team_score, market_score, combined_score, percentile, tier,
                           top_matches, achievements, challenges, created_at
                    FROM predictions
                    WHERE id = %s
                """, (prediction_id,))
                row = cur.fetchone()

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
                        "created_at": row[15].isoformat() if row[15] else None
                    }
                return None
        except Exception as e:
            import logging
            logging.error(f"Error getting prediction: {e}")
            return None

    def update_prediction_sharing(self, prediction_id, is_public):
        """Update prediction sharing status."""
        try:
            with self.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("""
                    UPDATE predictions
                    SET is_public = %s, updated_at = NOW()
                    WHERE id = %s
                """, (is_public, prediction_id))
                conn.commit()
                return True
        except Exception as e:
            import logging
            logging.error(f"Error updating prediction sharing: {e}")
            return False

    def set_prediction_share_token(self, prediction_id, share_token):
        """Set share token for a prediction."""
        try:
            with self.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("""
                    UPDATE predictions
                    SET share_token = %s, updated_at = NOW()
                    WHERE id = %s
                """, (share_token, prediction_id))
                conn.commit()
                return True
        except Exception as e:
            import logging
            logging.error(f"Error setting share token: {e}")
            return False

    def get_prediction_by_share_token(self, share_token):
        """Get prediction by share token."""
        import json

        try:
            with self.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("""
                    SELECT id, idea_description, team_info, industry, location, market_type,
                           idea_score, team_score, market_score, combined_score, percentile, tier,
                           top_matches, achievements, challenges, created_at
                    FROM predictions
                    WHERE share_token = %s AND is_public = true
                """, (share_token,))
                row = cur.fetchone()

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
                        "created_at": row[15].isoformat() if row[15] else None
                    }
                return None
        except Exception as e:
            import logging
            logging.error(f"Error getting prediction by share token: {e}")
            return None

    def get_cached_research(self, query: str) -> Optional[Dict]:
        """Get cached research result for a query"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM research_cache WHERE LOWER(query) = LOWER(%s) LIMIT 1",
                    (query,)
                )
                row = cur.fetchone()
                if row:
                    # Parse JSON fields - handle both string and already-parsed data
                    response_data = row["response_data"]
                    if isinstance(response_data, str):
                        response_data = json.loads(response_data)

                    parsed_sections = row["parsed_sections"]
                    if parsed_sections and isinstance(parsed_sections, str):
                        parsed_sections = json.loads(parsed_sections)

                    citations = row["citations"]
                    if citations:
                        if isinstance(citations, str):
                            citations = json.loads(citations)
                    else:
                        citations = []

                    return {
                        "id": row["id"],
                        "query": row["query"],
                        "query_type": row["query_type"],
                        "response_data": response_data,
                        "parsed_sections": parsed_sections,
                        "citations": citations,
                        "view_count": row["view_count"],
                        "search_count": row["search_count"],
                        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
                        "cached": True
                    }
                return None

    def store_research(self, query: str, query_type: str, response_data: Dict, parsed_sections: Optional[Dict] = None) -> int:
        """Store research result in cache"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                citations = response_data.get("citations", [])

                # Ensure citations is properly JSON encoded
                if isinstance(citations, str):
                    citations_json = citations
                else:
                    citations_json = json.dumps(citations) if citations else json.dumps([])

                # Make a clean copy of response_data with serializable citations
                clean_response_data = response_data.copy()
                clean_response_data["citations"] = json.loads(citations_json)  # Ensure it's a list

                try:
                    cur.execute('''
                        INSERT INTO research_cache
                        (query, query_type, response_data, parsed_sections, citations, updated_at)
                        VALUES (%s, %s, %s, %s, %s, NOW())
                        ON CONFLICT (query) DO UPDATE SET
                            response_data = EXCLUDED.response_data,
                            parsed_sections = EXCLUDED.parsed_sections,
                            citations = EXCLUDED.citations,
                            updated_at = NOW()
                        RETURNING id
                    ''', (
                        query,
                        query_type,
                        json.dumps(clean_response_data),
                        json.dumps(parsed_sections) if parsed_sections else None,
                        citations_json
                    ))
                    result = cur.fetchone()
                    return result[0] if result else 0
                except Exception as e:
                    import logging
                    logging.error(f"Error storing research: {e}")
                    raise

    def increment_research_view_count(self, query: str) -> None:
        """Increment view count for cached research"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE research_cache SET view_count = view_count + 1, search_count = search_count + 1, updated_at = NOW() WHERE LOWER(query) = LOWER(%s)",
                    (query,)
                )

    def get_all_research_history(self, limit: int = 50, offset: int = 0, sort_by: str = "recent") -> List[Dict]:
        """Get all research history with optional sorting"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                order_by = "updated_at DESC"  # default: recent
                if sort_by == "popular":
                    order_by = "view_count DESC"
                elif sort_by == "oldest":
                    order_by = "created_at ASC"

                cur.execute(f'''
                    SELECT id, query, query_type, response_data, citations, view_count, search_count, created_at, updated_at
                    FROM research_cache
                    ORDER BY {order_by}
                    LIMIT %s OFFSET %s
                ''', (limit, offset))

                results = []
                for row in cur.fetchall():
                    # Parse JSON fields - handle both string and already-parsed data
                    response_data = row["response_data"]
                    if isinstance(response_data, str):
                        response_data = json.loads(response_data)

                    citations = row["citations"]
                    if citations:
                        if isinstance(citations, str):
                            citations = json.loads(citations)
                    else:
                        citations = []

                    results.append({
                        "id": row["id"],
                        "query": row["query"],
                        "query_type": row["query_type"],
                        "response_data": response_data,
                        "citations": citations,
                        "view_count": row["view_count"],
                        "search_count": row["search_count"],
                        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None
                    })
                return results

    def get_popular_research(self, limit: int = 10) -> List[Dict]:
        """Get most popular research queries"""
        return self.get_all_research_history(limit=limit, sort_by="popular")

    def search_research_history(self, search_query: str, limit: int = 20) -> List[Dict]:
        """Search research history by company name or query"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                search_pattern = f"%{search_query}%"

                cur.execute('''
                    SELECT id, query, query_type, response_data, citations, view_count, search_count, created_at, updated_at
                    FROM research_cache
                    WHERE query ILIKE %s OR response_data::text ILIKE %s
                    ORDER BY view_count DESC, updated_at DESC
                    LIMIT %s
                ''', (search_pattern, search_pattern, limit))

                results = []
                for row in cur.fetchall():
                    # Parse JSON fields - handle both string and already-parsed data
                    response_data = row["response_data"]
                    if isinstance(response_data, str):
                        response_data = json.loads(response_data)

                    citations = row["citations"]
                    if citations:
                        if isinstance(citations, str):
                            citations = json.loads(citations)
                    else:
                        citations = []

                    results.append({
                        "id": row["id"],
                        "query": row["query"],
                        "query_type": row["query_type"],
                        "response_data": response_data,
                        "citations": citations,
                        "view_count": row["view_count"],
                        "search_count": row["search_count"],
                        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None
                    })
                return results

    # ========================================================================
    # PUBLIC API: developer accounts, keys, usage, sessions
    # ========================================================================

    def create_api_user(self, email, password_hash, company_name=None, verification_token=None) -> int:
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    'INSERT INTO api_users (email, password_hash, company_name, verification_token) '
                    'VALUES (%s, %s, %s, %s) RETURNING id',
                    (email, password_hash, company_name, verification_token))
                return cur.fetchone()[0]

    def get_api_user_by_email(self, email) -> Optional[Dict]:
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute('SELECT * FROM api_users WHERE email = %s', (email,))
                row = cur.fetchone()
                return dict(row) if row else None

    def get_api_user_by_id(self, user_id) -> Optional[Dict]:
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute('SELECT * FROM api_users WHERE id = %s', (user_id,))
                row = cur.fetchone()
                return dict(row) if row else None

    def verify_api_user_email(self, token) -> bool:
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    'UPDATE api_users SET email_verified = TRUE, verification_token = NULL, updated_at = NOW() '
                    'WHERE verification_token = %s', (token,))
                return cur.rowcount > 0

    def set_api_user_plan(self, user_id, plan) -> bool:
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute('UPDATE api_users SET plan = %s, updated_at = NOW() WHERE id = %s', (plan, user_id))
                return cur.rowcount > 0

    def set_api_user_status(self, user_id, status) -> bool:
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute('UPDATE api_users SET status = %s, updated_at = NOW() WHERE id = %s', (status, user_id))
                return cur.rowcount > 0

    def set_api_user_stripe_customer(self, user_id, customer_id) -> bool:
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute('UPDATE api_users SET stripe_customer_id = %s, updated_at = NOW() WHERE id = %s',
                            (customer_id, user_id))
                return cur.rowcount > 0

    def update_api_user_profile(self, user_id, company_name=None, avatar_url=None) -> bool:
        sets, params = [], []
        if company_name is not None:
            sets.append('company_name = %s'); params.append(company_name)
        if avatar_url is not None:
            sets.append('avatar_url = %s'); params.append(avatar_url)
        if not sets:
            return False
        params.append(user_id)
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(f"UPDATE api_users SET {', '.join(sets)}, updated_at = NOW() WHERE id = %s", params)
                return cur.rowcount > 0

    def list_api_users(self) -> List[Dict]:
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute('''
                    SELECT u.id, u.email, u.company_name, u.plan, u.status, u.email_verified, u.created_at,
                           (SELECT COUNT(*) FROM api_keys k WHERE k.user_id = u.id AND k.is_active = TRUE) AS active_keys
                    FROM api_users u ORDER BY u.created_at DESC''')
                return [dict(r) for r in cur.fetchall()]

    def create_api_key(self, user_id, key_prefix, key_hash, name=None) -> int:
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute('INSERT INTO api_keys (user_id, key_prefix, key_hash, name) '
                            'VALUES (%s, %s, %s, %s) RETURNING id', (user_id, key_prefix, key_hash, name))
                return cur.fetchone()[0]

    def get_api_key_by_hash(self, key_hash) -> Optional[Dict]:
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute('''
                    SELECT k.id, k.user_id, k.is_active, u.plan, u.status AS user_status
                    FROM api_keys k JOIN api_users u ON u.id = k.user_id
                    WHERE k.key_hash = %s''', (key_hash,))
                row = cur.fetchone()
                return dict(row) if row else None

    def list_api_keys_for_user(self, user_id) -> List[Dict]:
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute('''
                    SELECT k.id, k.key_prefix, k.name, k.is_active, k.revoked_at, k.created_at,
                           (SELECT MAX(created_at) FROM api_usage WHERE api_key_id = k.id) AS last_used_at
                    FROM api_keys k WHERE k.user_id = %s ORDER BY k.created_at DESC''', (user_id,))
                return [dict(r) for r in cur.fetchall()]

    def revoke_api_key(self, key_id, user_id=None) -> bool:
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                if user_id is not None:
                    cur.execute('UPDATE api_keys SET is_active = FALSE, revoked_at = NOW() WHERE id = %s AND user_id = %s',
                                (key_id, user_id))
                else:
                    cur.execute('UPDATE api_keys SET is_active = FALSE, revoked_at = NOW() WHERE id = %s', (key_id,))
                return cur.rowcount > 0

    def list_all_api_keys(self) -> List[Dict]:
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute('''
                    SELECT k.id, k.user_id, u.email, k.key_prefix, k.name, k.is_active, k.revoked_at, k.created_at,
                           (SELECT MAX(created_at) FROM api_usage WHERE api_key_id = k.id) AS last_used_at
                    FROM api_keys k JOIN api_users u ON u.id = k.user_id ORDER BY k.created_at DESC''')
                return [dict(r) for r in cur.fetchall()]

    def log_api_usage(self, api_key_id, endpoint, status_code) -> None:
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute('INSERT INTO api_usage (api_key_id, endpoint, status_code) VALUES (%s, %s, %s)',
                            (api_key_id, endpoint, status_code))

    def count_api_usage_since(self, api_key_id, since):
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT COUNT(*), MIN(created_at) FROM api_usage WHERE api_key_id = %s AND created_at > %s',
                            (api_key_id, since))
                row = cur.fetchone()
                return (row[0] or 0, row[1])

    def create_api_session(self, user_id, token_hash, expires_at) -> int:
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute('INSERT INTO api_sessions (user_id, token_hash, expires_at) '
                            'VALUES (%s, %s, %s) RETURNING id', (user_id, token_hash, expires_at))
                return cur.fetchone()[0]

    def get_api_session(self, token_hash) -> Optional[Dict]:
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute('''
                    SELECT s.user_id, s.expires_at, u.email, u.company_name, u.plan, u.status AS user_status
                    FROM api_sessions s JOIN api_users u ON u.id = s.user_id
                    WHERE s.token_hash = %s AND s.expires_at > NOW()''', (token_hash,))
                row = cur.fetchone()
                return dict(row) if row else None

    def delete_api_session(self, token_hash) -> None:
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute('DELETE FROM api_sessions WHERE token_hash = %s', (token_hash,))

    def delete_expired_api_sessions(self) -> int:
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute('DELETE FROM api_sessions WHERE expires_at < NOW()')
                return cur.rowcount

    def cleanup_api_usage(self, older_than) -> int:
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute('DELETE FROM api_usage WHERE created_at < %s', (older_than,))
                return cur.rowcount

    def get_api_usage_timeseries(self, user_id, since) -> List[Dict]:
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute('''
                    SELECT to_char(u.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, COUNT(*) AS count
                    FROM api_usage u JOIN api_keys k ON k.id = u.api_key_id
                    WHERE k.user_id = %s AND u.created_at > %s
                    GROUP BY 1 ORDER BY 1''', (user_id, since))
                return [dict(r) for r in cur.fetchall()]

    def get_api_usage_by_endpoint(self, user_id, since, limit=10) -> List[Dict]:
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute('''
                    SELECT u.endpoint AS endpoint, COUNT(*) AS count
                    FROM api_usage u JOIN api_keys k ON k.id = u.api_key_id
                    WHERE k.user_id = %s AND u.created_at > %s
                    GROUP BY u.endpoint ORDER BY count DESC LIMIT %s''', (user_id, since, limit))
                return [dict(r) for r in cur.fetchall()]

    def get_research_stats(self) -> Dict:
        """Get research statistics"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM research_cache")
                total_searches = cur.fetchone()[0]

                cur.execute("SELECT COALESCE(SUM(view_count), 0) FROM research_cache")
                total_views = cur.fetchone()[0] or 0

                cur.execute("SELECT COALESCE(AVG(view_count), 0) FROM research_cache")
                avg_views = cur.fetchone()[0] or 0

                return {
                    "total_searches": total_searches,
                    "total_views": total_views,
                    "avg_views_per_search": round(float(avg_views), 2)
                }

    # ============================================================================
    # IDEA ANSWER CACHE METHODS
    # ============================================================================

    def get_idea_answer_cache(self, query_key: str):
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT answer_json FROM idea_answer_cache "
                    "WHERE query_key = %s AND expires_at > NOW()", (query_key,))
                row = cur.fetchone()
                if not row:
                    return None
                cur.execute("UPDATE idea_answer_cache SET hit_count = hit_count + 1 WHERE query_key = %s", (query_key,))
                conn.commit()
                return row["answer_json"]

    def set_idea_answer_cache(self, query_key: str, answer_json: dict, ttl_hours: int = 24, prose: str = None) -> None:
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO idea_answer_cache (query_key, answer_json, prose, expires_at)
                    VALUES (%s, %s, %s, NOW() + (%s || ' hours')::interval)
                    ON CONFLICT (query_key) DO UPDATE
                      SET answer_json = EXCLUDED.answer_json, prose = EXCLUDED.prose,
                          expires_at = EXCLUDED.expires_at, created_at = NOW()
                    """,
                    (query_key, json.dumps(answer_json), prose, str(ttl_hours)))
                conn.commit()
