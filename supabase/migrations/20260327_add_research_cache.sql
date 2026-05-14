-- Create research_cache table for Perplexity API results storage and caching
CREATE TABLE IF NOT EXISTS research_cache (
    id BIGSERIAL PRIMARY KEY,
    query TEXT NOT NULL UNIQUE,
    query_type TEXT DEFAULT 'company',
    response_data JSONB NOT NULL,
    parsed_sections JSONB,
    citations JSONB DEFAULT '[]'::jsonb,
    view_count INTEGER DEFAULT 1,
    search_count INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
-- Use standard B-tree index for query lookups (faster for LOWER(query) = LOWER(?) patterns)
CREATE INDEX IF NOT EXISTS idx_research_cache_query_lower ON research_cache (LOWER(query));
CREATE INDEX IF NOT EXISTS idx_research_cache_view_count ON research_cache (view_count DESC);
CREATE INDEX IF NOT EXISTS idx_research_cache_created_at ON research_cache (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_cache_updated_at ON research_cache (updated_at DESC);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_research_cache_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_research_cache_timestamp_trigger ON research_cache;
CREATE TRIGGER update_research_cache_timestamp_trigger
    BEFORE UPDATE ON research_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_research_cache_timestamp();
