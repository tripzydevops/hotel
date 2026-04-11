-- [036_scheduler_lock]
-- Fixes Multi-User Overlap by providing atomic distributed locking.

CREATE TABLE IF NOT EXISTS public.internal_locks (
    lock_key TEXT PRIMARY KEY,
    last_acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Enable RLS for security, but we will likely call this via service_role for system tasks
ALTER TABLE public.internal_locks ENABLE ROW LEVEL SECURITY;

-- Allow reading locks (useful for troubleshooting)
CREATE POLICY "Allow anyone to view locks" 
ON public.internal_locks FOR SELECT 
TO authenticated, anon
USING (true);

-- ATOMIC LOCK FUNCTION
-- Returns TRUE if lock was acquired, FALSE if already held.
CREATE OR REPLACE FUNCTION public.try_acquire_lock(p_lock_key TEXT, p_expire_seconds INT)
RETURNS BOOLEAN AS $$
DECLARE
    v_now TIMESTAMP WITH TIME ZONE := NOW();
    v_success BOOLEAN := FALSE;
BEGIN
    -- Atomic Try-Update or Insert
    -- We use ON CONFLICT to handle already exists
    -- We use a WHERE clause in the update to only succeed if the lock is expired
    INSERT INTO public.internal_locks (lock_key, last_acquired_at, expires_at)
    VALUES (p_lock_key, v_now, v_now + (p_expire_seconds || ' seconds')::INTERVAL)
    ON CONFLICT (lock_key) DO UPDATE
    SET 
        last_acquired_at = v_now,
        expires_at = v_now + (p_expire_seconds || ' seconds')::INTERVAL
    WHERE public.internal_locks.expires_at < v_now
    RETURNING TRUE INTO v_success;

    RETURN COALESCE(v_success, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
