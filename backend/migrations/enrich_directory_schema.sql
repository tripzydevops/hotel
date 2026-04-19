-- Enrich Hotel Directory Schema
-- Adds support for DataForSEO location mapping and verified coordinates

DO $$ 
BEGIN
    -- Location Code (DataForSEO identifier)
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'hotel_directory' AND COLUMN_NAME = 'location_code') THEN
        ALTER TABLE hotel_directory ADD COLUMN location_code INTEGER;
    END IF;

    -- Resolved Location Name (Canonical name from DataForSEO)
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'hotel_directory' AND COLUMN_NAME = 'resolved_location_name') THEN
        ALTER TABLE hotel_directory ADD COLUMN resolved_location_name TEXT;
    END IF;

    -- Location Verified Flag
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'hotel_directory' AND COLUMN_NAME = 'location_verified') THEN
        ALTER TABLE hotel_directory ADD COLUMN location_verified BOOLEAN DEFAULT FALSE;
    END IF;
END $$;
