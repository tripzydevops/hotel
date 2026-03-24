-- Migration: Create Autonomous Location Registry
-- Description: Creates a self-learning registry for countries, cities, and towns.
-- 1. Create the registry table
CREATE TABLE IF NOT EXISTS public.location_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country TEXT NOT NULL,
    city TEXT NOT NULL,
    district TEXT DEFAULT '',
    occurrence_count INTEGER DEFAULT 1,
    is_verified BOOLEAN DEFAULT false,
    discovered_at TIMESTAMPTZ DEFAULT now(),
    last_updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(country, city, district)
);
-- 2. Add indexes for fast dropdown lookups
CREATE INDEX IF NOT EXISTS idx_location_hierarchy ON public.location_registry(country, city);
CREATE INDEX IF NOT EXISTS idx_location_popularity ON public.location_registry(occurrence_count DESC);
-- 3. Function to seed registry from existing data
CREATE OR REPLACE FUNCTION public.seed_location_registry() RETURNS INTEGER AS $$
DECLARE inserted_count INTEGER;
BEGIN -- Extract locations from hotels table
INSERT INTO public.location_registry (country, city, district)
SELECT DISTINCT COALESCE(preferred_currency, 'Turkey') as country,
    -- Fallback for existing data
    split_part(location, ',', 1) as city,
    split_part(location, ',', 2) as district
FROM public.hotels ON CONFLICT (country, city, district) DO NOTHING;
GET DIAGNOSTICS inserted_count = ROW_COUNT;
RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;
-- 4. Execute seed
SELECT public.seed_location_registry();