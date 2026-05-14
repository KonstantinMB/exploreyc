"""
Perplexity API Service for real-time company research and intelligence
"""

import os
import logging
import requests
import json
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PerplexityService:
    """Service for interfacing with Perplexity AI API for company research"""

    def __init__(self):
        self.api_key = os.environ.get("PERPLEXITY_API_KEY")
        self.api_url = "https://api.perplexity.ai/chat/completions"
        self.model = "sonar-pro"  # Latest Perplexity model with web search

        if not self.api_key:
            logger.warning("PERPLEXITY_API_KEY not set - research features will be disabled")

    def is_enabled(self) -> bool:
        """Check if Perplexity API is configured"""
        return bool(self.api_key)

    def research_company(self, company_name: str) -> Optional[Dict[str, Any]]:
        """
        Research a company using Perplexity API

        Args:
            company_name: Name of the YC company to research

        Returns:
            Dict with research results including news, funding, key info
        """
        if not self.is_enabled():
            return None

        try:
            # Build detailed research query for comprehensive intelligence with structured data
            query = f"""Research {company_name} and provide a detailed intelligence report formatted for data extraction and visualization. Include these sections with SPECIFIC STRUCTURED DATA:

## COMPANY OVERVIEW
- What: [One sentence mission]
- Industry: [Industry/Sector]
- Founded: [Year]
- Location(s): [HQ + other offices]
- Y Combinator Batch: [Batch name/year if applicable]

## FUNDING ROUNDS (List each round separately, most recent first)
For EACH funding round include:
- Round: [Seed/Series A/Series B/etc]
- Amount Raised: $[Amount]
- Valuation: $[Valuation] at close
- Date: [Month Year]
- Lead Investor(s): [Names]
- Other Investors: [Names, separated by commas]
- Use of Funds: [Brief]

Also include:
- Total Capital Raised: $[Total amount to date]
- Burn Rate / Runway (if known): [Info]

## KEY METRICS & STATISTICS
- Team Size: [Number] employees
- Monthly Recurring Revenue (MRR): $[Amount] or [Not public]
- Annual Recurring Revenue (ARR): $[Amount] or [Not public]
- Customers/Users: [Number] or [Not public]
- Monthly Active Users (MAU): [Number] or [Not public]
- Customer Churn Rate: [Percentage] or [Not public]
- Average Deal Size: $[Amount] or [Not public]
- TAM (Total Addressable Market): $[Amount] or [Not public]
- Growth Rate: [Percentage] YoY or [Not public]

## LEADERSHIP & TEAM
- Founders: [Name, background/prior company, title]
- CEO: [Name, background]
- Other Key Hires (recent): [Name, title, background]
- Notable Team Members: [Expertise areas]

## PRODUCT & MARKET POSITION
- Product Description: [2-3 sentences]
- Primary Use Cases: [Main use cases]
- Target Customers: [Customer profile/segments]
- Key Competitors: [Names]
- Competitive Advantages: [Bullet points]
- Platform/Tech Stack: [Notable tech]

## RECENT DEVELOPMENTS & NEWS (Last 6 months)
- [Date] - [News item]
- [Date] - [Product update or achievement]

## PARTNERSHIPS & ENTERPRISE CUSTOMERS
- Strategic Partners: [Names]
- Notable Enterprise Customers: [Names if public]
- Integration Partners: [Names]

## UPCOMING & ANNOUNCED PLANS
- Next Product Milestone: [What]
- Expansion Plans: [Geographic, feature, or market]
- Known Fundraising Plans: [If announced]

Be extremely specific with numbers, dates, and names. Format data in a structured, easy-to-parse way. Use exact formatting with colons and dashes as shown above."""

            response = requests.post(
                self.api_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [
                        {
                            "role": "user",
                            "content": query
                        }
                    ],
                    "temperature": 0.2,  # Lower temperature for factual responses
                    "max_tokens": 1500,
                },
                timeout=30
            )

            if response.status_code == 200:
                data = response.json()

                # Extract response content
                if data.get("choices") and len(data["choices"]) > 0:
                    message_content = data["choices"][0].get("message", {}).get("content", "")

                    # Extract citations if available and ensure they are strings
                    citations = data.get("citations", [])
                    if not isinstance(citations, list):
                        citations = []
                    else:
                        # Deep copy and convert any non-string citations to strings
                        citations = [str(c) if not isinstance(c, str) else c for c in citations]

                    logger.info(f"Research successful for {company_name}. Citations type: {type(citations)}, count: {len(citations)}")

                    return {
                        "company_name": company_name,
                        "research": message_content,
                        "citations": citations,
                        "timestamp": datetime.utcnow().isoformat(),
                        "model": self.model,
                        "success": True
                    }
            else:
                logger.error(f"Perplexity API error: {response.status_code} - {response.text}")
                return {
                    "company_name": company_name,
                    "error": f"API returned status {response.status_code}",
                    "success": False
                }

        except requests.Timeout:
            logger.error(f"Perplexity API timeout while researching {company_name}")
            return {
                "company_name": company_name,
                "error": "Request timeout - Perplexity API took too long to respond",
                "success": False
            }
        except Exception as e:
            logger.error(f"Error researching company {company_name}: {str(e)}")
            return {
                "company_name": company_name,
                "error": str(e),
                "success": False
            }

    def research_market(self, query: str) -> Optional[Dict[str, Any]]:
        """
        Research market, industry, or custom topic

        Args:
            query: Research question/topic

        Returns:
            Dict with research results
        """
        if not self.is_enabled():
            return None

        try:
            full_query = f"""Provide accurate, recent information about: {query}

Focus on factual, current data. Include sources where available."""

            response = requests.post(
                self.api_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [
                        {
                            "role": "user",
                            "content": full_query
                        }
                    ],
                    "temperature": 0.2,
                    "max_tokens": 1500,
                },
                timeout=30
            )

            if response.status_code == 200:
                data = response.json()

                if data.get("choices") and len(data["choices"]) > 0:
                    message_content = data["choices"][0].get("message", {}).get("content", "")

                    # Extract citations and ensure they are strings
                    citations = data.get("citations", [])
                    if not isinstance(citations, list):
                        citations = []
                    # Convert any non-string citations to strings
                    citations = [str(c) if not isinstance(c, str) else c for c in citations]

                    return {
                        "query": query,
                        "research": message_content,
                        "citations": citations,
                        "timestamp": datetime.utcnow().isoformat(),
                        "model": self.model,
                        "success": True
                    }
            else:
                logger.error(f"Perplexity API error: {response.status_code} - {response.text}")
                return {
                    "query": query,
                    "error": f"API returned status {response.status_code}",
                    "success": False
                }

        except requests.Timeout:
            logger.error(f"Perplexity API timeout for query: {query}")
            return {
                "query": query,
                "error": "Request timeout",
                "success": False
            }
        except Exception as e:
            logger.error(f"Error researching topic {query}: {str(e)}")
            return {
                "query": query,
                "error": str(e),
                "success": False
            }


# Singleton instance
_perplexity_service = None

def get_perplexity_service() -> PerplexityService:
    """Get or create the Perplexity service singleton"""
    global _perplexity_service
    if _perplexity_service is None:
        _perplexity_service = PerplexityService()
    return _perplexity_service
