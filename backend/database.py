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
                    name TEXT NOT NULL,
                    slug TEXT UNIQUE NOT NULL,
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

            # Create indexes
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_batch ON companies(batch)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_hiring ON companies(is_hiring)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_industry ON companies(industry)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_country ON companies(country)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_funding_total ON companies(funding_total_usd)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_investor_name ON investors(name)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_company_investor_company ON company_investors(company_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_company_investor_investor ON company_investors(investor_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_hiring_company_id ON hiring_jobs(company_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_hiring_role ON hiring_jobs(pretty_role)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_hiring_updated ON hiring_jobs(pretty_updated_at)')

    def insert_company(self, company: Dict[str, Any]) -> int:
        """Insert or update a company"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO companies
                (id, name, slug, website, one_liner, long_description, team_size,
                 batch, status, industry, subindustry, all_locations, is_hiring,
                 top_company, nonprofit, stage, small_logo_thumb_url, tags, regions,
                 industries, latitude, longitude, country, raw_json, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ''', (
                company.get('id'),
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
                json.dumps(company)
            ))
            return cursor.lastrowid

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
