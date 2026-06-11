"""
Hiring Analytics Computation Module
Generates comprehensive analytics for the hiring board
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, timezone
from statistics import median, stdev

try:
    from currency_utils import infer_currency_from_job, job_salary_to_usd
except ImportError:
    # Fallback if currency_utils not available
    def infer_currency_from_job(job, company=None):
        return job.get("salary_currency", "USD")

    def job_salary_to_usd(job, company=None):
        min_sal = job.get("salary_min")
        max_sal = job.get("salary_max")
        if min_sal and max_sal:
            return (min_sal + max_sal) / 2
        return min_sal or max_sal or None

logger = logging.getLogger(__name__)


class HiringAnalyticsCompute:
    """Compute comprehensive hiring analytics"""

    def __init__(self, jobs: List[Dict[str, Any]], companies: List[Dict[str, Any]]):
        self.jobs = jobs
        self.companies = companies
        # Build company map with type safety for IDs
        self.company_map = {}
        for c in companies:
            company_id = c.get("id")
            # Ensure ID is a valid type (not a list)
            if isinstance(company_id, list):
                company_id = company_id[0] if company_id else None
            if company_id is not None:
                self.company_map[company_id] = c

    def compute_all(self) -> Dict[str, Any]:
        """Compute all analytics"""
        try:
            logger.info(f"Computing analytics: {len(self.jobs)} jobs, {len(self.companies)} companies, {len(self.company_map)} companies in map")

            result = {
                "totalJobs": len(self.jobs),
                "totalCompanies": len(self.companies),
            }

            logger.info("Computing salary stats...")
            result["avgSalary"] = self._compute_avg_salary()
            result["salaryMedian"] = self._compute_median_salary()
            result["jobsWithSalary"] = self._count_jobs_with_salary()
            result["jobsWithSalaryPercentage"] = self._salary_percentage()
            result["topPayingCompanies"] = self._top_paying_companies(limit=10)
            result["highestPayingRoles"] = self._highest_paying_roles(limit=10)

            logger.info("Computing role and distribution stats...")
            result["salaryByRole"] = self._salary_by_role()
            result["roleDistribution"] = self._role_distribution()

            logger.info("Computing batch and company stats...")
            result["topBatches"] = self._top_batches(limit=10)
            result["topHiringCompanies"] = self._top_hiring_companies(limit=10)

            logger.info("Computing location and job type stats...")
            result["locationBreakdown"] = self._location_breakdown(limit=15)
            result["jobTypeBreakdown"] = self._job_type_breakdown()

            logger.info("Computing experience levels and remote stats...")
            result["experienceLevels"] = self._experience_levels()
            result["remoteStats"] = self._remote_stats()

            logger.info("Computing early stage and industry stats...")
            result["earlyStageStats"] = self._early_stage_stats()
            result["industryVerticals"] = self._industry_verticals()

            result["lastUpdated"] = datetime.now(timezone.utc).isoformat()

            logger.info(f"✅ Analytics computation completed successfully")
            return result

        except Exception as e:
            logger.error(f"❌ Error computing analytics: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {}

    def _compute_avg_salary(self) -> Optional[float]:
        """Compute average salary in USD across all jobs with salary data.

        Non-USD salaries are converted to USD via static rates (see
        currency_utils.EXCHANGE_RATES) rather than dropped — otherwise jobs in
        e.g. INR were either skipped (analytics) or treated as USD (service
        layer), both wrong.
        """
        salaries = []
        for job in self.jobs:
            usd = job_salary_to_usd(job, self.company_map.get(job.get("company_id")))
            if usd is not None:
                salaries.append(usd)
        return round(sum(salaries) / len(salaries)) if salaries else None

    def _compute_median_salary(self) -> Optional[float]:
        """Compute median salary (USD-normalized) across all jobs with salary data."""
        salaries = []
        for job in self.jobs:
            usd = job_salary_to_usd(job, self.company_map.get(job.get("company_id")))
            if usd is not None:
                salaries.append(usd)
        return round(median(salaries)) if salaries else None

    def _count_jobs_with_salary(self) -> int:
        """Count jobs that have salary data"""
        count = 0
        for job in self.jobs:
            if job.get("salary_min") or job.get("salary_max"):
                count += 1
        return count

    def _salary_percentage(self) -> float:
        """Get percentage of jobs with salary data"""
        if not self.jobs:
            return 0
        return round((self._count_jobs_with_salary() / len(self.jobs)) * 100, 1)

    def _salary_by_role(self) -> List[Dict[str, Any]]:
        """Get salary statistics broken down by role (USD-normalized)"""
        role_salaries: Dict[str, List[float]] = {}

        for job in self.jobs:
            usd = job_salary_to_usd(job, self.company_map.get(job.get("company_id")))
            if usd is None:
                continue

            role = job.get("pretty_role", "Other")
            # Ensure role is a string
            if isinstance(role, list):
                role = role[0] if role else "Other"
            role = str(role) if role else "Other"

            if role not in role_salaries:
                role_salaries[role] = []
            role_salaries[role].append(usd)

        result = []
        for role, salaries in role_salaries.items():
            if salaries:
                result.append({
                    "role": role,
                    "avg": round(sum(salaries) / len(salaries)),
                    "min": min(salaries),
                    "max": max(salaries),
                    "median": round(median(salaries)),
                    "count": len(salaries),
                    "jobsWithSalary": len(salaries),
                })

        return sorted(result, key=lambda x: x["avg"], reverse=True)

    def _role_distribution(self) -> List[Dict[str, Any]]:
        """Get distribution of job roles"""
        role_counts: Dict[str, int] = {}

        for job in self.jobs:
            role = job.get("pretty_role", "Other")
            # Ensure role is a string
            if isinstance(role, list):
                role = role[0] if role else "Other"
            role = str(role) if role else "Other"
            role_counts[role] = role_counts.get(role, 0) + 1

        total = len(self.jobs)
        result = [
            {
                "role": role,
                "count": count,
                "percentage": round((count / total) * 100, 1),
            }
            for role, count in role_counts.items()
        ]
        return sorted(result, key=lambda x: x["count"], reverse=True)

    def _top_batches(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get top YC batches by job count"""
        batch_counts: Dict[str, int] = {}
        batch_companies: Dict[str, set] = {}

        for job in self.jobs:
            company_id = job.get("company_id")
            # Ensure company_id is not a list before using as set key
            if isinstance(company_id, list):
                company_id = company_id[0] if company_id else None

            company = self.company_map.get(company_id)
            if company:
                batch = company.get("batch", "Unknown")
                # Ensure batch is a string
                if isinstance(batch, list):
                    batch = batch[0] if batch else "Unknown"
                batch = str(batch) if batch else "Unknown"
                batch_counts[batch] = batch_counts.get(batch, 0) + 1
                if batch not in batch_companies:
                    batch_companies[batch] = set()
                if company_id is not None:
                    batch_companies[batch].add(company_id)

        result = [
            {
                "batch": batch,
                "count": count,
                "companies": len(batch_companies.get(batch, set())),
            }
            for batch, count in batch_counts.items()
        ]
        return sorted(result, key=lambda x: x["count"], reverse=True)[:limit]

    def _top_hiring_companies(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get companies hiring the most positions"""
        company_job_counts: Dict[int, int] = {}

        for job in self.jobs:
            company_id = job.get("company_id")
            # Ensure company_id is not a list before using as dict key
            if isinstance(company_id, list):
                company_id = company_id[0] if company_id else None
            if company_id is not None:
                company_job_counts[company_id] = company_job_counts.get(company_id, 0) + 1

        result = []
        for company_id, count in sorted(company_job_counts.items(), key=lambda x: x[1], reverse=True)[:limit]:
            company = self.company_map.get(company_id)
            if company:
                batch = company.get("batch", "")
                # Ensure batch is a string
                if isinstance(batch, list):
                    batch = batch[0] if batch else ""
                batch = str(batch) if batch else ""

                result.append({
                    "id": company_id,
                    "name": company.get("name"),
                    "logo_url": company.get("logo_url"),
                    "small_logo_url": company.get("small_logo_url"),
                    "logo_path": company.get("logo_path"),
                    "jobCount": count,
                    "batch": batch,
                    "slug": company.get("slug"),
                })

        return result

    def _location_breakdown(self, limit: int = 15) -> List[Dict[str, Any]]:
        """Get job locations breakdown"""
        location_counts: Dict[str, int] = {}
        remote_counts: Dict[str, int] = {}

        for job in self.jobs:
            locations = job.get("locations", [])
            # Ensure locations is a list (in case it comes as JSON string)
            if isinstance(locations, str):
                try:
                    import json
                    locations = json.loads(locations)
                except:
                    locations = []
            if not isinstance(locations, list):
                locations = []

            remote = job.get("remote", "no").lower() == "yes"

            for location in locations:
                # Ensure location is a string (API sometimes returns lists)
                if isinstance(location, list):
                    location = location[0] if location else None
                location = str(location) if location else None

                if location:
                    location_counts[location] = location_counts.get(location, 0) + 1
                    if remote:
                        remote_counts[location] = remote_counts.get(location, 0) + 1

        total_jobs = len(self.jobs)
        result = [
            {
                "location": location,
                "count": count,
                "percentage": round((count / total_jobs) * 100, 1),
                "remoteCount": remote_counts.get(location, 0),
            }
            for location, count in location_counts.items()
        ]
        return sorted(result, key=lambda x: x["count"], reverse=True)[:limit]

    def _job_type_breakdown(self) -> List[Dict[str, Any]]:
        """Get breakdown of job types"""
        job_type_counts: Dict[str, int] = {}

        for job in self.jobs:
            job_type = job.get("pretty_job_type", job.get("job_type", "Unknown"))
            # Ensure job_type is a string
            if isinstance(job_type, list):
                job_type = job_type[0] if job_type else "Unknown"
            job_type = str(job_type) if job_type else "Unknown"
            job_type_counts[job_type] = job_type_counts.get(job_type, 0) + 1

        total = len(self.jobs)
        result = [
            {
                "type": job_type,
                "count": count,
                "percentage": round((count / total) * 100, 1),
            }
            for job_type, count in job_type_counts.items()
        ]
        return sorted(result, key=lambda x: x["count"], reverse=True)

    def _experience_levels(self) -> List[Dict[str, Any]]:
        """Get breakdown of experience levels"""
        exp_counts: Dict[str, int] = {}

        for job in self.jobs:
            exp = job.get("pretty_min_experience", "Not specified")
            # Ensure exp is a string
            if isinstance(exp, list):
                exp = exp[0] if exp else "Not specified"
            exp = str(exp) if exp else "Not specified"
            exp_counts[exp] = exp_counts.get(exp, 0) + 1

        total = len(self.jobs)
        result = [
            {
                "level": exp,
                "count": count,
                "percentage": round((count / total) * 100, 1),
            }
            for exp, count in exp_counts.items()
        ]
        return sorted(result, key=lambda x: x["count"], reverse=True)

    def _remote_stats(self) -> Dict[str, Any]:
        """Get remote vs on-site statistics"""
        remote_count = 0
        onsite_count = 0
        mixed_count = 0

        for job in self.jobs:
            remote = job.get("remote", "no").lower()
            if remote == "yes":
                remote_count += 1
            elif remote == "no":
                onsite_count += 1
            else:
                mixed_count += 1

        total = len(self.jobs)
        return {
            "remote": remote_count,
            "remotePercentage": round((remote_count / total) * 100, 1) if total else 0,
            "onsite": onsite_count,
            "onsitePercentage": round((onsite_count / total) * 100, 1) if total else 0,
            "mixed": mixed_count,
            "mixedPercentage": round((mixed_count / total) * 100, 1) if total else 0,
        }

    def _early_stage_stats(self) -> Dict[str, Any]:
        """Get early-stage vs growth-stage hiring stats"""
        early_stage_companies = set()
        early_stage_jobs = 0
        growth_stage_jobs = 0

        # Early stage = W25, W24, S24 batches (last ~1 year)
        early_batches = {"W25", "W24", "S24", "S23"}

        for job in self.jobs:
            company_id = job.get("company_id")
            # Ensure company_id is not a list before using as set key
            if isinstance(company_id, list):
                company_id = company_id[0] if company_id else None

            company = self.company_map.get(company_id)
            if company:
                batch = company.get("batch", "")
                # Ensure batch is a string
                if isinstance(batch, list):
                    batch = batch[0] if batch else ""
                batch = str(batch) if batch else ""

                # Check if batch is in early stage
                is_early = any(batch.startswith(b) for b in ["W25", "W24", "S24", "S23"])

                if is_early:
                    if company_id is not None:
                        early_stage_companies.add(company_id)
                    early_stage_jobs += 1
                else:
                    growth_stage_jobs += 1

        total_companies = len(self.companies)
        return {
            "earlyStageCompanies": len(early_stage_companies),
            "earlyStagePercentage": round((len(early_stage_companies) / total_companies) * 100, 1) if total_companies else 0,
            "earlyStageJobs": early_stage_jobs,
            "growthStageCompanies": total_companies - len(early_stage_companies),
            "growthStageJobs": growth_stage_jobs,
        }

    def _industry_verticals(self) -> List[Dict[str, Any]]:
        """Get distribution of industry verticals"""
        vertical_counts: Dict[str, int] = {}

        for company in self.companies:
            vertical = company.get("primary_vertical", "Other")
            # Ensure vertical is a string
            if isinstance(vertical, list):
                vertical = vertical[0] if vertical else "Other"
            vertical = str(vertical) if vertical else "Other"
            vertical_counts[vertical] = vertical_counts.get(vertical, 0) + 1

        # Count jobs per vertical
        job_vertical_counts: Dict[str, int] = {}
        for job in self.jobs:
            company_id = job.get("company_id")
            company = self.company_map.get(company_id)
            if company:
                vertical = company.get("primary_vertical", "Other")
                # Ensure vertical is a string
                if isinstance(vertical, list):
                    vertical = vertical[0] if vertical else "Other"
                vertical = str(vertical) if vertical else "Other"
                job_vertical_counts[vertical] = job_vertical_counts.get(vertical, 0) + 1

        total_jobs = len(self.jobs)
        result = [
            {
                "vertical": vertical,
                "count": job_vertical_counts.get(vertical, 0),
                "percentage": round((job_vertical_counts.get(vertical, 0) / total_jobs) * 100, 1) if total_jobs else 0,
            }
            for vertical in vertical_counts.keys()
        ]
        return sorted(result, key=lambda x: x["count"], reverse=True)[:15]

    def _top_paying_companies(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get companies with highest average salary (USD-normalized)"""
        company_salaries: Dict[int, List[float]] = {}

        for job in self.jobs:
            company_id = job.get("company_id")
            # Ensure company_id is not a list
            if isinstance(company_id, list):
                company_id = company_id[0] if company_id else None
            if company_id is None:
                continue

            usd = job_salary_to_usd(job, self.company_map.get(company_id))
            if usd is None:
                continue

            if company_id not in company_salaries:
                company_salaries[company_id] = []
            company_salaries[company_id].append(usd)

        result = []
        for company_id, salaries in company_salaries.items():
            if salaries:
                avg_salary = sum(salaries) / len(salaries)
                company = self.company_map.get(company_id)
                if company:
                    result.append({
                        "id": company_id,
                        "name": company.get("name"),
                        "avgSalary": round(avg_salary),
                        "jobCount": len(salaries),
                        "batch": company.get("batch"),
                        "slug": company.get("slug"),
                    })

        return sorted(result, key=lambda x: x["avgSalary"], reverse=True)[:limit]

    def _highest_paying_roles(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get roles with highest average salary (USD-normalized)"""
        role_salaries: Dict[str, List[float]] = {}

        for job in self.jobs:
            usd = job_salary_to_usd(job, self.company_map.get(job.get("company_id")))
            if usd is None:
                continue

            role = job.get("pretty_role", "Other")
            # Ensure role is a string
            if isinstance(role, list):
                role = role[0] if role else "Other"
            role = str(role) if role else "Other"

            if role not in role_salaries:
                role_salaries[role] = []
            role_salaries[role].append(usd)

        result = []
        for role, salaries in role_salaries.items():
            if salaries:
                avg_salary = sum(salaries) / len(salaries)
                result.append({
                    "role": role,
                    "avgSalary": round(avg_salary),
                    "minSalary": round(min(salaries)),
                    "maxSalary": round(max(salaries)),
                    "jobCount": len(salaries),
                })

        return sorted(result, key=lambda x: x["avgSalary"], reverse=True)[:limit]
