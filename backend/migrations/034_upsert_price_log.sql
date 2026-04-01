-- Migration 034: Upsert Price Log and Deduplication
-- Created: 2026-04-01

-- 1. Create the UNIQUE index for deduplication (per minute)
-- This ensures that for a specific hotel and check-in date, only one price log exists per minute.
-- Useful for high-frequency or stray re-runs of the same scan.
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_logs_dedup ON public.price_logs (
    hotel_id, 
    check_in_date, 
    (date_trunc('minute', recorded_at AT TIME ZONE 'UTC'))
);

-- 2. Create the upsert function to handle the conflict gracefully
-- This is used via RPC since PostgREST doesn't support ON CONFLICT natively in many cases.
CREATE OR REPLACE FUNCTION upsert_price_log(
    p_hotel_id uuid,
    p_price numeric,
    p_currency text,
    p_check_in_date date,
    p_recorded_at timestamptz,
    p_is_estimated boolean,
    p_session_id uuid,
    p_vendor text,
    p_parity_offers jsonb,
    p_room_types jsonb,
    p_metadata jsonb
) RETURNS uuid 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid;
BEGIN
    INSERT INTO public.price_logs (
        hotel_id, 
        price, 
        currency, 
        check_in_date, 
        recorded_at, 
        is_estimated, 
        session_id, 
        vendor, 
        parity_offers, 
        room_types, 
        metadata
    ) VALUES (
        p_hotel_id, 
        p_price, 
        p_currency, 
        p_check_in_date, 
        p_recorded_at, 
        p_is_estimated, 
        p_session_id, 
        p_vendor, 
        p_parity_offers, 
        p_room_types, 
        p_metadata
    )
    ON CONFLICT (hotel_id, check_in_date, (date_trunc('minute', recorded_at AT TIME ZONE 'UTC')))
    DO UPDATE SET
        price = EXCLUDED.price,
        currency = EXCLUDED.currency,
        is_estimated = EXCLUDED.is_estimated,
        session_id = EXCLUDED.session_id,
        vendor = EXCLUDED.vendor,
        parity_offers = EXCLUDED.parity_offers,
        room_types = EXCLUDED.room_types,
        metadata = price_logs.metadata || EXCLUDED.metadata,
        recorded_at = EXCLUDED.recorded_at
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;
