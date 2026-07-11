-- Developer profile picture (stored as a small base64 data URL, client-resized).
ALTER TABLE api_users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
