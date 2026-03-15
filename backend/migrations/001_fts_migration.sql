-- Enable the pg_trgm extension for fuzzy searching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN index on 'name' for fast ilike %term% searches
CREATE INDEX IF NOT EXISTS idx_hotel_directory_name_trgm ON public.hotel_directory USING gin (name gin_trgm_ops);

-- Create GIN index on 'location' for fast ilike %term% searches
CREATE INDEX IF NOT EXISTS idx_hotel_directory_location_trgm ON public.hotel_directory USING gin (location gin_trgm_ops);

-- Optional: Create a combined index if we frequently search both
-- CREATE INDEX IF NOT EXISTS idx_hotel_directory_search_trgm ON public.hotel_directory USING gin ((name || ' ' || location) gin_trgm_ops);
