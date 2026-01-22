-- Normalize existing data and add case-insensitive unique index
-- Migration: 005_normalize_existing_data.sql
-- 1. Normalize existing data to Title Case
UPDATE hotel_directory
SET name = initcap(trim(name)),
    location = initcap(trim(location));
UPDATE hotels
SET name = initcap(trim(name)),
    location = initcap(trim(location));
-- 2. Drop the existing case-sensitive unique constraint if it exists
ALTER TABLE hotel_directory DROP CONSTRAINT IF EXISTS hotel_directory_name_location_key;
-- 3. Create a case-insensitive unique index
-- We use LOWER() to ensure "Hilton" and "hilton" are seen as the same
CREATE UNIQUE INDEX IF NOT EXISTS idx_hotel_directory_case_insensitive_unique ON hotel_directory (LOWER(TRIM(name)), LOWER(TRIM(location)));
-- 4. Do the same for the hotels table to prevent duplicates for a single user
DO $$ BEGIN IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'hotels_user_id_name_key'
) THEN
ALTER TABLE hotels DROP CONSTRAINT hotels_user_id_name_key;
END IF;
END $$;
-- 5. Create query_logs table for future Reports and Analysis
CREATE TABLE IF NOT EXISTS query_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE
    SET NULL,
        hotel_name TEXT NOT NULL,
        location TEXT,
        action_type TEXT NOT NULL,
        -- 'search', 'monitor', 'create'
        status TEXT DEFAULT 'success',
        created_at TIMESTAMPTZ DEFAULT now()
);
-- Enable RLS
ALTER TABLE query_logs ENABLE ROW LEVEL SECURITY;
-- Allow users to see their own query logs
CREATE POLICY "Users can view own query logs" ON query_logs FOR
SELECT USING (auth.uid() = user_id);
-- Service role can insert
CREATE POLICY "Service role can insert query logs" ON query_logs FOR
INSERT WITH CHECK (true);
-- Index for analytics performance
CREATE INDEX idx_query_logs_created_at ON query_logs(created_at DESC);
CREATE INDEX idx_query_logs_action ON query_logs(action_type);