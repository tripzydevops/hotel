-- Add currency support to user settings
-- Migration: 006_add_currency_to_settings.sql
-- 1. Add currency column to settings table
ALTER TABLE settings
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
-- 2. Update existing settings to have 'USD' if they are null
UPDATE settings
SET currency = 'USD'
WHERE currency IS NULL;
-- 3. Update the query_logs table to also track currency if needed
-- (Though not strictly necessary as logs have specific context, it's good for analysis)
ALTER TABLE query_logs
ADD COLUMN IF NOT EXISTS status_detail TEXT;
-- Extra field for metadata