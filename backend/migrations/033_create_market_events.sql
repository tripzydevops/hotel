-- Migration: 033_create_market_events.sql
-- Description: Table for storing market events (fairs, announcements) for demand compression scoring.

-- Ensure required extensions are available
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Create the table
CREATE TABLE IF NOT EXISTS public.market_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'fair', 'announcement', etc.
    city TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    description TEXT,
    compression_score INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    region_tag TEXT,
    location public.geography(POINT, 4326),
    
    -- Ensure uniqueness for scrapers to handle upserts correctly
    CONSTRAINT market_events_name_start_date_key UNIQUE (name, start_date)
);

-- Enable RLS
ALTER TABLE public.market_events ENABLE ROW LEVEL SECURITY;

-- Initial Policies (Stealth/Dev Mode: Allow public read, restricted write to service role or admins)
DROP POLICY IF EXISTS "Public can read market events" ON public.market_events;
CREATE POLICY "Public can read market events" ON public.market_events
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage market events" ON public.market_events;
CREATE POLICY "Service role can manage market events" ON public.market_events
    FOR ALL USING (true); -- Note: In production, this should be restricted to service_role or authenticated admins

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_market_events_updated_at ON public.market_events;
CREATE TRIGGER update_market_events_updated_at
    BEFORE UPDATE ON public.market_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
