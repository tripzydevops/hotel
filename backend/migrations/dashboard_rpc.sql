-- EXPLANATION: [Phase 8] Dashboard Aggregator RPC
-- This function consolidates 7+ individual queries into a single call.
-- This drastically reduces latency between the API and Database,
-- and ensures atomic data consistency for the dashboard render.

CREATE OR REPLACE FUNCTION get_dashboard_init_data(p_user_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'profile', (
            SELECT to_jsonb(p) 
            FROM user_profiles p 
            WHERE p.user_id = p_user_id 
            LIMIT 1
        ),
        'settings', (
            SELECT to_jsonb(s) 
            FROM settings s 
            WHERE s.user_id = p_user_id 
            LIMIT 1
        ),
        'unread_alerts_count', (
            SELECT count(*) 
            FROM alerts 
            WHERE user_id = p_user_id 
            AND is_read = false
        ),
        'recent_searches', (
            SELECT COALESCE(jsonb_agg(q), '[]'::jsonb) 
            FROM (
                SELECT * 
                FROM query_logs 
                WHERE user_id = p_user_id 
                ORDER BY created_at DESC 
                LIMIT 20
            ) q
        ),
        'recent_sessions', (
            SELECT COALESCE(jsonb_agg(s), '[]'::jsonb) 
            FROM (
                SELECT * 
                FROM scan_sessions 
                WHERE user_id = p_user_id 
                ORDER BY created_at DESC 
                LIMIT 5
            ) s
        ),
        'hotels', (
            SELECT COALESCE(jsonb_agg(h), '[]'::jsonb) 
            FROM (
                SELECT * 
                FROM hotels 
                WHERE user_id = p_user_id 
                AND deleted_at IS NULL
                ORDER BY is_target_hotel DESC, created_at ASC
            ) h
        ),
        'core_profile', (
            SELECT to_jsonb(p) 
            FROM profiles p 
            WHERE p.id = p_user_id 
            LIMIT 1
        ),
        'global_pulse', (
            SELECT COALESCE(jsonb_agg(pulse), '[]'::jsonb)
            FROM (
                SELECT 
                    h.name as hotel_name,
                    round(((a.old_price - a.new_price) / a.old_price * 100)::numeric, 1) || '%' as reduction,
                    replace(a.message, '[Global Pulse] ', '') as message,
                    a.created_at as timestamp
                FROM alerts a
                JOIN hotels h ON a.hotel_id = h.id
                WHERE a.message ILIKE '%Global Pulse%'
                ORDER BY a.created_at DESC
                LIMIT 10
            ) pulse
        )
    ) INTO result;

    RETURN result;
END;
$$;
