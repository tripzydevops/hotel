-- Add push_subscription column to settings table
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS push_subscription JSONB;

COMMENT ON COLUMN settings.push_subscription IS 'Web Push Subscription object (endpoint, keys)';
