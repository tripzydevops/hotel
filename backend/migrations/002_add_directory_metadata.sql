-- Add metadata columns to hotel_directory
ALTER TABLE hotel_directory
ADD COLUMN IF NOT EXISTS stars INTEGER,
    ADD COLUMN IF NOT EXISTS rating FLOAT,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS amenities TEXT [],
    ADD COLUMN IF NOT EXISTS images JSONB;
COMMENT ON COLUMN hotel_directory.stars IS 'Star rating (1-5)';
COMMENT ON COLUMN hotel_directory.rating IS 'User rating (0-10)';
COMMENT ON COLUMN hotel_directory.images IS 'List of image objects {url, caption}';