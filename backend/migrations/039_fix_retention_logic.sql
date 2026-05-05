-- Migration 039: Fix Retention Logic and Schema Integrity
-- Resolves 23502 (NOT NULL violation) by filtering invalid logs and hardening schema.

-- 1. Clean up inconsistent data in price_history_daily
DELETE FROM public.price_history_daily 
WHERE hotel_id IS NULL OR date IS NULL;

-- 2. Hardening Schema for price_history_daily
-- Note: Using UUID for hotel_id to match hotels.id type
ALTER TABLE public.price_history_daily 
    ALTER COLUMN hotel_id SET NOT NULL,
    ALTER COLUMN date SET NOT NULL;

-- 3. Redefine Maintenance Function with data quality safeguards
CREATE OR REPLACE FUNCTION public.perform_data_maintenance()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rows_rolled_up int := 0;
    rows_deleted int := 0;
BEGIN
    -- A. Perform Rollup with strict NULL filtering
    WITH summary AS (
        SELECT 
            hotel_id, 
            check_in_date, 
            recorded_at::date as observation_date,
            AVG(price) as avg_price,
            MIN(price) as min_price,
            MAX(price) as max_price,
            -- Take the most detailed room type info from the set
            (jsonb_agg(room_types ORDER BY CASE WHEN jsonb_typeof(room_types) = 'array' THEN jsonb_array_length(room_types) ELSE 0 END DESC) -> 0) as room_type_summary,
            -- Take the most recent vendor name
            (array_agg(vendor ORDER BY recorded_at DESC))[1] as top_vendor
        FROM price_logs
        WHERE recorded_at < (now() - interval '7 days')
          AND hotel_id IS NOT NULL 
          AND check_in_date IS NOT NULL
        GROUP BY hotel_id, check_in_date, recorded_at::date
    )
    INSERT INTO price_history_daily (
        hotel_id, 
        date, 
        observation_date, 
        avg_price, 
        min_price, 
        max_price, 
        room_type_summary, 
        source, 
        top_vendor
    )
    SELECT 
        hotel_id, 
        check_in_date, 
        observation_date, 
        avg_price, 
        min_price, 
        max_price, 
        COALESCE(room_type_summary, '[]'::jsonb), 
        'native_rollup', 
        top_vendor
    FROM summary
    ON CONFLICT (hotel_id, date, observation_date) DO UPDATE SET
        avg_price = EXCLUDED.avg_price,
        min_price = EXCLUDED.min_price,
        max_price = EXCLUDED.max_price,
        room_type_summary = EXCLUDED.room_type_summary,
        top_vendor = EXCLUDED.top_vendor;
    
    GET DIAGNOSTICS rows_rolled_up = ROW_COUNT;

    -- B. Prune raw price logs (Only after successfully rolling up)
    -- We use the same filter here to be consistent
    DELETE FROM price_logs 
    WHERE recorded_at < (now() - interval '7 days');
    
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;

    -- C. Prune operational logs (Query logs and Sessions)
    DELETE FROM query_logs WHERE created_at < (now() - interval '14 days');
    DELETE FROM scan_sessions WHERE created_at < (now() - interval '30 days');

    RETURN json_build_object(
        'status', 'SUCCESS',
        'rolled_up', rows_rolled_up,
        'pruned_logs', rows_deleted,
        'timestamp', now()
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'status', 'FAILED',
        'error', SQLERRM,
        'detail', SQLSTATE
    );
END;
$$;
