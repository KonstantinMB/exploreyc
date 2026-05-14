#!/usr/bin/env python3
"""
Migrate companies from SQLite to Supabase (PostgreSQL).
Run after creating Supabase project and running the migration SQL.

Usage:
  DATABASE_URL=postgresql://... python scripts/migrate_sqlite_to_supabase.py
"""

import os
import sys
import json

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import sqlite3
from database_postgres import DatabasePostgres


def migrate():
    sqlite_path = os.path.join(os.path.dirname(__file__), "..", "backend", "yc_companies.db")
    if not os.path.exists(sqlite_path):
        print(f"SQLite database not found at {sqlite_path}")
        print("Run the scraper locally first to populate yc_companies.db")
        sys.exit(1)

    if not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL environment variable is required")
        print("Get it from Supabase: Settings > Database > Connection string (URI)")
        sys.exit(1)

    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT * FROM companies")
    rows = cur.fetchall()
    conn.close()

    print(f"Migrating {len(rows)} companies to Supabase...")

    db = DatabasePostgres()
    migrated = 0
    for row in rows:
        company = dict(row)
        # Convert is_hiring for Algolia format (scraper uses isHiring)
        company["isHiring"] = bool(company.get("is_hiring"))
        try:
            db.insert_company(company)
            migrated += 1
            if migrated % 500 == 0:
                print(f"  Migrated {migrated}/{len(rows)}...")
        except Exception as e:
            print(f"  Error migrating company {company.get('id')}: {e}")

    print(f"Done! Migrated {migrated} companies to Supabase.")


if __name__ == "__main__":
    migrate()
