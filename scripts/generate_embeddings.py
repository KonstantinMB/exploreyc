#!/usr/bin/env python3
"""
Generate embeddings for YC companies
This script generates OpenAI embeddings for companies to enable vector search in the idea validator

Usage:
    python scripts/generate_embeddings.py --limit 100      # Generate for 100 companies
    python scripts/generate_embeddings.py --all            # Generate for all companies without embeddings
    python scripts/generate_embeddings.py --company-id 123 # Generate for specific company
"""

import os
import sys
import time
import argparse
from typing import Optional

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from database_factory import get_database
from embedding_service import get_embedding_service
from idea_filter import get_search_text_for_embedding


def generate_embeddings_for_companies(
    limit: Optional[int] = None,
    company_id: Optional[int] = None
):
    """Generate embeddings for companies"""

    # Check if OpenAI API key is set
    if not os.getenv('OPENAI_API_KEY'):
        print("❌ Error: OPENAI_API_KEY environment variable not set")
        print("Please set it with: export OPENAI_API_KEY='your-api-key'")
        sys.exit(1)

    # Initialize services
    db = get_database()
    embedding_service = get_embedding_service()

    # Get companies to process
    if company_id:
        # Get specific company
        company = db.get_company_by_id(company_id)
        if not company:
            print(f"❌ Company with ID {company_id} not found")
            sys.exit(1)
        companies = [company]
        print(f"📊 Processing 1 company (ID: {company_id})")
    else:
        # Get companies without embeddings
        companies = db.get_companies_without_embeddings(limit=limit or 10000)
        if not companies:
            print("✅ All companies already have embeddings!")
            return
        print(f"📊 Found {len(companies)} companies without embeddings")

        if limit:
            companies = companies[:limit]
            print(f"📊 Processing {len(companies)} companies (limit: {limit})")

    # Confirm before proceeding if more than 10 companies
    if len(companies) > 10:
        response = input(f"\n⚠️  Generate embeddings for {len(companies)} companies? This will use OpenAI API credits. [y/N]: ")
        if response.lower() != 'y':
            print("❌ Cancelled")
            sys.exit(0)

    # Process companies
    success_count = 0
    error_count = 0
    skipped_count = 0

    print(f"\n🚀 Starting embedding generation...\n")

    for i, company in enumerate(companies, 1):
        try:
            # Create description text from available fields
            description_parts = []
            if company.get('one_liner'):
                description_parts.append(company['one_liner'])
            if company.get('long_description'):
                description_parts.append(company['long_description'])

            description = ' '.join(description_parts).strip()

            if not description:
                print(f"[{i}/{len(companies)}] ⚠️  Skipped {company['name']} (ID: {company['id']}) - no description")
                skipped_count += 1
                continue

            # Filter AI words and generate embedding
            search_text = get_search_text_for_embedding(description)
            embedding = embedding_service.generate_embedding(search_text)

            # Store embedding in database
            if db.update_company_embedding(company['id'], embedding):
                success_count += 1
                print(f"[{i}/{len(companies)}] ✅ {company['name']} (ID: {company['id']})")
            else:
                error_count += 1
                print(f"[{i}/{len(companies)}] ❌ Failed to store embedding for {company['name']} (ID: {company['id']})")

            # Rate limiting: small delay between requests to avoid OpenAI rate limits
            if i < len(companies):
                time.sleep(0.2)

        except Exception as e:
            error_count += 1
            print(f"[{i}/{len(companies)}] ❌ Error for {company['name']} (ID: {company['id']}): {e}")
            continue

    # Summary
    print(f"\n{'='*60}")
    print(f"📊 Summary:")
    print(f"  ✅ Successfully generated: {success_count}")
    print(f"  ❌ Errors: {error_count}")
    print(f"  ⚠️  Skipped (no description): {skipped_count}")
    print(f"  📈 Total processed: {success_count + error_count + skipped_count}")
    print(f"{'='*60}")

    # Show current embedding coverage
    total_companies_with_embeddings = db.count_companies_with_embeddings()
    print(f"\n📊 Total companies with embeddings: {total_companies_with_embeddings}")


def main():
    parser = argparse.ArgumentParser(description='Generate embeddings for YC companies')
    parser.add_argument('--limit', type=int, help='Maximum number of companies to process')
    parser.add_argument('--all', action='store_true', help='Process all companies without embeddings')
    parser.add_argument('--company-id', type=int, help='Generate embedding for specific company ID')

    args = parser.parse_args()

    if args.all:
        limit = None
    elif args.limit:
        limit = args.limit
    elif args.company_id:
        limit = None
    else:
        # Default: process 100 companies
        limit = 100

    generate_embeddings_for_companies(
        limit=limit,
        company_id=args.company_id
    )


if __name__ == '__main__':
    main()
