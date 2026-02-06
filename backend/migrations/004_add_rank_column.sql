-- Add search_rank column to price_logs if it doesn't exist
ALTER TABLE price_logs
ADD COLUMN IF NOT EXISTS search_rank INTEGER DEFAULT NULL;