"""
Scraper service for background job processing
"""

import asyncio
import requests
import json
from typing import Dict, Optional, List, Callable
from urllib.parse import urlencode
from database import Database
from enhanced_geocoding import EXTENDED_LOCATION_COORDS


class ScraperService:
    """Service to handle background scraping jobs"""

    ALGOLIA_URL = "https://45bwzj1sgc-dsn.algolia.net/1/indexes/*/queries"
    APP_ID = "45BWZJ1SGC"
    API_KEY = "NzllNTY5MzJiZGM2OTY2ZTQwMDEzOTNhYWZiZGRjODlhYzVkNjBmOGRjNzJiMWM4ZTU0ZDlhYTZjOTJiMjlhMWFuYWx5dGljc1RhZ3M9eWNkYyZyZXN0cmljdEluZGljZXM9WUNDb21wYW55X3Byb2R1Y3Rpb24lMkNZQ0NvbXBhbnlfQnlfTGF1bmNoX0RhdGVfcHJvZHVjdGlvbiZ0YWdGaWx0ZXJzPSU1QiUyMnljZGNfcHVibGljJTIyJTVE"

    # Use enhanced geocoding database with 150+ cities worldwide
    LOCATION_COORDS = EXTENDED_LOCATION_COORDS

    def __init__(self, db: Database):
        self.db = db
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': 'https://www.ycombinator.com',
            'Referer': 'https://www.ycombinator.com/'
        })

    def _build_facet_filters(self, filters: Dict[str, List[str]]) -> List:
        """Build facet filters for Algolia query"""
        facet_filters = []
        for key, values in filters.items():
            if values:
                facet_filters.append([f"{key}:{value}" for value in values])
        return facet_filters

    def _geocode_location(self, location: str) -> Optional[Dict]:
        """Simple geocoding using predefined coordinates"""
        if not location:
            return None

        location = location.strip()

        # Try exact match
        if location in self.LOCATION_COORDS:
            return self.LOCATION_COORDS[location]

        # Try partial match
        for city, coords in self.LOCATION_COORDS.items():
            if city.lower() in location.lower():
                return coords

        return None

    def _enrich_company_data(self, company: Dict) -> Dict:
        """Enrich company data with geocoding"""
        location = company.get('all_locations', '')

        if location:
            coords = self._geocode_location(location)
            if coords:
                company['latitude'] = coords['lat']
                company['longitude'] = coords['lng']
                company['country'] = coords['country']

        return company

    async def scrape_companies(self,
                             job_id: int,
                             query: str = "",
                             batch: Optional[List[str]] = None,
                             industry: Optional[List[str]] = None,
                             region: Optional[List[str]] = None,
                             is_hiring: Optional[bool] = None,
                             top_company: Optional[bool] = None,
                             nonprofit: Optional[bool] = None,
                             hits_per_page: int = 1000,
                             max_pages: int = 10,
                             progress_callback: Optional[Callable] = None) -> int:
        """
        Scrape YC companies with filters (async)
        """

        try:
            # Build facet filters
            filters = {}
            if batch:
                filters['batch'] = batch
            if industry:
                filters['industries'] = industry
            if region:
                filters['regions'] = region
            if is_hiring is not None:
                filters['isHiring'] = [str(is_hiring).lower()]
            if top_company is not None:
                filters['top_company'] = [str(top_company).lower()]
            if nonprofit is not None:
                filters['nonprofit'] = [str(nonprofit).lower()]

            facet_filters = self._build_facet_filters(filters)

            total_scraped = 0
            page = 0

            while page < max_pages:
                # Build request payload
                params = {
                    'facetFilters': json.dumps(facet_filters) if facet_filters else '',
                    'facets': json.dumps([
                        "app_answers", "app_video_public", "batch", "demo_day_video_public",
                        "industries", "isHiring", "nonprofit", "question_answers",
                        "regions", "subindustry", "top_company"
                    ]),
                    'hitsPerPage': hits_per_page,
                    'maxValuesPerFacet': 1000,
                    'page': page,
                    'query': query,
                    'tagFilters': '',
                    'analyticsTags': 'ycdc',
                    'restrictIndices': 'YCCompany_production,YCCompany_By_Launch_Date_production',
                    'tagFilters': '["ycdc_public"]'
                }

                # Build request body
                request_body = {
                    "requests": [
                        {
                            "indexName": "YCCompany_production",
                            "params": urlencode(params)
                        }
                    ]
                }

                # Make request
                url = f"{self.ALGOLIA_URL}?x-algolia-agent=Algolia%20for%20JavaScript%20(3.35.1)&x-algolia-application-id={self.APP_ID}&x-algolia-api-key={self.API_KEY}"

                # Run in thread pool to not block async
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None,
                    lambda: self.session.post(url, json=request_body)
                )
                response.raise_for_status()
                data = response.json()

                if not data.get('results') or not data['results']:
                    break

                result = data['results'][0]
                hits = result.get('hits', [])

                if not hits:
                    break

                # Insert companies into database with change tracking
                for company in hits:
                    # Enrich with geocoding
                    enriched_company = self._enrich_company_data(company)

                    # Check if company exists and track changes
                    company_id = enriched_company.get('id')
                    if company_id:
                        existing = self.db.get_company_by_id(company_id)

                        # Insert/update company
                        self.db.insert_company(enriched_company)

                        # Track changes
                        if existing is None:
                            # New company created
                            self.db.log_change(
                                company_id=company_id,
                                change_type='created',
                                new_value=enriched_company.get('name')
                            )
                        else:
                            # Check for hiring status changes
                            old_hiring = existing.get('is_hiring')
                            new_hiring = enriched_company.get('isHiring')

                            if old_hiring != new_hiring:
                                if new_hiring:
                                    self.db.log_change(
                                        company_id=company_id,
                                        change_type='hiring_started',
                                        field_name='is_hiring',
                                        old_value='false',
                                        new_value='true'
                                    )
                                else:
                                    self.db.log_change(
                                        company_id=company_id,
                                        change_type='hiring_stopped',
                                        field_name='is_hiring',
                                        old_value='true',
                                        new_value='false'
                                    )

                            # Check for batch changes
                            old_batch = existing.get('batch')
                            new_batch = enriched_company.get('batch')

                            if old_batch and new_batch and old_batch != new_batch:
                                self.db.log_change(
                                    company_id=company_id,
                                    change_type='batch_changed',
                                    field_name='batch',
                                    old_value=old_batch,
                                    new_value=new_batch
                                )
                    else:
                        # No ID, just insert
                        self.db.insert_company(enriched_company)

                    total_scraped += 1

                # Update job status
                self.db.update_scrape_job(job_id, 'running', total_scraped, page + 1)

                # Call progress callback if provided
                if progress_callback:
                    await progress_callback({
                        'job_id': job_id,
                        'status': 'running',
                        'total_scraped': total_scraped,
                        'current_page': page + 1
                    })

                # Check if there are more pages (continue until we get fewer results than requested)
                # Don't rely on nbPages as YC API seems to return incorrect values
                if len(hits) < hits_per_page:
                    # Got fewer results than requested, we've reached the end
                    break

                page += 1

                # Small delay to be nice to the API
                await asyncio.sleep(0.5)

            # Mark job as completed
            self.db.update_scrape_job(job_id, 'completed', total_scraped, page)

            if progress_callback:
                await progress_callback({
                    'job_id': job_id,
                    'status': 'completed',
                    'total_scraped': total_scraped,
                    'current_page': page
                })

            return total_scraped

        except Exception as e:
            # Mark job as failed
            self.db.update_scrape_job(job_id, 'failed', total_scraped, page, str(e))

            if progress_callback:
                await progress_callback({
                    'job_id': job_id,
                    'status': 'failed',
                    'error': str(e),
                    'total_scraped': total_scraped,
                    'current_page': page
                })

            raise e
