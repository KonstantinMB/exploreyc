"""
Optimized Hiring Board Service
- Fetches hiring data from WorkAtAStartup API
- Stores in database
- Loads into memory on startup
- Daily scheduler updates new jobs
- Compares latest 100 jobs each day to detect new/updated jobs
"""

import requests
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import json
from hiring_analytics import HiringAnalyticsCompute

try:
    from currency_utils import job_salary_to_usd
except ImportError:
    def job_salary_to_usd(job, company=None):
        min_sal = job.get("salary_min")
        max_sal = job.get("salary_max")
        if min_sal and max_sal:
            return (min_sal + max_sal) / 2
        return min_sal or max_sal or None

logger = logging.getLogger(__name__)

WORK_AT_STARTUP_API = "https://www.workatastartup.com/api/latest/companies"


class HiringBoardCache:
    """In-memory cache for hiring board data"""

    def __init__(self):
        self.companies: List[Dict[str, Any]] = []
        self.jobs: List[Dict[str, Any]] = []
        self.stats: Optional[Dict[str, Any]] = None
        self.analytics: Optional[Dict[str, Any]] = None
        self.last_updated: Optional[datetime] = None

    def load(self, db: Any):
        """Load hiring data from database into memory"""
        try:
            if hasattr(db, 'get_hiring_board'):
                data = db.get_hiring_board()
                self.companies = data.get("companies", [])
                self.jobs = data.get("jobs", [])
                self.last_updated = datetime.now()
                logger.info(f"Loaded hiring cache: {len(self.companies)} companies, {len(self.jobs)} jobs")
                self._calculate_stats()
            else:
                logger.warning("Database doesn't support get_hiring_board yet")
        except Exception as e:
            logger.error(f"Error loading hiring cache: {e}")

    def refresh(self, db: Any):
        """Refresh the cache from database"""
        self.load(db)

    def _calculate_stats(self):
        """Calculate aggregated statistics"""
        try:
            self.stats = {
                "totalJobs": len(self.jobs),
                "hiringCompanies": len(self.companies),
                "newJobsThisWeek": self._count_new_jobs_this_week(),
                "avgSalary": self._calculate_avg_salary(),
                "topRoles": self._get_top_roles(limit=8),
                "topBatches": self._get_top_batches(limit=10),
                "topLocations": self._get_top_locations(limit=8),
            }
            logger.info(f"Stats calculated: {len(self.jobs)} jobs, {len(self.companies)} companies")
        except Exception as e:
            logger.error(f"Error calculating stats: {e}")
            import traceback
            logger.error(traceback.format_exc())
            self.stats = {}

        # Compute comprehensive analytics
        try:
            logger.info("Starting analytics computation...")
            compute = HiringAnalyticsCompute(self.jobs, self.companies)
            self.analytics = compute.compute_all()
            if self.analytics:
                logger.info(f"✅ Analytics computed successfully with {len(self.analytics)} metrics")
            else:
                logger.warning("⚠️ Analytics computed but returned empty dict")
        except Exception as e:
            logger.error(f"❌ Error computing analytics: {e}")
            import traceback
            logger.error(traceback.format_exc())
            self.analytics = {}

    def get_stats(self) -> Dict[str, Any]:
        """Get cached stats"""
        return self.stats or {}

    def get_analytics(self) -> Dict[str, Any]:
        """Get cached analytics"""
        return self.analytics or {}

    def get_companies(self) -> List[Dict[str, Any]]:
        """Get all companies"""
        return self.companies

    def get_jobs(self) -> List[Dict[str, Any]]:
        """Get all jobs"""
        return self.jobs

    def get_hiring_board(self) -> Dict[str, Any]:
        """Get companies and jobs"""
        return {
            "companies": self.companies,
            "jobs": self.jobs,
            "totalJobs": len(self.jobs),
            "hiringCompanies": len(self.companies),
            "lastUpdated": self.last_updated.isoformat() if self.last_updated else None
        }

    def _count_new_jobs_this_week(self) -> int:
        """Count jobs posted in the last 7 days"""
        from datetime import timezone
        one_week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        count = 0

        for job in self.jobs:
            try:
                updated_at = job.get("pretty_updated_at")
                if updated_at:
                    job_date = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
                    if job_date > one_week_ago:
                        count += 1
            except (ValueError, AttributeError):
                pass

        return count

    def _calculate_avg_salary(self) -> Optional[float]:
        """Average salary, currency-normalized to USD.

        Without conversion, INR/EUR/etc. amounts were summed with USD as
        raw numbers, badly inflating the average (a 50,000 INR salary
        being counted as $50,000).
        """
        company_map: Dict[Any, Dict[str, Any]] = {}
        for c in self.companies:
            cid = c.get("id")
            if isinstance(cid, list):
                cid = cid[0] if cid else None
            if cid is not None:
                company_map[cid] = c

        salaries = []
        for job in self.jobs:
            cid = job.get("company_id")
            if isinstance(cid, list):
                cid = cid[0] if cid else None
            usd = job_salary_to_usd(job, company_map.get(cid))
            if usd is not None:
                salaries.append(usd)

        if salaries:
            return sum(salaries) / len(salaries)
        return None

    def _get_top_roles(self, limit: int = 8) -> List[Dict[str, Any]]:
        """Get top job roles by frequency"""
        role_counts: Dict[str, int] = {}

        for job in self.jobs:
            role = job.get("pretty_role", "Other")
            # Ensure role is a string
            if isinstance(role, list):
                role = role[0] if role else "Other"
            role = str(role) if role else "Other"

            role_counts[role] = role_counts.get(role, 0) + 1

        sorted_roles = sorted(role_counts.items(), key=lambda x: x[1], reverse=True)
        return [{"role": role, "count": count} for role, count in sorted_roles[:limit]]

    def _get_top_batches(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get top YC batches by job count"""
        # Build company_batch_map with type safety for IDs
        company_batch_map = {}
        for c in self.companies:
            company_id = c.get("id")
            # Ensure ID is a valid type (not a list)
            if isinstance(company_id, list):
                company_id = company_id[0] if company_id else None
            batch = c.get("batch", "")
            # Ensure batch is a string
            if isinstance(batch, list):
                batch = batch[0] if batch else ""
            if company_id is not None:
                company_batch_map[company_id] = batch

        batch_counts: Dict[str, int] = {}

        for job in self.jobs:
            company_id = job.get("company_id")
            # Ensure company_id is not a list
            if isinstance(company_id, list):
                company_id = company_id[0] if company_id else None

            batch = company_batch_map.get(company_id)
            if batch:
                batch_counts[batch] = batch_counts.get(batch, 0) + 1

        sorted_batches = sorted(batch_counts.items(), key=lambda x: x[1], reverse=True)
        return [{"batch": batch, "count": count} for batch, count in sorted_batches[:limit]]

    def _get_top_locations(self, limit: int = 8) -> List[Dict[str, Any]]:
        """Get top job locations by frequency"""
        location_counts: Dict[str, int] = {}

        for job in self.jobs:
            locations = job.get("locations", [])
            for location in locations:
                # Ensure location is a string (API sometimes returns lists)
                if isinstance(location, list):
                    location = location[0] if location else None
                location = str(location) if location else None

                if location:
                    location_counts[location] = location_counts.get(location, 0) + 1

        sorted_locations = sorted(location_counts.items(), key=lambda x: x[1], reverse=True)
        return [{"location": location, "count": count} for location, count in sorted_locations[:limit]]


class HiringBoardService:
    """Service to fetch and manage hiring data"""

    def __init__(self):
        self.cache = HiringBoardCache()

    def fetch_from_api(self) -> Optional[Dict[str, Any]]:
        """
        Fetch hiring data from WorkAtAStartup API
        Returns only the latest 100 jobs for comparison
        """
        try:
            logger.info("Fetching hiring data from WorkAtAStartup API...")
            response = requests.post(
                WORK_AT_STARTUP_API,
                json={},
                timeout=60,
                headers={
                    "User-Agent": "Mozilla/5.0 (YC Explorer) - Job board integration",
                    "Content-Type": "application/json"
                }
            )
            response.raise_for_status()

            data = response.json()
            logger.info(f"Fetched {len(data.get('companies', []))} companies, {len(data.get('jobs', []))} jobs")
            return data

        except Exception as e:
            logger.error(f"Error fetching from WorkAtAStartup API: {e}")
            return None

    def update_hiring_data(self, db: Any):
        """
        Fetch latest hiring data and update database
        Only processes latest jobs and compares with previous data
        """
        new_data = self.fetch_from_api()
        if not new_data:
            logger.warning("No data received from API, skipping update")
            return False

        try:
            if hasattr(db, 'update_hiring_board'):
                success = db.update_hiring_board(new_data)
                if success:
                    self.cache.refresh(db)
                    logger.info("Successfully updated hiring data in database")
                    return True
            else:
                logger.warning("Database doesn't support update_hiring_board yet")
                return False
        except Exception as e:
            logger.error(f"Error updating hiring data: {e}")
            return False

    def get_hiring_board(self) -> Dict[str, Any]:
        """Get cached hiring board data"""
        return self.cache.get_hiring_board()

    def get_hiring_stats(self) -> Dict[str, Any]:
        """Get cached hiring statistics"""
        return self.cache.get_stats()

    def get_jobs(self) -> List[Dict[str, Any]]:
        """Get all cached jobs"""
        return self.cache.get_jobs()

    def get_companies(self) -> List[Dict[str, Any]]:
        """Get all cached companies"""
        return self.cache.get_companies()


# Global service instance
_hiring_service: Optional[HiringBoardService] = None


def get_hiring_service() -> HiringBoardService:
    """Get or create the global hiring service instance"""
    global _hiring_service
    if _hiring_service is None:
        _hiring_service = HiringBoardService()
    return _hiring_service


def get_hiring_cache() -> HiringBoardCache:
    """Get the cache directly"""
    return get_hiring_service().cache
