-- Migration 004: Deep Data & Reasoning
-- Adds tables and columns for high-fidelity market intelligence.
-- 1. Sentiment History (Tracking Quality Velocity)
CREATE TABLE IF NOT EXISTS sentiment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    rating FLOAT,
    review_count INTEGER,
    sentiment_breakdown JSONB DEFAULT '[]',
    -- Stores topic-level sentiment (e.g. Cleanliness, Service)
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
-- Index for fast time-series retrieval of sentiment
CREATE INDEX IF NOT EXISTS idx_sentiment_history_hotel_date ON sentiment_history(hotel_id, recorded_at DESC);
-- 2. Deep Price Data (Tracking Channel Parity)
ALTER TABLE price_logs
ADD COLUMN IF NOT EXISTS parity_offers JSONB DEFAULT '[]',
    -- Stores full list of OTA offers (Booking, Expedia, etc)
ADD COLUMN IF NOT EXISTS room_types JSONB DEFAULT '[]';
-- Stores room class metadata
-- Comments
COMMENT ON COLUMN price_logs.parity_offers IS 'Full list of competitor offers (Vendor, Price) found during scan for parity analysis';
COMMENT ON COLUMN price_logs.room_types IS 'Raw room type data to distinguish Suites from Standard rooms';
-- 3. Reasoning Trace (The "Brain" Audit)
ALTER TABLE scan_sessions
ADD COLUMN IF NOT EXISTS reasoning_trace JSONB DEFAULT '[]';
COMMENT ON COLUMN scan_sessions.reasoning_trace IS 'Ordered log of Analyst Agent decision steps (Normalization, Parity Check, Alert Logic)';