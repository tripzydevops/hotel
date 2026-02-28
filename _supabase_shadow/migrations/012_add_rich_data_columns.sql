-- Migration: 012_add_rich_data_columns.sql
-- Description: Add columns for rich hotel data (ratings, images, amenities) and detailed price info (offers, room types)
-- 1. Enrich hotels table
ALTER TABLE hotels
ADD COLUMN IF NOT EXISTS rating NUMERIC(3, 1),
    ADD COLUMN IF NOT EXISTS stars NUMERIC(2, 1),
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS amenities JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
-- 2. Enrich price_logs table
ALTER TABLE price_logs
ADD COLUMN IF NOT EXISTS vendor TEXT,
    ADD COLUMN IF NOT EXISTS offers JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS room_types JSONB DEFAULT '[]'::jsonb;
-- 3. Add comments
COMMENT ON COLUMN hotels.rating IS 'Overall user rating (e.g. 4.5)';
COMMENT ON COLUMN hotels.stars IS 'Hotel star class (e.g. 5)';
COMMENT ON COLUMN hotels.amenities IS 'List of hotel amenities';
COMMENT ON COLUMN price_logs.offers IS 'List of alternative offers from different vendors';