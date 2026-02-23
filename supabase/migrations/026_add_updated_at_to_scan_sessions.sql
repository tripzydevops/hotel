-- Migration: 026_add_updated_at_to_scan_sessions.sql
-- Description: Add updated_at column to scan_sessions and set up automation trigger.

-- 1. Add updated_at column
ALTER TABLE public.scan_sessions
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Apply the handle_updated_at trigger (defined in 024)
DROP TRIGGER IF EXISTS set_scan_sessions_updated_at ON public.scan_sessions;
CREATE TRIGGER set_scan_sessions_updated_at BEFORE
UPDATE ON public.scan_sessions FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
