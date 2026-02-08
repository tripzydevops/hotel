-- Migration: 007_add_guest_mentions.sql
-- Description: Add 'guest_mentions' JSONB column to hotels table for sentiment analysis.
ALTER TABLE hotels
ADD COLUMN IF NOT EXISTS guest_mentions JSONB DEFAULT '[]'::jsonb;
COMMENT ON COLUMN hotels.guest_mentions IS 'List of guest mentions with sentiment (e.g. [{"text": "Great Location", "count": 25, "sentiment": "positive"}])';