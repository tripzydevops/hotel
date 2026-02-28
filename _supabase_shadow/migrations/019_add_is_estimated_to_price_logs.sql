
-- Migration: Add is_estimated column to price_logs
ALTER TABLE price_logs 
ADD COLUMN IF NOT EXISTS is_estimated BOOLEAN DEFAULT FALSE;

-- Update existing records if needed (defaulting to false is fine)
UPDATE price_logs SET is_estimated = FALSE WHERE is_estimated IS NULL;
