-- Email subscription and notification features
-- Created: 2025-03-16

-- Email subscriptions table
CREATE TABLE IF NOT EXISTS email_subscriptions (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    preferences JSONB DEFAULT '{}',  -- e.g., {"batches": ["W24", "S24"], "industries": ["AI", "Healthcare"]}
    verification_token VARCHAR(255) UNIQUE,
    verified_at TIMESTAMPTZ,
    unsubscribe_token VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast email lookups
CREATE INDEX idx_subscriptions_email ON email_subscriptions(email);
CREATE INDEX idx_subscriptions_active ON email_subscriptions(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_subscriptions_verification ON email_subscriptions(verification_token) WHERE verification_token IS NOT NULL;

-- Daily company snapshots for comparison
CREATE TABLE IF NOT EXISTS company_snapshots (
    id SERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    company_id BIGINT NOT NULL,
    batch TEXT,
    is_hiring BOOLEAN,
    team_size INTEGER,
    status TEXT,
    industry TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(snapshot_date, company_id)
);

-- Indexes for fast snapshot queries
CREATE INDEX idx_snapshots_date ON company_snapshots(snapshot_date DESC);
CREATE INDEX idx_snapshots_company ON company_snapshots(company_id);
CREATE INDEX idx_snapshots_date_company ON company_snapshots(snapshot_date, company_id);

-- Roadmap feature votes (migrating from localStorage)
CREATE TABLE IF NOT EXISTS roadmap_votes (
    id SERIAL PRIMARY KEY,
    feature_id VARCHAR(100) NOT NULL,
    user_identifier VARCHAR(255) NOT NULL,  -- IP hash or session ID
    voted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(feature_id, user_identifier)
);

-- Index for fast vote counting
CREATE INDEX idx_votes_feature ON roadmap_votes(feature_id);
CREATE INDEX idx_votes_user ON roadmap_votes(user_identifier);

-- Materialized view for vote counts (refresh daily)
CREATE MATERIALIZED VIEW IF NOT EXISTS roadmap_vote_counts AS
SELECT
    feature_id,
    COUNT(*) as vote_count
FROM roadmap_votes
GROUP BY feature_id;

-- Index on materialized view
CREATE UNIQUE INDEX idx_vote_counts_feature ON roadmap_vote_counts(feature_id);

-- Function to refresh vote counts (call after votes change)
CREATE OR REPLACE FUNCTION refresh_vote_counts()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY roadmap_vote_counts;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update email_subscriptions updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_subscriptions_updated_at
    BEFORE UPDATE ON email_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE email_subscriptions IS 'User email subscriptions for daily YC company updates';
COMMENT ON TABLE company_snapshots IS 'Daily snapshots of company data for comparison and change detection';
COMMENT ON TABLE roadmap_votes IS 'User votes on product roadmap features';
COMMENT ON COLUMN email_subscriptions.preferences IS 'JSON object with user notification preferences (batches, industries to follow)';
COMMENT ON COLUMN email_subscriptions.verification_token IS 'Token sent via email for verification (null after verified)';
COMMENT ON COLUMN email_subscriptions.unsubscribe_token IS 'Permanent token for one-click unsubscribe';
