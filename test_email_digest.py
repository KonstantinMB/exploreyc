#!/usr/bin/env python3
"""
Test the email digest flow with a mock company.

1. Creates yesterday's snapshot (current companies)
2. Inserts a mock "new" company
3. Creates today's snapshot (includes mock)
4. You then run: curl -X POST https://api.exploreyc.com/api/cron/send-digests -H "Authorization: Bearer YOUR_CRON_SECRET"

Requires: Verified email subscriber, DATABASE_URL, and the backend running.
"""

import sys
import os
from datetime import date, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from dotenv import load_dotenv
load_dotenv()

MOCK_COMPANY_ID = 999999  # High ID to avoid conflicts


def main():
    if not os.environ.get("DATABASE_URL"):
        print("❌ DATABASE_URL not set")
        sys.exit(1)

    from database_factory import get_database
    db = get_database()

    if not hasattr(db, 'get_all_companies'):
        print("❌ Use Supabase/Postgres (DATABASE_URL) for this test")
        sys.exit(1)

    today = str(date.today())
    yesterday = str(date.today() - timedelta(days=1))

    print("=" * 60)
    print("  Test Email Digest - Mock Company")
    print("=" * 60)
    print()

    # 1. Create yesterday's snapshot (current state)
    print("1. Creating yesterday's snapshot...")
    companies = db.get_all_companies()
    count = db.create_snapshot(yesterday, companies)
    print(f"   ✓ {count} companies in yesterday's snapshot")
    print()

    # 2. Insert mock company
    mock = {
        "id": MOCK_COMPANY_ID,
        "name": "TestCo (Mock for Digest)",
        "slug": "testco-mock-digest",
        "website": "https://example.com",
        "one_liner": "A test company to verify the email digest works.",
        "long_description": "This is a mock company added for testing the daily digest email.",
        "team_size": 5,
        "batch": "Winter 2026",
        "status": "Active",
        "industry": "Software",
        "subindustry": "B2B",
        "all_locations": "San Francisco, CA",
        "isHiring": True,
        "top_company": False,
        "nonprofit": False,
        "stage": "Early",
        "small_logo_thumb_url": None,
        "tags": [],
        "regions": [],
        "industries": [],
        "latitude": 37.7749,
        "longitude": -122.4194,
        "country": "United States",
    }
    db.insert_company(mock)
    print("2. Inserted mock company: TestCo (Mock for Digest)")
    print()

    # 3. Create today's snapshot (with mock)
    print("3. Creating today's snapshot...")
    companies = db.get_all_companies()
    count = db.create_snapshot(today, companies)
    print(f"   ✓ {count} companies in today's snapshot")
    print()

    # 4. Check subscribers
    subscribers = db.get_active_subscriptions()
    if not subscribers:
        print("⚠️  No verified subscribers found. Subscribe and verify your email first.")
    else:
        print(f"   Subscribers: {len(subscribers)}")
        for s in subscribers:
            print(f"   - {s['email']}")
    print()

    print("=" * 60)
    print("  Next: Trigger send-digests")
    print("=" * 60)
    print()
    print("Run this (replace YOUR_CRON_SECRET):")
    print()
    print("  curl -X POST https://api.exploreyc.com/api/cron/send-digests \\")
    print("    -H \"Authorization: Bearer YOUR_CRON_SECRET\"")
    print()
    print("Or locally:")
    print()
    print("  curl -X POST http://localhost:8000/api/cron/send-digests \\")
    print("    -H \"Authorization: Bearer YOUR_CRON_SECRET\"")
    print()
    print("You should receive an email with 'TestCo (Mock for Digest)' in the new companies section.")
    print()


if __name__ == "__main__":
    main()
