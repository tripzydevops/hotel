
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "postgis";
DROP TABLE IF EXISTS hotel_directory CASCADE;
DROP TABLE IF EXISTS location_registry CASCADE;
DROP TABLE IF EXISTS membership_plans CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS hotels CASCADE;
DROP TABLE IF EXISTS price_logs CASCADE;
DROP TABLE IF EXISTS query_logs CASCADE;
DROP TABLE IF EXISTS scan_sessions CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS admin_settings CASCADE;
DROP TABLE IF EXISTS market_events CASCADE;
DROP TABLE IF EXISTS sentiment_history CASCADE;

-- Migration: Add Rich Data Columns
-- Run this in Supabase SQL Editor
ALTER TABLE hotels
ADD COLUMN IF NOT EXISTS amenities JSONB DEFAULT '[]'::JSONB;
ALTER TABLE hotels
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::JSONB;
ALTER TABLE price_logs
ADD COLUMN IF NOT EXISTS offers JSONB DEFAULT '[]'::JSONB;
ALTER TABLE price_logs
ADD COLUMN IF NOT EXISTS room_types JSONB DEFAULT '[]'::JSONB;-- Add metadata columns to hotel_directory
ALTER TABLE hotel_directory
ADD COLUMN IF NOT EXISTS stars INTEGER,
    ADD COLUMN IF NOT EXISTS rating FLOAT,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS amenities TEXT [],
    ADD COLUMN IF NOT EXISTS images JSONB;
COMMENT ON COLUMN hotel_directory.stars IS 'Star rating (1-5)';
COMMENT ON COLUMN hotel_directory.rating IS 'User rating (0-10)';
COMMENT ON COLUMN hotel_directory.images IS 'List of image objects {url, caption}';-- Migration 003: Scan Metadata
-- Adds search parameter columns to scan_sessions and query_logs for better transparency.
-- Update scan_sessions
ALTER TABLE scan_sessions
ADD COLUMN IF NOT EXISTS check_in_date DATE,
    ADD COLUMN IF NOT EXISTS check_out_date DATE,
    ADD COLUMN IF NOT EXISTS adults INTEGER DEFAULT 2,
    ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'TRY';
-- Update query_logs
ALTER TABLE query_logs
ADD COLUMN IF NOT EXISTS check_in_date DATE,
    ADD COLUMN IF NOT EXISTS adults INTEGER DEFAULT 2;
