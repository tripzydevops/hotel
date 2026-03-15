-- EXPLANATION: Add missing column to track which API key was used for a query.
-- This column is required by the backend to avoid PGRST204 errors.
ALTER TABLE query_logs ADD COLUMN IF NOT EXISTS api_key_suffix TEXT;
