-- Migration: 023_add_metadata_to_price_logs.sql
-- Description: Adds a metadata column for quality tracking and a unique constraint for deduplication.
-- 1. Add metadata column to price_logs
ALTER TABLE public.price_logs
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
-- 2. Add comment
COMMENT ON COLUMN public.price_logs.metadata IS 'Stores data quality flags and scan context (e.g. is_shallow, extraction_depth)';
-- 3. Clean up existing duplicates before creating the unique index
-- If multiple logs exist for same hotel/check-in within same minute, keep only the latest.
DELETE FROM public.price_logs
WHERE id IN (
        SELECT id
        FROM (
                SELECT id,
                    ROW_NUMBER() OVER(
                        PARTITION BY hotel_id,
                        check_in_date,
                        date_trunc('minute', recorded_at AT TIME ZONE 'UTC')
                        ORDER BY recorded_at DESC
                    ) as row_num
                FROM public.price_logs
            ) t
        WHERE t.row_num > 1
    );
-- 4. Create a unique index for deduplication
-- Prevents duplicate logs for the same hotel and check-in date recorded in the same scan window.
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_logs_deduplication ON public.price_logs (
    hotel_id,
    check_in_date,
    date_trunc('minute', recorded_at AT TIME ZONE 'UTC')
);
-- 5. GIN Index for metadata performance
CREATE INDEX IF NOT EXISTS idx_price_logs_metadata ON public.price_logs USING GIN (metadata);