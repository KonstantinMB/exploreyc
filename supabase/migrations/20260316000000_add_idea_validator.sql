-- Migration: Add Startup Idea Validator Support
-- Description: Adds pgvector extension and embedding column for semantic similarity search
-- Date: 2026-03-16

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to companies table
-- Using 1536 dimensions for OpenAI text-embedding-3-small model
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create index for fast similarity search using IVFFlat
-- This creates an approximate nearest neighbor index
-- lists = sqrt(row_count) is a good starting point for IVFFlat
CREATE INDEX IF NOT EXISTS idx_companies_embedding
ON companies
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index on industry for grouping similar companies
CREATE INDEX IF NOT EXISTS idx_companies_industry_grouping
ON companies (industry)
WHERE industry IS NOT NULL;

-- Add comment explaining the embedding column
COMMENT ON COLUMN companies.embedding IS 'OpenAI text-embedding-3-small vector (1536 dimensions) for semantic similarity search. Generated from: name + one_liner + long_description + industry + subindustry + tags + industries (AI-stopword-filtered)';

-- Create function to calculate similarity score (helper for queries)
CREATE OR REPLACE FUNCTION cosine_similarity(a vector, b vector)
RETURNS FLOAT AS $$
BEGIN
    RETURN 1 - (a <=> b);
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

COMMENT ON FUNCTION cosine_similarity IS 'Calculate cosine similarity between two vectors. Returns value between 0 (completely different) and 1 (identical).';
