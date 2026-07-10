-- Feature interest: records when a user clicks "I want this feature" for a
-- currently-unavailable feature (e.g. the paused data export). Deduped per
-- (feature, user_identifier) so one browser counts once. Optional email lets us
-- notify people when the feature ships.

CREATE TABLE IF NOT EXISTS feature_requests (
    id BIGSERIAL PRIMARY KEY,
    feature TEXT NOT NULL,                 -- e.g. 'db-export'
    user_identifier TEXT,                  -- stable per-browser id from the client
    email TEXT,                            -- optional 'notify me when it's back'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (feature, user_identifier)
);

CREATE INDEX IF NOT EXISTS idx_feature_requests_feature ON feature_requests(feature);
