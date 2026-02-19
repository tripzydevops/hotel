-- Migration 012: Fix Sentiment History Permissions
-- Purpose: Ensure the frontend can read history data for fallback logic

-- 1. Enable RLS (Good practice)
ALTER TABLE sentiment_history ENABLE ROW LEVEL SECURITY;

-- 2. Create Policy for Reading
-- Allow anyone (auth or anon) to read sentiment history?
-- Usually dashboard is authenticated. Let's allow authenticated users.
CREATE POLICY "Allow authenticated users to read sentiment history"
ON sentiment_history FOR SELECT
TO authenticated
USING (true);

-- Also allow service role (always implied, but good to be verified)
-- If we want to allow public read (e.g. for landing page widgets?), we might need anon.
-- For now, 'authenticated' covers the dashboard.
