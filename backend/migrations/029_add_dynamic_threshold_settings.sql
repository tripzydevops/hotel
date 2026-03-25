-- Migration 029: Add dynamic threshold columns to settings table
-- Run in Supabase SQL Editor
-- These columns are required for the "Predictive Yield: AI Smart Thresholds" feature

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS dynamic_threshold_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dynamic_threshold_sensitivity FLOAT DEFAULT 1.0;

-- Also notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
