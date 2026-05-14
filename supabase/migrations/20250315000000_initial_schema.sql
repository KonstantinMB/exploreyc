-- YC Company Scraper - Initial Schema for Supabase/PostgreSQL
-- Run this in Supabase SQL Editor or via supabase db push

-- Companies table (matches SQLite schema)
CREATE TABLE IF NOT EXISTS companies (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    website TEXT,
    one_liner TEXT,
    long_description TEXT,
    team_size INTEGER DEFAULT 0,
    batch TEXT,
    status TEXT,
    industry TEXT,
    subindustry TEXT,
    all_locations TEXT,
    is_hiring BOOLEAN DEFAULT FALSE,
    top_company BOOLEAN DEFAULT FALSE,
    nonprofit BOOLEAN DEFAULT FALSE,
    stage TEXT,
    small_logo_thumb_url TEXT,
    tags TEXT,
    regions TEXT,
    industries TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    country TEXT,
    raw_json TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scrape jobs table
CREATE TABLE IF NOT EXISTS scrape_jobs (
    id SERIAL PRIMARY KEY,
    status TEXT NOT NULL,
    filters TEXT,
    total_scraped INTEGER DEFAULT 0,
    current_page INTEGER DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_companies_batch ON companies(batch);
CREATE INDEX IF NOT EXISTS idx_companies_is_hiring ON companies(is_hiring);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);
CREATE INDEX IF NOT EXISTS idx_companies_country ON companies(country);
CREATE INDEX IF NOT EXISTS idx_companies_lat_lng ON companies(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Full-text search for company search
CREATE INDEX IF NOT EXISTS idx_companies_search ON companies USING GIN(
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(one_liner, '') || ' ' || coalesce(long_description, ''))
);
