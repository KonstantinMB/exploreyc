-- Create predictions table for storing gamified prediction results
CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Idea & Input Data
  idea_description TEXT NOT NULL,
  team_info JSONB,
  industry VARCHAR,
  location VARCHAR,
  market_type VARCHAR,

  -- Calculated Scores
  idea_score INTEGER NOT NULL,
  team_score INTEGER,
  market_score INTEGER NOT NULL,
  combined_score INTEGER NOT NULL,

  -- Rankings & Tier
  percentile INTEGER,
  tier VARCHAR NOT NULL,

  -- Matched Companies & Results
  top_matches JSONB NOT NULL,
  achievements JSONB NOT NULL DEFAULT '[]'::jsonb,
  challenges JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Social & Sharing
  user_email VARCHAR,
  shared_at TIMESTAMP,
  is_public BOOLEAN DEFAULT false,
  share_token VARCHAR UNIQUE,

  -- Metadata
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_combined_score ON predictions(combined_score DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_industry ON predictions(industry);
CREATE INDEX IF NOT EXISTS idx_predictions_is_public ON predictions(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_predictions_user_email ON predictions(user_email);
CREATE INDEX IF NOT EXISTS idx_predictions_share_token ON predictions(share_token);

-- Create materialized view for leaderboard
CREATE MATERIALIZED VIEW IF NOT EXISTS leaderboard AS
SELECT
  id,
  idea_description,
  combined_score,
  tier,
  industry,
  achievements,
  created_at,
  ROW_NUMBER() OVER (ORDER BY combined_score DESC) as rank,
  ROW_NUMBER() OVER (PARTITION BY industry ORDER BY combined_score DESC) as industry_rank
FROM predictions
WHERE is_public = true
ORDER BY combined_score DESC;

-- Create index on leaderboard for fast queries
CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard(rank);
CREATE INDEX IF NOT EXISTS idx_leaderboard_industry ON leaderboard(industry);

-- Create function to refresh leaderboard
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_predictions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS predictions_updated_at ON predictions;
CREATE TRIGGER predictions_updated_at
BEFORE UPDATE ON predictions
FOR EACH ROW
EXECUTE FUNCTION update_predictions_timestamp();
