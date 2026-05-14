"""
Database factory - uses SQLite for local dev, PostgreSQL (Supabase) when DATABASE_URL is set
"""

import os

def get_database():
    """Return the appropriate database instance based on environment"""
    if os.environ.get("DATABASE_URL"):
        from database_postgres import DatabasePostgres
        return DatabasePostgres()
    from database import Database
    return Database()
