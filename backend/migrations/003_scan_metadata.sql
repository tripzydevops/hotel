-- Migration 003: Scan Metadata
-- Adds search parameter columns to scan_sessions and query_logs for better transparency.
-- Update scan_sessions
ALTER TABLE scan_sessions
ADD COLUMN IF NOT EXISTS check_in_date DATE,
    ADD COLUMN IF NOT EXISTS check_out_date DATE,
    ADD COLUMN IF NOT EXISTS adults INTEGER DEFAULT 2,
    ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'TRY';
-- Update query_logs
ALTER TABLE query_logs
ADD COLUMN IF NOT EXISTS check_in_date DATE,
    ADD COLUMN IF NOT EXISTS adults INTEGER DEFAULT 2;
-- Comments for documentation
COMMENT ON COLUMN scan_sessions.check_in_date IS 'The check-in date used for this manual/automated scan session';
COMMENT ON COLUMN scan_sessions.adults IS 'Number of adults specified for the scan';
COMMENT ON COLUMN query_logs.check_in_date IS 'Search date for this specific hotel query';