"""
Coresignal API integration for funding and employee data
Documentation: https://docs.coresignal.com/
"""

import os
import logging
import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import httpx

logger = logging.getLogger(__name__)


class CoresignalService:
    """Fetch funding and employee data from Coresignal API"""

    def __init__(self):
        self.api_key = os.environ.get("CORESIGNAL_API_KEY")
        self.base_url = "https://api.coresignal.com/cdapi/v2"
        self.enabled = bool(self.api_key)

        # Use Multi-source API for comprehensive funding data
        self.use_multi_source = True

        if not self.enabled:
            logger.warning("CORESIGNAL_API_KEY not set - funding data features disabled")
        else:
            logger.info("Coresignal service initialized with Multi-source API for funding data")

    async def search_company(self, company_name: str, website: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Search for a company using Coresignal APIs

        Strategy:
        1. If website provided: use Multi-source /enrich endpoint (best for funding data)
        2. Otherwise: use Base Company API /search/filter then fetch Multi-source data

        Args:
            company_name: Company name to search for
            website: Optional website domain to improve matching

        Returns:
            Company data dict or None if not found
        """
        if not self.enabled:
            return None

        try:
            async with httpx.AsyncClient() as client:
                # Extract domain from website if provided
                domain = None
                if website:
                    domain = website.replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0]

                headers = {
                    "apikey": self.api_key,
                    "Content-Type": "application/json"
                }

                # Strategy 1: Use Multi-source enrich endpoint if we have a website
                if domain and self.use_multi_source:
                    logger.info(f"Using Multi-source enrich API for {company_name} with website {domain}")
                    response = await client.get(
                        f"{self.base_url}/company_multi_source/enrich",
                        params={"website": domain},
                        headers=headers,
                        timeout=15.0
                    )

                    if response.status_code == 200:
                        data = response.json()
                        all_keys = list(data.keys())
                        logger.info(f"✅ Multi-source enrich success for {company_name}")
                        logger.info(f"   Total fields: {len(all_keys)}")
                        logger.info(f"   All keys: {all_keys}")

                        # Log funding-specific fields if present
                        funding_keys = [k for k in all_keys if 'funding' in k.lower() or 'investor' in k.lower()]
                        if funding_keys:
                            logger.info(f"   Funding fields found: {funding_keys}")
                        else:
                            logger.warning(f"   ⚠️ No funding fields in response")

                        return data
                    elif response.status_code == 404:
                        logger.info(f"No Multi-source data found for {domain}, falling back to Base API search")
                        # Fall through to Base API search
                    elif response.status_code == 401:
                        logger.error("Coresignal API authentication failed - check API key")
                        raise Exception("CORESIGNAL_AUTH_FAILED: Invalid or missing API key")
                    else:
                        logger.warning(f"Multi-source enrich error {response.status_code}: {response.text}")
                        # Fall through to Base API search

                # Strategy 2: Use Base Company API search/filter
                logger.info(f"Using Base Company API search for {company_name}")
                request_body = {"name": company_name}
                if domain:
                    request_body["website"] = domain

                response = await client.post(
                    f"{self.base_url}/company_base/search/filter",
                    json=request_body,
                    headers=headers,
                    timeout=15.0
                )

                if response.status_code == 200:
                    data = response.json()
                    logger.info(f"Base API response for {company_name}: {type(data)} with {len(data) if isinstance(data, (list, dict)) else 0} items")

                    # Coresignal returns an array of results
                    if isinstance(data, list) and len(data) > 0:
                        logger.info(f"Found {len(data)} matches for {company_name}")

                        # Check if we got IDs or full objects
                        if isinstance(data[0], int):
                            # We got company IDs, fetch full data from Multi-source API if enabled
                            company_id = data[0]
                            logger.info(f"Response contains ID: {company_id}, fetching Multi-source data")
                            if self.use_multi_source:
                                return await self.get_company_details_multi_source(company_id)
                            else:
                                return await self.get_company_details_base(company_id)
                        elif isinstance(data[0], dict):
                            # We got full company objects from Base API
                            logger.info(f"Response contains full object with keys: {list(data[0].keys())}")
                            # If using Multi-source and we have an ID, fetch from Multi-source for funding data
                            if self.use_multi_source and data[0].get('id'):
                                logger.info(f"Fetching Multi-source data for ID {data[0]['id']}")
                                multi_data = await self.get_company_details_multi_source(data[0]['id'])
                                return multi_data if multi_data else data[0]
                            return data[0]

                    logger.warning(f"No Coresignal match found for {company_name}")
                    return None
                elif response.status_code == 401:
                    logger.error("Coresignal API authentication failed - check API key")
                    raise Exception("CORESIGNAL_AUTH_FAILED: Invalid or missing API key")
                elif response.status_code == 429:
                    logger.warning(f"Coresignal rate limit hit for {company_name}")
                    return None
                else:
                    logger.error(f"Coresignal API error {response.status_code} for {company_name}: {response.text}")
                    return None

        except httpx.TimeoutException:
            logger.warning(f"Coresignal API timeout for {company_name}")
            return None
        except Exception as e:
            logger.error(f"Coresignal API error for {company_name}: {e}")
            return None

    async def get_company_details_multi_source(self, company_id: int) -> Optional[Dict[str, Any]]:
        """
        Get detailed company information from Coresignal Multi-source Company API
        This API includes comprehensive funding data

        Args:
            company_id: Coresignal company ID

        Returns:
            Detailed company data with funding information or None
        """
        if not self.enabled:
            return None

        try:
            async with httpx.AsyncClient() as client:
                headers = {
                    "apikey": self.api_key,
                    "Content-Type": "application/json"
                }

                response = await client.get(
                    f"{self.base_url}/company_multi_source/collect/{company_id}",
                    headers=headers,
                    timeout=15.0
                )

                if response.status_code == 200:
                    data = response.json()
                    logger.info(f"✅ Multi-source collect success for ID {company_id}: {list(data.keys())[:15]}")
                    return data
                elif response.status_code == 404:
                    logger.warning(f"No Multi-source data for ID {company_id}")
                    return None
                else:
                    logger.error(f"Failed to get Multi-source company details for ID {company_id}: {response.status_code} - {response.text}")
                    return None

        except Exception as e:
            logger.error(f"Error getting Multi-source company details for ID {company_id}: {e}")
            return None

    async def get_company_details_base(self, company_id: int) -> Optional[Dict[str, Any]]:
        """
        Get detailed company information from Coresignal Base Company API
        Note: Base API has limited funding data compared to Multi-source

        Args:
            company_id: Coresignal company ID

        Returns:
            Detailed company data or None
        """
        if not self.enabled:
            return None

        try:
            async with httpx.AsyncClient() as client:
                headers = {
                    "apikey": self.api_key,
                    "Content-Type": "application/json"
                }

                response = await client.get(
                    f"{self.base_url}/company_base/collect/{company_id}",
                    headers=headers,
                    timeout=15.0
                )

                if response.status_code == 200:
                    return response.json()
                else:
                    logger.error(f"Failed to get Base company details for ID {company_id}: {response.status_code} - {response.text}")
                    return None

        except Exception as e:
            logger.error(f"Error getting Base company details for ID {company_id}: {e}")
            return None

    def parse_funding_data(self, company_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse Coresignal company data and extract funding information

        Supports both Multi-source API format (funding_rounds array) and
        Base API format (company_funding_rounds_collection)

        Args:
            company_data: Raw company data from Coresignal API

        Returns:
            Parsed funding data dict with standardized fields
        """
        try:
            # Debug: Log funding field values
            logger.info(f"DEBUG parse_funding_data:")
            logger.info(f"  funding_rounds: {company_data.get('funding_rounds')}")
            logger.info(f"  last_funding_round_name: {company_data.get('last_funding_round_name')}")
            logger.info(f"  last_funding_round_amount_raised: {company_data.get('last_funding_round_amount_raised')}")
            logger.info(f"  last_funding_round_announced_date: {company_data.get('last_funding_round_announced_date')}")

            # Try Multi-source API format first (comprehensive funding data)
            funding_rounds = company_data.get("funding_rounds", []) or []

            # If no funding_rounds, try Base API format
            if not funding_rounds:
                base_funding = company_data.get("company_funding_rounds_collection", [])
                if base_funding and len(base_funding) > 0:
                    # Convert Base API format to Multi-source format
                    logger.info("Converting Base API funding format to standard format")
                    # Base API only has last round info, so create a single funding round
                    last_round_data = base_funding[0]
                    if last_round_data.get("last_round_type"):
                        funding_rounds = [{
                            "name": last_round_data.get("last_round_type"),
                            "announced_date": last_round_data.get("last_round_date", "").split(" ")[0] if last_round_data.get("last_round_date") else None,
                            "amount_raised": None,  # Base API doesn't provide structured amount
                            "lead_investors": [],
                            "num_investors": last_round_data.get("last_round_investors_count", 0)
                        }]

            # Calculate total funding from Multi-source data
            total_funding = 0
            for round_data in funding_rounds:
                amount = round_data.get("amount_raised", 0)
                if amount:
                    try:
                        total_funding += float(amount)
                    except (ValueError, TypeError):
                        pass

            # Get last funding round
            last_round = None
            last_round_date = None
            last_round_name = None
            last_round_amount = None

            # Try Multi-source API format
            if company_data.get("last_funding_round_name"):
                last_round_name = company_data.get("last_funding_round_name")
                last_round_date = company_data.get("last_funding_round_announced_date")
                last_round_amount = company_data.get("last_funding_round_amount_raised")
            elif funding_rounds:
                # Sort by date to get most recent
                sorted_rounds = sorted(
                    funding_rounds,
                    key=lambda x: x.get("announced_date", ""),
                    reverse=True
                )
                if sorted_rounds:
                    last_round = sorted_rounds[0]
                    last_round_date = last_round.get("announced_date")
                    last_round_name = last_round.get("name")
                    last_round_amount = last_round.get("amount_raised")

            # Extract investors from Multi-source data
            investors = set()

            # Try Multi-source last_funding_round_lead_investors
            if company_data.get("last_funding_round_lead_investors"):
                for investor in company_data.get("last_funding_round_lead_investors", []):
                    if isinstance(investor, str):
                        investors.add(investor)

            # Also collect from funding_rounds array
            for round_data in funding_rounds:
                round_investors = round_data.get("lead_investors", []) or []
                for investor in round_investors:
                    if isinstance(investor, str):
                        investors.add(investor)
                    elif isinstance(investor, dict):
                        investors.add(investor.get("name", ""))

            investors = [inv for inv in investors if inv]  # Remove empty strings

            # Get employee data
            employee_count = company_data.get("size", company_data.get("employee_count"))

            # Calculate employee growth (if historical data available)
            employee_growth_6m = None
            employee_history = company_data.get("employee_growth", {})
            if isinstance(employee_history, dict):
                # Calculate 6-month growth if available
                current = employee_history.get("current")
                six_months_ago = employee_history.get("six_months_ago")
                if current and six_months_ago and six_months_ago > 0:
                    employee_growth_6m = ((current - six_months_ago) / six_months_ago) * 100

            return {
                "funding_total_usd": total_funding if total_funding > 0 else None,
                "funding_last_round_usd": last_round_amount,
                "funding_last_round_date": last_round_date,
                "funding_last_round_name": last_round_name,
                "funding_rounds_count": len(funding_rounds) if funding_rounds else None,
                "investors": investors,
                "investors_count": len(investors) if investors else None,
                "valuation_usd": None,  # Not available in current API
                "employee_count": employee_count,
                "employee_growth_6m": employee_growth_6m,
                "coresignal_last_updated": datetime.utcnow().isoformat(),
                "coresignal_company_id": company_data.get("id")
            }

        except Exception as e:
            logger.error(f"Error parsing Coresignal data: {e}")
            return {}

    async def enrich_company(self, company_name: str, website: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Search for a company and get its funding data

        Args:
            company_name: Company name
            website: Optional website for better matching

        Returns:
            Parsed funding data or None
        """
        if not self.enabled:
            return None

        try:
            # Search for company (this now handles fetching full data if needed)
            logger.info(f"Searching Coresignal for: {company_name}")
            company_data = await self.search_company(company_name, website)

            if not company_data:
                logger.warning(f"No search results for {company_name}")
                return None

            if not isinstance(company_data, dict):
                logger.error(f"Invalid company_data type for {company_name}: {type(company_data)}")
                return None

            logger.info(f"Found company data for {company_name}, keys: {list(company_data.keys())[:10]}")

            # Parse and return funding data
            logger.info(f"Parsing funding data for {company_name}")
            funding_data = self.parse_funding_data(company_data)

            if funding_data and (funding_data.get("funding_total_usd") or funding_data.get("funding_last_round_name")):
                if funding_data.get("funding_total_usd"):
                    logger.info(f"✅ Successfully parsed funding for {company_name}: ${funding_data.get('funding_total_usd'):,.0f}")
                else:
                    logger.info(f"✅ Found funding info for {company_name}: {funding_data.get('funding_last_round_name')}")
            else:
                logger.warning(f"⚠️ No funding data found in parsed result for {company_name}")

            return funding_data

        except Exception as e:
            logger.error(f"Error enriching company {company_name}: {e}", exc_info=True)
            return None

    async def enrich_companies_batch(
        self,
        companies: List[Dict[str, Any]],
        delay_between_requests: float = 0.5
    ) -> List[Dict[str, Any]]:
        """
        Enrich multiple companies with rate limiting

        Args:
            companies: List of company dicts with 'name' and optionally 'website'
            delay_between_requests: Delay in seconds between API calls

        Returns:
            List of enriched company data dicts (same order as input)
        """
        results = []

        for company in companies:
            name = company.get("name")
            website = company.get("website")

            if not name:
                results.append(None)
                continue

            logger.info(f"Enriching company: {name}")
            funding_data = await self.enrich_company(name, website)
            results.append(funding_data)

            # Rate limiting
            if delay_between_requests > 0:
                await asyncio.sleep(delay_between_requests)

        return results

    def should_refresh(self, last_updated: Optional[str], days: int = 30) -> bool:
        """
        Check if company data should be refreshed

        Args:
            last_updated: ISO timestamp of last update
            days: Number of days before refresh is needed

        Returns:
            True if refresh is needed
        """
        if not last_updated:
            return True

        try:
            last_update_date = datetime.fromisoformat(last_updated.replace('Z', '+00:00'))
            age = datetime.utcnow() - last_update_date
            return age > timedelta(days=days)
        except (ValueError, AttributeError):
            return True


# Singleton instance
coresignal_service = CoresignalService()
