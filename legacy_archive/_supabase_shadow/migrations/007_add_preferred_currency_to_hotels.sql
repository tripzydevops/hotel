-- Add preferred_currency column to hotels table
-- Migration: 007_add_preferred_currency_to_hotels.sql
ALTER TABLE hotels
ADD COLUMN IF NOT EXISTS preferred_currency TEXT DEFAULT 'USD';
-- Update existing hotels to have 'USD' if they are null (defensive)
UPDATE hotels
SET preferred_currency = 'USD'
WHERE preferred_currency IS NULL;