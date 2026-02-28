-- Grouped Scan Sessions Migration
-- Migration: 009_scan_sessions.sql
-- 1. Create scan_sessions table
CREATE TABLE IF NOT EXISTS scan_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_type TEXT NOT NULL,
    -- 'manual', 'scheduled'
    status TEXT DEFAULT 'pending',
    -- 'pending', 'completed', 'failed'
    hotels_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);
-- 2. Link query_logs to scan_sessions
ALTER TABLE query_logs
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES scan_sessions(id) ON DELETE
SET NULL;
-- 3. Enable RLS
ALTER TABLE scan_sessions ENABLE ROW LEVEL SECURITY;
-- 4. Policies
CREATE POLICY "Users can view own scan sessions" ON scan_sessions FOR
SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert scan sessions" ON scan_sessions FOR
INSERT WITH CHECK (true);
CREATE POLICY "Service can update scan sessions" ON scan_sessions FOR
UPDATE USING (true);
-- 5. Indexes
CREATE INDEX idx_scan_sessions_user_id ON scan_sessions(user_id);
CREATE INDEX idx_scan_sessions_created_at ON scan_sessions(created_at DESC);
CREATE INDEX idx_query_logs_session_id ON query_logs(session_id);