-- Comments for documentation
COMMENT ON COLUMN scan_sessions.check_in_date IS 'The check-in date used for this manual/automated scan session';
COMMENT ON COLUMN scan_sessions.adults IS 'Number of adults specified for the scan';
COMMENT ON COLUMN query_logs.check_in_date IS 'Search date for this specific hotel query';-- Add search_rank column to price_logs if it doesn't exist
ALTER TABLE price_logs
ADD COLUMN IF NOT EXISTS search_rank INTEGER DEFAULT NULL;-- Migration 004: Deep Data & Reasoning
-- Adds tables and columns for high-fidelity market intelligence.
-- 1. Sentiment History (Tracking Quality Velocity)
CREATE TABLE IF NOT EXISTS sentiment_history (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    rating FLOAT,
    review_count INTEGER,
    sentiment_breakdown JSONB DEFAULT '[]',
    -- Stores topic-level sentiment (e.g. Cleanliness, Service)
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
-- Index for fast time-series retrieval of sentiment
CREATE INDEX IF NOT EXISTS idx_sentiment_history_hotel_date ON sentiment_history(hotel_id, recorded_at DESC);
-- 2. Deep Price Data (Tracking Channel Parity)
ALTER TABLE price_logs
ADD COLUMN IF NOT EXISTS parity_offers JSONB DEFAULT '[]',
    -- Stores full list of OTA offers (Booking, Expedia, etc)
ADD COLUMN IF NOT EXISTS room_types JSONB DEFAULT '[]';
-- Stores room class metadata
-- Comments
COMMENT ON COLUMN price_logs.parity_offers IS 'Full list of competitor offers (Vendor, Price) found during scan for parity analysis';
COMMENT ON COLUMN price_logs.room_types IS 'Raw room type data to distinguish Suites from Standard rooms';
-- 3. Reasoning Trace (The "Brain" Audit)
ALTER TABLE scan_sessions
ADD COLUMN IF NOT EXISTS reasoning_trace JSONB DEFAULT '[]';
COMMENT ON COLUMN scan_sessions.reasoning_trace IS 'Ordered log of Analyst Agent decision steps (Normalization, Parity Check, Alert Logic)';-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
-- Add embedding column to hotel_directory for semantic search
ALTER TABLE hotel_directory
ADD COLUMN IF NOT EXISTS embedding vector(768);
-- Create an HNSW index for high-speed similarity search
CREATE INDEX IF NOT EXISTS hotel_directory_embedding_idx ON hotel_directory USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
-- Comment for documentation
COMMENT ON COLUMN hotel_directory.embedding IS 'Semantic embedding of hotel metadata (vibe, segment, location) for autonomous discovery.';
-- RPC function for vector similarity search
CREATE OR REPLACE FUNCTION public.match_hotels(
    query_embedding vector,
    match_threshold double precision,
    match_count integer,
    target_hotel_id uuid,
    target_lat double precision DEFAULT NULL,
    target_lon double precision DEFAULT NULL,
    max_distance_km double precision DEFAULT NULL,
    target_city text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    name text,
    location text,
    similarity double precision,
    stars double precision,
    rating double precision,
    distance double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        h.id,
        h.name,
        h.location,
        COALESCE((1.0 - (h.embedding <=> query_embedding)), 0.0)::float8 as similarity,
        h.stars::float8,
        h.rating::float8,
        CASE
            WHEN target_lat IS NULL OR target_lon IS NULL OR h.latitude IS NULL OR h.longitude IS NULL THEN NULL
            ELSE (
                6371 * acos(
                    LEAST(1.0, GREATEST(-1.0, 
                        cos(radians(target_lat)) * cos(radians(h.latitude)) *
                        cos(radians(h.longitude) - radians(target_lon)) +
                        sin(radians(target_lat)) * sin(radians(h.latitude))
                    ))
                )
            )::float8
        END AS distance
    FROM hotel_directory h
    WHERE 
        (h.embedding IS NOT NULL AND (1.0 - (h.embedding <=> query_embedding)) > match_threshold)
        AND h.id <> target_hotel_id
        AND (
            (
                target_lat IS NOT NULL AND target_lon IS NOT NULL AND h.latitude IS NOT NULL AND h.longitude IS NOT NULL
                AND (
                    6371 * acos(
                        LEAST(1.0, GREATEST(-1.0, 
                            cos(radians(target_lat)) * cos(radians(h.latitude)) *
                            cos(radians(h.longitude) - radians(target_lon)) +
                            sin(radians(target_lat)) * sin(radians(h.latitude))
                        ))
                    ) <= COALESCE(max_distance_km, 50.0)
                )
            )
            OR
            (
                (target_lat IS NULL OR target_lon IS NULL OR h.latitude IS NULL OR h.longitude IS NULL)
                AND (
                    target_city IS NULL 
                    OR h.location ILIKE '%' || target_city || '%'
                )
            )
        )
    ORDER BY COALESCE((1.0 - (h.embedding <=> query_embedding)), 0.0) DESC
    LIMIT match_count;
END;
$$;-- Migration 005: Room Type Semantic Matching
-- Creates a catalog of room types with vector embeddings
-- for cross-hotel room equivalence matching.
-- 1. Room Type Catalog Table
-- Stores unique room types per hotel with their semantic embeddings.
-- This enables matching "Standart Oda" ≈ "Classic Room" across hotels.
CREATE TABLE IF NOT EXISTS room_type_catalog (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    original_name TEXT NOT NULL,
    normalized_name TEXT,
    embedding vector(768),
    avg_price FLOAT,
    currency TEXT DEFAULT 'TRY',
    amenities JSONB DEFAULT '[]',
    sqm FLOAT,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    -- Each hotel should only have one entry per room name
    UNIQUE(hotel_id, original_name)
);
-- 2. HNSW Index for fast similarity search on room type embeddings
CREATE INDEX IF NOT EXISTS room_type_catalog_embedding_idx ON room_type_catalog USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
-- 3. Standard index for hotel_id lookups
CREATE INDEX IF NOT EXISTS room_type_catalog_hotel_idx ON room_type_catalog (hotel_id);
-- 4. RPC function: match_room_types
-- Given a room type's embedding, finds semantically equivalent rooms across hotels.
-- Used by the Rate Calendar to align comparable inventory.
CREATE OR REPLACE FUNCTION match_room_types(
        query_embedding vector(768),
        match_threshold float DEFAULT 0.75,
        match_count int DEFAULT 10,
        source_hotel_id uuid DEFAULT NULL
    ) RETURNS TABLE (
        id uuid,
        hotel_id uuid,
        original_name text,
        normalized_name text,
        avg_price float,
        currency text,
        similarity float
    ) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY
SELECT rt.id,
    rt.hotel_id,
    rt.original_name,
    rt.normalized_name,
    rt.avg_price,
    rt.currency,
    (1 - (rt.embedding <=> query_embedding))::float AS similarity
FROM room_type_catalog rt
WHERE rt.embedding IS NOT NULL
    AND 1 - (rt.embedding <=> query_embedding) > match_threshold
    AND (
        source_hotel_id IS NULL
        OR rt.hotel_id <> source_hotel_id
    )
ORDER BY similarity DESC
LIMIT match_count;
END;
$$;
-- 5. Data Lifecycle: Aggregated price history (for scaling)
-- Stores daily summaries of price data after raw logs are archived.
CREATE TABLE IF NOT EXISTS price_history_daily (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    avg_price FLOAT,
    min_price FLOAT,
    max_price FLOAT,
    source TEXT,
    room_type_summary JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(hotel_id, date, source)
);
CREATE INDEX IF NOT EXISTS price_history_daily_hotel_date_idx ON price_history_daily (hotel_id, date DESC);
-- Documentation
COMMENT ON TABLE room_type_catalog IS 'Catalog of room types with semantic embeddings for cross-hotel room equivalence matching';
COMMENT ON COLUMN room_type_catalog.embedding IS '768-dim Gemini embedding of room metadata for cosine similarity search';
COMMENT ON COLUMN room_type_catalog.normalized_name IS 'AI-normalized room category (e.g. Standard Double, Deluxe Suite)';
COMMENT ON TABLE price_history_daily IS 'Aggregated daily price summaries for long-term storage after raw price_logs are archived';-- Migration: 005_sentiment_columns.sql
-- Description: Add detailed sentiment storage: 'sentiment_breakdown' (stats) and 'reviews' (text snippets).
ALTER TABLE hotels
ADD COLUMN IF NOT EXISTS sentiment_breakdown JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS reviews JSONB DEFAULT '[]'::jsonb;
COMMENT ON COLUMN hotels.sentiment_breakdown IS 'Statistical breakdown of sentiment (e.g. {"rooms": 4.5, "service": 3.8})';
COMMENT ON COLUMN hotels.reviews IS 'Top review snippets fetched via Deep Fetch (e.g. [{"text": "...", "sentiment": "pos"}])';-- Migration: 006_enhance_tiers.sql
-- Description: Add manual scan limits and Enterprise tier.
ALTER TABLE tier_configs
ADD COLUMN IF NOT EXISTS manual_scans_per_day INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sentiment_analysis_enabled BOOLEAN DEFAULT FALSE;
-- Update/Insert Tiers
INSERT INTO tier_configs (
        plan_type,
        max_hotels,
        max_history_days,
        manual_scans_per_day,
        sentiment_analysis_enabled
    )
VALUES ('starter', 5, 30, 0, FALSE),
    ('pro', 25, 90, 0, TRUE),
    -- Pro gets auto-scan but NO manual scan
    ('enterprise', 100, 365, 1, TRUE) -- Enterprise gets 1 manual scan/day + auto-scan
    ON CONFLICT (plan_type) DO
UPDATE
SET max_hotels = EXCLUDED.max_hotels,
    max_history_days = EXCLUDED.max_history_days,
    manual_scans_per_day = EXCLUDED.manual_scans_per_day,
    sentiment_analysis_enabled = EXCLUDED.sentiment_analysis_enabled;-- Migration 006: Fix Embedding Dimensions (768 -> 3072)
-- The new Gemini model (gemini-embedding-001) outputs 3072 dimensions.
-- We must update the schema to match.
-- 1. Alter room_type_catalog table
ALTER TABLE room_type_catalog
ALTER COLUMN embedding TYPE vector(3072);
-- 2. Recreate Index (HNSW)
DROP INDEX IF EXISTS room_type_catalog_embedding_idx;
CREATE INDEX room_type_catalog_embedding_idx ON room_type_catalog USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
-- 3. Update match_room_types RPC
CREATE OR REPLACE FUNCTION match_room_types(
        query_embedding vector(3072),
        -- Updated from 768
        match_threshold float DEFAULT 0.75,
        match_count int DEFAULT 10,
        source_hotel_id uuid DEFAULT NULL
    ) RETURNS TABLE (
        id uuid,
        hotel_id uuid,
        original_name text,
        normalized_name text,
        avg_price float,
        currency text,
        similarity float
    ) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY
SELECT rt.id,
    rt.hotel_id,
    rt.original_name,
    rt.normalized_name,
    rt.avg_price,
    rt.currency,
    (1 - (rt.embedding <=> query_embedding))::float AS similarity
FROM room_type_catalog rt
WHERE rt.embedding IS NOT NULL
    AND 1 - (rt.embedding <=> query_embedding) > match_threshold
    AND (
        source_hotel_id IS NULL
        OR rt.hotel_id <> source_hotel_id
    )
ORDER BY similarity DESC
LIMIT match_count;
END;
$$;-- Migration: 007_add_guest_mentions.sql
-- Description: Add 'guest_mentions' JSONB column to hotels table for sentiment analysis.
ALTER TABLE hotels
ADD COLUMN IF NOT EXISTS guest_mentions JSONB DEFAULT '[]'::jsonb;
COMMENT ON COLUMN hotels.guest_mentions IS 'List of guest mentions with sentiment (e.g. [{"text": "Great Location", "count": 25, "sentiment": "positive"}])';-- Add monthly_scan_limit column to membership_plans
ALTER TABLE membership_plans
ADD COLUMN IF NOT EXISTS monthly_scan_limit INTEGER DEFAULT 100;-- Migration: 009_sentiment_embeddings.sql
-- Description: Add sentiment_embedding vector column and similarity search RPC.
-- 1. Add embedding column to hotels table
ALTER TABLE hotels
ADD COLUMN IF NOT EXISTS sentiment_embedding vector(768);
COMMENT ON COLUMN hotels.sentiment_embedding IS '768-dim Gemini embedding of hotel sentiment profile (reviews + breakdown)';
-- 2. Create HNSW Index for fast similarity search
CREATE INDEX IF NOT EXISTS hotels_sentiment_embedding_idx ON hotels USING hnsw (sentiment_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
-- 3. RPC function: match_hotels_by_sentiment
-- Finds hotels with similar "vibe" based on sentiment embedding.
CREATE OR REPLACE FUNCTION match_hotels_by_sentiment(
        query_embedding vector(768),
        match_threshold float DEFAULT 0.75,
        match_count int DEFAULT 5,
        source_hotel_id uuid DEFAULT NULL
    ) RETURNS TABLE (
        id UUID,
        name TEXT,
        location TEXT,
        stars INT,
        sentiment_breakdown JSONB,
        similarity FLOAT
    ) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY
SELECT h.id,
    h.name,
    h.location,
    h.stars,
    h.sentiment_breakdown,
    (1 - (h.sentiment_embedding <=> query_embedding))::float AS similarity
FROM hotels h
WHERE h.sentiment_embedding IS NOT NULL
    AND 1 - (h.sentiment_embedding <=> query_embedding) > match_threshold
    AND (
        source_hotel_id IS NULL
        OR h.id <> source_hotel_id
    )
ORDER BY similarity DESC
LIMIT match_count;
END;
$$;-- Migration: 010_pricing_dna.sql
-- Description: Add pricing_dna vector column (768 dims) for strategy embeddings.
-- 1. Add embedding column to hotels table
ALTER TABLE hotels
ADD COLUMN IF NOT EXISTS pricing_dna vector(768);
COMMENT ON COLUMN hotels.pricing_dna IS '768-dim Gemini embedding of pricing strategy description (e.g. "Aggressive undercutting")';
-- 2. Create HNSW Index for fast similarity search
CREATE INDEX IF NOT EXISTS hotels_pricing_dna_idx ON hotels USING hnsw (pricing_dna vector_cosine_ops) WITH (m = 16, ef_construction = 64);
-- 3. RPC function: match_pricing_strategy
-- Finds hotels with similar pricing behavior.
CREATE OR REPLACE FUNCTION match_pricing_strategy(
        query_embedding vector(768),
        match_threshold float DEFAULT 0.75,
        match_count int DEFAULT 5,
        source_hotel_id uuid DEFAULT NULL
    ) RETURNS TABLE (
        id UUID,
        name TEXT,
        location TEXT,
        stars INT,
        similarity FLOAT
    ) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY
SELECT h.id,
    h.name,
    h.location,
    h.stars,
    (1 - (h.pricing_dna <=> query_embedding))::float AS similarity
FROM hotels h
WHERE h.pricing_dna IS NOT NULL
    AND 1 - (h.pricing_dna <=> query_embedding) > match_threshold
    AND (
        source_hotel_id IS NULL
        OR h.id <> source_hotel_id
    )
ORDER BY similarity DESC
LIMIT match_count;
END;
$$;-- Migration 011: Add embedding_status to hotels
-- This helps track when a hotel's metadata is updated but its AI embedding is pending or failed.

ALTER TABLE hotels 
ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'current' 
CHECK (embedding_status IN ('current', 'stale', 'failed'));

-- Update existing rows to 'current'
UPDATE hotels SET embedding_status = 'current' WHERE embedding_status IS NULL;
-- Migration 012: Fix Sentiment History Permissions
-- Purpose: Ensure the frontend can read history data for fallback logic

-- 1. Enable RLS (Good practice)
ALTER TABLE sentiment_history ENABLE ROW LEVEL SECURITY;

-- 2. Create Policy for Reading
-- Allow anyone (auth or anon) to read sentiment history?
-- Usually dashboard is authenticated. Let's allow authenticated users.
CREATE POLICY "Allow authenticated users to read sentiment history"
ON sentiment_history FOR SELECT
TO authenticated
USING (true);

-- Also allow service role (always implied, but good to be verified)
-- If we want to allow public read (e.g. for landing page widgets?), we might need anon.
-- For now, 'authenticated' covers the dashboard.
-- Migration: 027_add_pricing_dna_text.sql
-- Description: Add readable text column for Pricing DNA strategy.
ALTER TABLE hotels 
ADD COLUMN IF NOT EXISTS pricing_dna_text TEXT;

COMMENT ON COLUMN hotels.pricing_dna_text IS 'Readable AI-generated pricing strategy description.';
-- Migration: 028_hnsw_audit_fix.sql
-- Description: Consolidated HNSW index audit to ensure high-speed vector discovery for all intelligence layers.
-- Part of Hyperspeed Phase 3 polish.

-- 1. Ensure hotels.pricing_dna is optimized
CREATE INDEX IF NOT EXISTS idx_hotels_pricing_dna_hnsw ON hotels 
USING hnsw (pricing_dna vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- 2. Ensure hotels.sentiment_embedding is optimized
CREATE INDEX IF NOT EXISTS idx_hotels_sentiment_embedding_hnsw ON hotels 
USING hnsw (sentiment_embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- 3. Ensure hotel_directory.embedding is optimized (Divergence check)
CREATE INDEX IF NOT EXISTS idx_hotel_directory_embedding_hnsw ON hotel_directory 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- 4. Ensure room_type_catalog.embedding is optimized
CREATE INDEX IF NOT EXISTS idx_room_type_catalog_embedding_hnsw ON room_type_catalog 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- 5. Add GIN index for text search on location (Bonus Speed Audit)
CREATE INDEX IF NOT EXISTS idx_hotels_location_trgm ON hotels USING gin (location gin_trgm_ops);

-- Documentation
COMMENT ON INDEX idx_hotels_pricing_dna_hnsw IS 'HNSW index for aggressive pricing strategy matching';
COMMENT ON INDEX idx_hotels_sentiment_embedding_hnsw IS 'HNSW index for high-fidelity hotel sentiment profile discovery';
-- Migration 029: Add dynamic threshold columns to settings table
-- Run in Supabase SQL Editor
-- These columns are required for the "Predictive Yield: AI Smart Thresholds" feature

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS dynamic_threshold_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dynamic_threshold_sensitivity FLOAT DEFAULT 1.0;

-- Also notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
-- Migration: 030_directory_sentiment.sql
-- Description: Add sentiment_breakdown and reviews to hotel_directory to persist historical data for all users.

ALTER TABLE hotel_directory
ADD COLUMN IF NOT EXISTS sentiment_breakdown JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS reviews JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN hotel_directory.sentiment_breakdown IS 'Historical sentiment breakdown persisted for all users';
COMMENT ON COLUMN hotel_directory.reviews IS 'Top review snippets persisted for all users';
-- Migration: 032_directory_review_count.sql
-- Description: Add review_count to hotel_directory for consistent cross-user recovery.

ALTER TABLE hotel_directory
ADD COLUMN IF NOT EXISTS review_count INTEGER;

COMMENT ON COLUMN hotel_directory.review_count IS 'Total number of reviews for the hotel, shared across all users.';

-- Index for performance if we ever filter by review volume
CREATE INDEX IF NOT EXISTS idx_hotel_directory_review_count ON hotel_directory(review_count);
-- Migration: 033_create_market_events.sql
-- Description: Table for storing market events (fairs, announcements) for demand compression scoring.

-- Ensure required extensions are available
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Create the table
CREATE TABLE IF NOT EXISTS public.market_events (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
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
-- Add per-hotel default scan settings
ALTER TABLE hotels
ADD COLUMN IF NOT EXISTS fixed_check_in DATE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS fixed_check_out DATE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS default_adults INTEGER DEFAULT 2;
-- Comment for clarity
COMMENT ON COLUMN hotels.fixed_check_in IS 'Optional: Override global check-in date for this hotel';
COMMENT ON COLUMN hotels.fixed_check_out IS 'Optional: Override global check-out date for this hotel';
COMMENT ON COLUMN hotels.default_adults IS 'Optional: Override global adults count for this hotel';CREATE TABLE IF NOT EXISTS admin_settings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    maintenance_mode BOOLEAN DEFAULT FALSE,
    signup_enabled BOOLEAN DEFAULT TRUE,
    default_currency VARCHAR(3) DEFAULT 'USD',
    system_alert_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Secure it (enable RLS but allow everything for now or service role)
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow Service Role Full Access" ON admin_settings TO service_role USING (true) WITH CHECK (true);
-- Also allow authenticated users to READ (so frontend can check maintenance mode)
CREATE POLICY "Allow Auth Users Read" ON admin_settings FOR
SELECT TO authenticated USING (true);
-- Insert default row if not exists. 
-- We use a known ID to simulate a singleton, or just fetch the first row in API.
INSERT INTO admin_settings (
        id,
        maintenance_mode,
        signup_enabled,
        default_currency
    )
SELECT '00000000-0000-0000-0000-000000000000',
    FALSE,
    TRUE,
    'USD'
WHERE NOT EXISTS (
        SELECT 1
        FROM admin_settings
    );-- 1. Create public.profiles table if it doesn't exist
-- This mirrors the auth.users table for public access
create table if not exists public.profiles (id TEXT references auth.users on delete cascade not null primary key,
    updated_at timestamp with time zone,
    email text,
    display_name text,
    company_name text,
    job_title text,
    phone text,
    timezone text default 'UTC',
    -- Membership Fields (from previous task)
    subscription_status text default 'trial',
    plan_type text default 'starter',
    current_period_end timestamp with time zone default (now() + interval '7 days')
);
-- 2. Enable RLS
alter table public.profiles enable row level security;
-- 3. Create policies (if they don't exist)
-- 3. Create policies (Idempotent)
do $$ begin create policy "Public profiles are viewable by everyone." on public.profiles for
select using (true);
exception
when duplicate_object then null;
end $$;
do $$ begin create policy "Users can insert their own profile." on public.profiles for
insert with check (auth.uid() = id);
exception
when duplicate_object then null;
end $$;
do $$ begin create policy "Users can update own profile." on public.profiles for
update using (auth.uid() = id);
exception
when duplicate_object then null;
end $$;
-- 4. Create a trigger to auto-create profile on signup
-- This ensures new users get a profile row immediately
create or replace function public.handle_new_user() returns trigger as $$ begin
insert into public.profiles (id, email)
values (new.id, new.email);
return new;
end;
$$ language plpgsql security definer;
-- Drop trigger if exists to avoid conflicts
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after
insert on auth.users for each row execute procedure public.handle_new_user();
-- 5.1 Backfill user_profiles (The legacy table used by Admin Panel)
-- Ensure column exists first
do $$ begin
alter table public.user_profiles
add column if not exists email text;
exception
when others then null;
end $$;
insert into public.user_profiles (user_id, email, display_name)
select id,
    email,
    split_part(email, '@', 1)
from auth.users
where id not in (
        select user_id
        from public.user_profiles
    );-- Create membership_plans table
CREATE TABLE IF NOT EXISTS membership_plans (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    price_monthly NUMERIC(10, 2) NOT NULL DEFAULT 0,
    hotel_limit INTEGER NOT NULL DEFAULT 1,
    monthly_scan_limit INTEGER NOT NULL DEFAULT 100,
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Seed Initial Plans (Idempotent)
INSERT INTO membership_plans (
        name,
        price_monthly,
        hotel_limit,
        monthly_scan_limit,
        features
    )
VALUES (
        'Trial',
        0,
        1,
        100,
        '["1 Hotel Monitor", "Global Pulse Sync", "Email Alerts"]'
    ),
    (
        'Starter',
        29,
        5,
        500,
        '["5 Hotel Monitors", "Global Pulse Sync", "Email & Push Alerts", "Basic Reports"]'
    ),
    (
        'Pro',
        99,
        25,
        2500,
        '["25 Hotel Monitors", "Global Pulse Sync", "All Alert Types", "Advanced Analytics", "Priority Support"]'
    ),
    (
        'Enterprise',
        299,
        100,
        10000,
        '["100+ Hotel Monitors", "Global Pulse Sync", "Dedicated Account Manager", "Custom Integrations"]'
    ) ON CONFLICT (name) DO NOTHING;
-- Enable RLS
ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;
-- Policies
-- Allow public read access (so frontend can see plans if needed, though usually proxied)
CREATE POLICY "Public read active plans" ON membership_plans FOR
SELECT USING (true);
-- Allow Service Role (Backend) full access implicitly (bypasses RLS)
-- We DO NOT add policies for INSERT/UPDATE/DELETE for 'auth.users' users, 
-- effectively making this table Read-Only for direct client connections.
-- All modifications must go through the Backend API (which uses Service Role).-- Migration: Support SaaS Subscription Model
-- Run this in Supabase SQL Editor
-- 1. Update profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial',
    -- active, trial, past_due, canceled, unpaid
ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'starter',
    -- starter, pro
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days');
-- Default to 7 day trial
-- 2. Create Tier Configuration (Optional, or just hardcode in Backend Service)
-- For simplicity in MVP, we often hardcode these in code, but a table is flexible.
CREATE TABLE IF NOT EXISTS tier_configs (
    plan_type TEXT PRIMARY KEY,
    max_hotels INTEGER NOT NULL,
    max_history_days INTEGER DEFAULT 7
);
-- Seed Tiers
INSERT INTO tier_configs (
        plan_type,
        max_hotels,
        max_history_days
    )
VALUES ('starter', 10, 30),
    ('pro', 50, 365) ON CONFLICT (plan_type) DO
UPDATE
SET max_hotels = EXCLUDED.max_hotels,
    max_history_days = EXCLUDED.max_history_days;