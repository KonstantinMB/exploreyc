#!/usr/bin/env python3
"""Delete Hacker News / Product Hunt companies that carry a YC batch.

A batch on a non-YC source row (e.g. a Launch HN titled "... (YC W26)") means the
company is a YC company that already exists as the canonical source='yc' row, so
the duplicate is removed. Never touches source='yc'. Idempotent — safe to run
repeatedly. The daily /api/cron/sync-sources runs this automatically after each
sync; this script is for manual/one-off runs.

Usage:
    python scripts/dedupe_source_companies.py
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from database_factory import get_database  # noqa: E402


def main() -> None:
    db = get_database()
    if not hasattr(db, "delete_source_companies_with_batch"):
        print("This database backend does not support source dedup — nothing to do.")
        return
    n = db.delete_source_companies_with_batch()
    print(f"Deleted {n} batch-carrying HN/Product Hunt row(s) that duplicate YC companies.")


if __name__ == "__main__":
    main()
