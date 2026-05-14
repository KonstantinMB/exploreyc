-- SQLite migration for predictions table (local development)
CREATE TABLE IF NOT EXISTS predictions (
  id TEXT PRIMARY KEY,

  -- Idea & Input Data
  idea_description TEXT NOT NULL,
  team_info TEXT,
  industry TEXT,
  location TEXT,
  market_type TEXT,

  -- Calculated Scores
  idea_score INTEGER NOT NULL,
  team_score INTEGER,
  market_score INTEGER NOT NULL,
  combined_score INTEGER NOT NULL,

  -- Rankings & Tier
  percentile INTEGER,
  tier TEXT NOT NULL,

  -- Matched Companies & Results
  top_matches TEXT NOT NULL,
  achievements TEXT DEFAULT '[]',
  challenges TEXT DEFAULT '[]',

  -- Social & Sharing
  user_email TEXT,
  shared_at TIMESTAMP,
  is_public BOOLEAN DEFAULT 0,
  share_token TEXT UNIQUE,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_combined_score ON predictions(combined_score DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_industry ON predictions(industry);
CREATE INDEX IF NOT EXISTS idx_predictions_is_public ON predictions(is_public);
CREATE INDEX IF NOT EXISTS idx_predictions_user_email ON predictions(user_email);
CREATE INDEX IF NOT EXISTS idx_predictions_share_token ON predictions(share_token);
