-- Stripe subscription billing for Public API plans.
--
-- 1. Track the Stripe subscription alongside the existing stripe_customer_id.
-- 2. Remap the pre-Stripe plan ladder to the new one:
--      starter ($29, 500/day)      -> pro       ($50, 500/day)
--      pro     ($99, 5000/day)     -> max       ($500, 5000/day)
--      enterprise (50k/day)        -> unlimited (no cap, admin-granted)
--    Order matters inside the CASE: 'pro' changes meaning, so legacy pro rows
--    must become 'max' in the same statement that turns starter into 'pro'.
--    This migration runs exactly once via the supabase migration history.

ALTER TABLE api_users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE api_users ADD COLUMN IF NOT EXISTS subscription_status TEXT;

UPDATE api_users SET plan = CASE plan
    WHEN 'enterprise' THEN 'unlimited'
    WHEN 'pro'        THEN 'max'
    WHEN 'starter'    THEN 'pro'
    ELSE plan END
WHERE plan IN ('enterprise', 'pro', 'starter');

-- Webhook lookups arrive keyed by Stripe customer.
CREATE INDEX IF NOT EXISTS idx_api_users_stripe_customer
    ON api_users (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
