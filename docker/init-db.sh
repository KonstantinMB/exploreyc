#!/bin/bash
set -e

MIGRATIONS_DIR="/migrations"
DB="exploreyc"
USER="postgres"

run_migration() {
    local file="$1"
    echo "Applying: $file"
    psql -v ON_ERROR_STOP=1 --username "$USER" --dbname "$DB" -f "$MIGRATIONS_DIR/$file"
}

# Stub auth.role() — used in RLS policies but not available in vanilla Postgres
psql -v ON_ERROR_STOP=1 --username "$USER" --dbname "$DB" <<'SQL'
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.role()
  RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'authenticated'::text; $$;
SQL

run_migration "20250315000000_initial_schema.sql"
run_migration "20250316000000_email_features.sql"
run_migration "20250321000000_add_hiring_board.sql"
run_migration "20250322_add_logo_path.sql"
run_migration "20260316000000_add_idea_validator.sql"
run_migration "20260322_add_salary_currency.sql"
# 20260324_add_predictions_sqlite.sql skipped — SQLite-only syntax
run_migration "20260324_add_predictions_table.sql"
run_migration "20260327_add_research_cache.sql"
run_migration "20260706000000_add_company_sources.sql"
run_migration "20260707000000_add_public_api.sql"
run_migration "20260707120000_add_api_user_avatar.sql"

echo "All migrations applied."
