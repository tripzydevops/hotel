-- Migration: 016_fix_schema_drifts.sql
-- Description: Add missing columns required for Global Pulse (Phase 1 & 2)

-- 1. Enrich hotels table
ALTER TABLE hotels 
ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'current';

-- 2. Enrich price_logs table
ALTER TABLE price_logs
ADD COLUMN IF NOT EXISTS is_estimated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS serp_api_id TEXT;

-- 3. Enrich alerts table
ALTER TABLE alerts
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'TRY';

-- 4. Comments
COMMENT ON COLUMN hotels.embedding_status IS 'Tracks if the sentiment profile needs regeneration';
COMMENT ON COLUMN price_logs.is_estimated IS 'True if price was filled from historical data (Vertical Fill)';
COMMENT ON COLUMN alerts.currency IS 'Currency of the alert prices';
