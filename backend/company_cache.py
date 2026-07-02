"""
In-memory cache for companies data. Loads at startup, serves read-heavy endpoints,
refreshes when scrapes complete. Excludes upvotes, subscriptions, embedding search.
"""

from typing import Dict, List, Optional, Any


class CompanyCache:
    """In-memory cache for companies and derived data."""

    def __init__(self):
        self._companies: List[Dict] = []
        self._companies_by_id: Dict[int, Dict] = {}
        self._map_companies: List[Dict] = []
        self._stats: Dict = {}
        self._batches: List[str] = []
        self._industries: List[str] = []
        self._countries: List[str] = []
        self._loaded = False

    def load(self, db) -> None:
        """Load all companies from DB, build indices, compute stats."""
        companies = db.get_all_companies_full()
        self._build_cache(companies)

    def refresh(self, db) -> None:
        """Reload cache from DB (call after scrape completes)."""
        self.load(db)

    def _build_cache(self, companies: List[Dict]) -> None:
        """Build indices and derived data from company list."""
        # Sort by created_at DESC (newest first) for get_companies pagination
        def sort_key(c):
            created = c.get("created_at")
            if created is None:
                return ""
            return str(created) if not hasattr(created, "isoformat") else created.isoformat()

        self._companies = sorted(companies, key=sort_key, reverse=True)
        self._companies_by_id = {c["id"]: c for c in companies if c.get("id") is not None}

        # Map subset: companies with geo coordinates
        map_cols = {
            "id", "name", "slug", "website", "one_liner", "batch", "is_hiring",
            "top_company", "small_logo_thumb_url",
            "latitude", "longitude", "country", "all_locations"
        }
        self._map_companies = [
            {k: c.get(k) for k in map_cols if k in c}
            for c in companies
            if c.get("latitude") is not None and c.get("longitude") is not None
        ]

        # Stats
        total = len(companies)
        hiring = sum(1 for c in companies if c.get("is_hiring"))
        by_batch: Dict[str, int] = {}
        for c in companies:
            b = c.get("batch")
            if b:
                by_batch[b] = by_batch.get(b, 0) + 1
        by_batch = dict(sorted(by_batch.items(), key=lambda x: -x[1]))

        by_industry: Dict[str, int] = {}
        for c in companies:
            ind = c.get("industry")
            if ind:
                by_industry[ind] = by_industry.get(ind, 0) + 1
        by_industry = dict(sorted(by_industry.items(), key=lambda x: -x[1])[:10])

        by_country: Dict[str, int] = {}
        for c in companies:
            cnt = c.get("country")
            if cnt:
                by_country[cnt] = by_country.get(cnt, 0) + 1
        by_country = dict(sorted(by_country.items(), key=lambda x: -x[1])[:10])

        by_status: Dict[str, int] = {}
        for c in companies:
            s = c.get("status") or "unknown"
            by_status[s] = by_status.get(s, 0) + 1

        by_batch_industry: Dict[str, Dict[str, int]] = {}
        for c in companies:
            b = c.get("batch")
            ind = c.get("industry")
            if b and ind:
                if b not in by_batch_industry:
                    by_batch_industry[b] = {}
                by_batch_industry[b][ind] = by_batch_industry[b].get(ind, 0) + 1

        self._stats = {
            "total_companies": total,
            "hiring": hiring,
            "by_batch": by_batch,
            "by_industry": by_industry,
            "by_country": by_country,
            "by_status": by_status,
            "by_batch_industry": by_batch_industry,
        }

        # Filter lists
        self._batches = sorted(
            {c.get("batch") for c in companies if c.get("batch")},
            reverse=True
        )
        self._industries = sorted(
            {c.get("industry") for c in companies if c.get("industry")}
        )
        self._countries = sorted(
            {c.get("country") for c in companies if c.get("country")}
        )

        self._loaded = True

    def is_loaded(self) -> bool:
        return self._loaded

    def _matches_search(self, company: Dict, search: str) -> bool:
        """Case-insensitive substring match on name, one_liner, long_description."""
        if not search or not search.strip():
            return True
        s = search.strip().lower()
        for field in ("name", "one_liner", "long_description"):
            val = company.get(field)
            if val and s in str(val).lower():
                return True
        return False

    def _filter_companies(
        self,
        batch: Optional[str] = None,
        is_hiring: Optional[bool] = None,
        industry: Optional[str] = None,
        country: Optional[str] = None,
        search: Optional[str] = None,
        top_company: Optional[bool] = None,
    ) -> List[Dict]:
        """Apply filters to companies list."""
        result = self._companies
        if batch:
            result = [c for c in result if c.get("batch") == batch]
        if is_hiring is not None:
            result = [c for c in result if c.get("is_hiring") == is_hiring]
        if industry:
            result = [c for c in result if c.get("industry") == industry]
        if country:
            result = [c for c in result if c.get("country") == country]
        if search:
            result = [c for c in result if self._matches_search(c, search)]
        if top_company is not None:
            result = [c for c in result if c.get("top_company") == top_company]
        return result

    def get_companies(
        self,
        limit: int = 100,
        offset: int = 0,
        batch: Optional[str] = None,
        is_hiring: Optional[bool] = None,
        industry: Optional[str] = None,
        country: Optional[str] = None,
        search: Optional[str] = None,
        top_company: Optional[bool] = None,
    ) -> List[Dict]:
        """Get companies with filters and pagination."""
        filtered = self._filter_companies(batch, is_hiring, industry, country, search, top_company)
        return filtered[offset : offset + limit]

    def count_companies(
        self,
        batch: Optional[str] = None,
        is_hiring: Optional[bool] = None,
        industry: Optional[str] = None,
        country: Optional[str] = None,
        search: Optional[str] = None,
        top_company: Optional[bool] = None,
    ) -> int:
        """Count companies matching filters."""
        filtered = self._filter_companies(batch, is_hiring, industry, country, search, top_company)
        return len(filtered)

    def get_company_by_id(self, company_id: int) -> Optional[Dict]:
        """Get single company by ID."""
        return self._companies_by_id.get(company_id)

    def get_stats(self) -> Dict:
        """Return precomputed stats."""
        return self._stats.copy()

    def get_companies_for_map(
        self,
        batch: Optional[str] = None,
        is_hiring: Optional[bool] = None,
        recent_batches: Optional[int] = None,
    ) -> List[Dict]:
        """Get companies with geo coordinates for map."""
        result = self._map_companies
        if batch:
            result = [c for c in result if c.get("batch") == batch]
        if is_hiring is not None:
            result = [c for c in result if c.get("is_hiring") == is_hiring]
        if recent_batches is not None and recent_batches > 0:
            batches_set = set(self._batches[:recent_batches])
            result = [c for c in result if c.get("batch") in batches_set]
        return result

    def get_total_map_companies(self) -> int:
        """Count of companies with geo coordinates."""
        return len(self._map_companies)

    def get_unique_batches(self) -> List[str]:
        return list(self._batches)

    def get_unique_industries(self) -> List[str]:
        return list(self._industries)

    def get_unique_countries(self) -> List[str]:
        return list(self._countries)

    def get_all_companies(self) -> List[Dict]:
        """Get minimal company data for snapshot creation (id, batch, is_hiring, team_size, status, industry)."""
        cols = ("id", "batch", "is_hiring", "team_size", "status", "industry")
        return [
            {k: c.get(k) for k in cols}
            for c in self._companies
        ]
