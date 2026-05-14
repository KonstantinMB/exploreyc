-- Add Hiring Board tables for WorkAtAStartup integration
-- Run this in Supabase SQL Editor or via supabase db push

-- Hiring Board - Companies table (from WorkAtAStartup)
CREATE TABLE IF NOT EXISTS hiring_companies (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    batch TEXT,
    team_size INTEGER,
    location TEXT,
    logo_url TEXT,
    small_logo_url TEXT,
    website TEXT,
    one_liner TEXT,
    primary_vertical TEXT,
    raw_json JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hiring Board - Jobs table (from WorkAtAStartup)
CREATE TABLE IF NOT EXISTS hiring_jobs (
    id BIGINT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    pretty_role TEXT,
    salary_min INTEGER,
    salary_max INTEGER,
    job_type TEXT,
    remote TEXT,
    locations JSONB,  -- Array of location strings
    pretty_location_or_remote TEXT,
    pretty_job_type TEXT,
    pretty_min_experience TEXT,
    pretty_updated_at TEXT,
    show_path TEXT,
    raw_json JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (company_id) REFERENCES hiring_companies(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_hiring_company_id ON hiring_jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_hiring_role ON hiring_jobs(pretty_role);
CREATE INDEX IF NOT EXISTS idx_hiring_updated ON hiring_jobs(pretty_updated_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_hiring_batch ON hiring_companies(batch);
CREATE INDEX IF NOT EXISTS idx_hiring_location ON hiring_companies(location);

-- Enable Row Level Security (optional - adjust based on your security needs)
ALTER TABLE hiring_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE hiring_jobs ENABLE ROW LEVEL SECURITY;

-- Create public read policy (anyone can read hiring data)
CREATE POLICY "Enable read access for all users" ON hiring_companies
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON hiring_jobs
    FOR SELECT USING (true);

-- Create authenticated write policy (only backend can write)
CREATE POLICY "Enable write access for authenticated backend" ON hiring_companies
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable write access for authenticated backend" ON hiring_jobs
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
