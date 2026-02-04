-- Migration: 005_sentiment_columns.sql
-- Description: Add detailed sentiment storage: 'sentiment_breakdown' (stats) and 'reviews' (text snippets).
ALTER TABLE hotels
ADD COLUMN IF NOT EXISTS sentiment_breakdown JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS reviews JSONB DEFAULT '[]'::jsonb;
COMMENT ON COLUMN hotels.sentiment_breakdown IS 'Statistical breakdown of sentiment (e.g. {"rooms": 4.5, "service": 3.8})';
COMMENT ON COLUMN hotels.reviews IS 'Top review snippets fetched via Deep Fetch (e.g. [{"text": "...", "sentiment": "pos"}])';