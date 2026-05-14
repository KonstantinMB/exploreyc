#!/usr/bin/env python3
"""
Bulk enrich YC companies with funding data from Coresignal

Usage:
    python scripts/bulk_enrich_funding.py --limit 100
    python scripts/bulk_enrich_funding.py --batch W25
    python scripts/bulk_enrich_funding.py --top-companies
    python scripts/bulk_enrich_funding.py --company-ids 123,456,789
"""

import os
import sys
import time
import argparse
import requests
from typing import List, Optional

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from database_factory import get_database


def enrich_company(backend_url: str, company_id: int) -> dict:
    """Enrich a single company via API endpoint"""
    try:
        response = requests.post(
            f"{backend_url}/api/admin/enrich-funding/{company_id}",
            timeout=30
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return {"success": False, "error": str(e)}


def get_companies_to_enrich(
    batch: Optional[str] = None,
    limit: int = 100,
    top_companies: bool = False,
    company_ids: Optional[List[int]] = None,
) -> List[dict]:
    """Get list of companies to enrich from database"""
    db = get_database()

    if company_ids:
        # Specific company IDs
        companies = []
        for company_id in company_ids:
            company = db.get_company_by_id(company_id)
            if company:
                companies.append(company)
        return companies

    # Query companies from database
    with db.get_connection() as conn:
        cursor = conn.cursor()

        query = """
            SELECT id, name, website, batch, industry
            FROM companies
            WHERE 1=1
        """
        params = []

        # Filter by batch
        if batch:
            query += " AND batch = ?"
            params.append(batch)

        # Only top companies
        if top_companies:
            query += " AND top_company = TRUE"

        # Prioritize NEWER companies first (newest batches = more viewer interest)
        # Parse batch into sortable format: W25 → 202501, S24 → 202406
        query += """
            ORDER BY
                (
                    CASE
                        -- Short format: W25, S24, etc.
                        WHEN batch GLOB '[WS][0-9][0-9]' THEN
                            (2000 + CAST(SUBSTR(batch, 2, 2) AS INTEGER)) * 100 +
                            CASE WHEN batch LIKE 'W%' THEN 1 ELSE 6 END
                        -- Long format: Winter 2025, Summer 2024, etc.
                        WHEN batch LIKE 'Winter%' THEN
                            CAST(REPLACE(REPLACE(batch, 'Winter ', ''), ' ', '') AS INTEGER) * 100 + 1
                        WHEN batch LIKE 'Summer%' THEN
                            CAST(REPLACE(REPLACE(batch, 'Summer ', ''), ' ', '') AS INTEGER) * 100 + 6
                        ELSE 0
                    END
                ) DESC,
                CASE WHEN funding_total_usd IS NULL THEN 0 ELSE 1 END,
                CASE WHEN team_size IS NOT NULL THEN team_size ELSE 0 END DESC
        """

        # Limit results
        query += f" LIMIT {limit}"

        cursor.execute(query, params)
        rows = cursor.fetchall()

        companies = []
        for row in rows:
            if hasattr(row, 'keys'):
                companies.append(dict(row))
            else:
                companies.append({
                    'id': row[0],
                    'name': row[1],
                    'website': row[2],
                    'batch': row[3],
                    'industry': row[4]
                })

        return companies


def main():
    parser = argparse.ArgumentParser(description='Bulk enrich companies with Coresignal funding data')
    parser.add_argument('--backend-url', default=os.environ.get('BACKEND_URL', 'http://localhost:8000'),
                        help='Backend API URL')
    parser.add_argument('--batch', help='Filter by YC batch (e.g., W25, S24)')
    parser.add_argument('--limit', type=int, default=100, help='Max number of companies to enrich')
    parser.add_argument('--top-companies', action='store_true', help='Only enrich top companies')
    parser.add_argument('--company-ids', help='Comma-separated company IDs (e.g., 123,456,789)')
    parser.add_argument('--delay', type=float, default=2.0, help='Delay between requests in seconds')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be enriched without calling API')

    args = parser.parse_args()

    # Parse company IDs if provided
    company_ids = None
    if args.company_ids:
        company_ids = [int(x.strip()) for x in args.company_ids.split(',')]

    # Get companies to enrich
    print(f"🔍 Fetching companies to enrich...")
    companies = get_companies_to_enrich(
        batch=args.batch,
        limit=args.limit,
        top_companies=args.top_companies,
        company_ids=company_ids,
    )

    if not companies:
        print("❌ No companies found matching criteria")
        return

    print(f"📊 Found {len(companies)} companies to enrich")
    print(f"⏱️  Estimated time: {len(companies) * args.delay / 60:.1f} minutes\n")

    if args.dry_run:
        print("🧪 DRY RUN - Would enrich:")
        for i, company in enumerate(companies, 1):
            print(f"  {i}. {company['name']} (ID: {company['id']}, Batch: {company.get('batch', 'N/A')})")
        return

    # Confirm before proceeding
    if len(companies) > 10:
        response = input(f"Enrich {len(companies)} companies? This will use Coresignal API credits. [y/N]: ")
        if response.lower() != 'y':
            print("❌ Cancelled")
            return

    # Enrich companies
    success_count = 0
    error_count = 0

    for i, company in enumerate(companies, 1):
        print(f"[{i}/{len(companies)}] Enriching {company['name']} (ID: {company['id']})...", end=' ')

        result = enrich_company(args.backend_url, company['id'])

        if result.get('success'):
            print(f"✅")
            success_count += 1
        else:
            error = result.get('error', 'Unknown error')
            print(f"❌ {error}")
            error_count += 1

        # Rate limiting delay
        if i < len(companies):
            time.sleep(args.delay)

    # Summary
    print(f"\n{'='*60}")
    print(f"📊 Summary:")
    print(f"  ✅ Successful: {success_count}")
    print(f"  ❌ Failed: {error_count}")
    print(f"  📈 Success rate: {success_count / len(companies) * 100:.1f}%")
    print(f"{'='*60}")


if __name__ == '__main__':
    main()
