-- Add serp_api_id column to hotels and hotel_directory
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS serp_api_id text;
ALTER TABLE hotel_directory ADD COLUMN IF NOT EXISTS serp_api_id text;

-- Populate serp_api_id from property_token if exists
UPDATE hotels SET serp_api_id = property_token WHERE serp_api_id IS NULL AND property_token IS NOT NULL;
UPDATE hotel_directory SET serp_api_id = property_token WHERE serp_api_id IS NULL AND property_token IS NOT NULL;

-- Add indices for performance
CREATE INDEX IF NOT EXISTS idx_hotels_serp_api_id ON hotels(serp_api_id);
CREATE INDEX IF NOT EXISTS idx_hotel_directory_serp_api_id ON hotel_directory(serp_api_id);
