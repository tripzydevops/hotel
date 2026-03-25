-- Enrich query_logs with price and vendor information
-- Migration: 008_enrich_query_logs.sql
ALTER TABLE query_logs
ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS currency TEXT,
    ADD COLUMN IF NOT EXISTS vendor TEXT;
-- Add comment for documentation
COMMENT ON COLUMN query_logs.price IS 'Price captured during the scan';
COMMENT ON COLUMN query_logs.currency IS 'Currency of the captured price';
COMMENT ON COLUMN query_logs.vendor IS 'Booking vendor (e.g. Booking.com, Hotels.com)';