-- Migration 046: User Signals Schema Optimizations
-- Description: Creates a chronological index on public.user_signals.created_at
-- to optimize dashboard telemetry querying and enable high-speed daily partition pruning.

-- 1. Create descending chronological index on created_at column
CREATE INDEX IF NOT EXISTS idx_user_signals_created_at ON public.user_signals (created_at DESC);

-- 2. Add comment documenting the 90-day telemetry retention policy
COMMENT ON TABLE public.user_signals IS 'User interaction telemetry buffer with a 90-day retention/cleanup policy implemented in backend.scripts.prune_db_sessions';
