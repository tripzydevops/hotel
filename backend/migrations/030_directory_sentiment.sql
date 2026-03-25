-- Migration: 030_directory_sentiment.sql
-- Description: Add sentiment_breakdown and reviews to hotel_directory to persist historical data for all users.

ALTER TABLE hotel_directory
ADD COLUMN IF NOT EXISTS sentiment_breakdown JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS reviews JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN hotel_directory.sentiment_breakdown IS 'Historical sentiment breakdown persisted for all users';
COMMENT ON COLUMN hotel_directory.reviews IS 'Top review snippets persisted for all users';
