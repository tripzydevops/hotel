-- Migration: 042_add_price_logs_composite_index.sql
-- Description: Add composite index on price_logs for faster market analysis queries.
-- This index dramatically speeds up the raw_logs CTE in get_market_analysis_aggregates()
-- which filters by hotel_id and orders by recorded_at DESC.
-- Impact: Reduces scan from ~5000 row sequential scan to targeted index lookup.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_price_logs_hotel_checkin_recorded
ON public.price_logs (hotel_id, check_in_date, recorded_at DESC);
