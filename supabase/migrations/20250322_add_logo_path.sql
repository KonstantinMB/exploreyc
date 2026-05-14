-- Add logo_path column to hiring_companies table
-- This stores the path to logos in Supabase storage bucket
-- Format: "company-logos/{company_id}.{ext}"

ALTER TABLE hiring_companies ADD COLUMN IF NOT EXISTS logo_path VARCHAR(255);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_hiring_companies_logo_path ON hiring_companies(logo_path);
