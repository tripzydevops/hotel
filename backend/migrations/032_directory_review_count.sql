-- Migration: 032_directory_review_count.sql
-- Description: Add review_count to hotel_directory for consistent cross-user recovery.

ALTER TABLE hotel_directory
ADD COLUMN IF NOT EXISTS review_count INTEGER;

COMMENT ON COLUMN hotel_directory.review_count IS 'Total number of reviews for the hotel, shared across all users.';

-- Index for performance if we ever filter by review volume
CREATE INDEX IF NOT EXISTS idx_hotel_directory_review_count ON hotel_directory(review_count);
