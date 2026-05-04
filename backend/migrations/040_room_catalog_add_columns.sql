-- Migration: 040_room_catalog_add_columns.sql
-- Description: Add missing columns to room_type_catalog that scan_persistence.py writes to.
-- These were causing PGRST204 schema errors during hotel_info scan persistence.

ALTER TABLE room_type_catalog ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE room_type_catalog ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE room_type_catalog ADD COLUMN IF NOT EXISTS capacity INTEGER;
ALTER TABLE room_type_catalog ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN room_type_catalog.source IS 'OTA source name (e.g. Booking.com, Expedia)';
COMMENT ON COLUMN room_type_catalog.url IS 'Direct URL to the room listing on the source OTA';
COMMENT ON COLUMN room_type_catalog.capacity IS 'Max guest capacity for the room type';
COMMENT ON COLUMN room_type_catalog.image_url IS 'Primary image URL of the room type';

NOTIFY pgrst, 'reload schema';
