#!/usr/bin/env python3
"""
Generate embeddings for YC companies
This script generates OpenAI embeddings for companies to enable vector search in the idea validator

Usage:
    python scripts/generate_embeddings.py           # Embed only companies missing embeddings (default)
    python scripts/generate_embeddings.py --full    # Re-embed ALL companies (overwrite existing)
"""

import os
import sys
import argparse

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from database_factory import get_database
from embedding_service import get_embedding_service
from idea_filter import get_search_text_for_embedding

# --full flag: re-embed every company, not just those missing embeddings
FULL_REEMBED = "--full" in sys.argv


def generate_embeddings_for_companies(
    limit: int = None,
):
    """Generate embeddings for companies"""

    # Check if OpenAI API key is set
    if not os.getenv('OPENAI_API_KEY'):
        print("❌ Error: OPENAI_API_KEY environment variable not set")
        print("Please set it with: export OPENAI_API_KEY='your-api-key'")
        sys.exit(1)

    # Check if DATABASE_URL is set (required for PostgreSQL / production)
    if not os.getenv('DATABASE_URL'):
        print("❌ Error: DATABASE_URL environment variable not set")
        print("Please set it with: export DATABASE_URL='your-database-url'")
        sys.exit(1)

    # Initialize services
    db = get_database()
    embedding_service = get_embedding_service()

    # Get companies to process using richer field set (Task 1 helper)
    companies = db.get_companies_for_embedding(only_missing=(not FULL_REEMBED), limit=100000)
    if not companies:
        print("✅ All companies already have embeddings!")
        return

    if limit:
        companies = companies[:limit]

    print(f"🚀 Embedding {len(companies)} companies (full={FULL_REEMBED})")

    # Batch processing — 200 texts per OpenAI batch call
    BATCH = 200
    total_updated = 0

    for start in range(0, len(companies), BATCH):
        chunk = companies[start:start + BATCH]
        texts = [get_search_text_for_embedding(db.build_company_embedding_text(c)) for c in chunk]
        vectors = embedding_service.generate_embeddings_batch(texts)
        pairs = [(c["id"], v) for c, v in zip(chunk, vectors)]
        updated = db.update_company_embeddings_batch(pairs)
        total_updated += updated
        print(f"  [{start + len(chunk)}/{len(companies)}] wrote {updated}")

    # Summary
    print(f"\n{'='*60}")
    print(f"📊 Summary:")
    print(f"  ✅ Total embeddings written: {total_updated}")
    print(f"  📈 Total companies processed: {len(companies)}")
    print(f"{'='*60}")

    # Show current embedding coverage
    total_companies_with_embeddings = db.count_companies_with_embeddings()
    print(f"\n📊 Total companies with embeddings: {total_companies_with_embeddings}")


def main():
    parser = argparse.ArgumentParser(description='Generate embeddings for YC companies')
    parser.add_argument('--limit', type=int, help='Maximum number of companies to process')
    parser.add_argument('--full', action='store_true', help='Re-embed ALL companies, overwriting existing embeddings')

    args = parser.parse_args()

    generate_embeddings_for_companies(limit=args.limit)


if __name__ == '__main__':
    main()
