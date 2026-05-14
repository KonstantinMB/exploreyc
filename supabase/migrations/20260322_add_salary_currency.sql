-- Add salary_currency field to hiring_jobs table
-- This allows proper handling of salaries in different currencies (USD, INR, GBP, EUR, etc.)

ALTER TABLE hiring_jobs
ADD COLUMN IF NOT EXISTS salary_currency TEXT DEFAULT 'USD';

-- Create index for currency queries
CREATE INDEX IF NOT EXISTS idx_hiring_salary_currency ON hiring_jobs(salary_currency);

-- Update comment
COMMENT ON COLUMN hiring_jobs.salary_currency IS 'Currency code (ISO 4217) for salary_min and salary_max (default: USD)';
