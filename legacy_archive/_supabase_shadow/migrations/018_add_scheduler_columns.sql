
-- Migration: Add scheduling columns to profiles if they don't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS next_scan_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS scan_frequency_minutes INTEGER DEFAULT 1440;

-- Backfill existing users
UPDATE profiles SET next_scan_at = NOW() WHERE next_scan_at IS NULL;
UPDATE profiles SET scan_frequency_minutes = 1440 WHERE scan_frequency_minutes IS NULL;
