-- Migration: Add check_out_date to price_logs and update deduplication index
-- Author: Antigravity
-- Date: 2024-04-06

DO $$ 
BEGIN 
    -- 1. Add check_out_date column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_logs' AND column_name = 'check_out_date') THEN
        ALTER TABLE public.price_logs ADD COLUMN check_out_date DATE;
    END IF;

    -- 2. Update the deduplication index to include check_out_date
    -- Drop old index if exists
    DROP INDEX IF EXISTS idx_price_logs_dedup;

    -- Create new unique index including check_out_date
    CREATE UNIQUE INDEX idx_price_logs_dedup 
    ON public.price_logs (
        hotel_id, 
        check_in_date, 
        check_out_date, 
        date_trunc('minute', recorded_at AT TIME ZONE 'UTC')
    );
END $$;
