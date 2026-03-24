-- Migration: Sync Metadata Schema
-- Description: Adds missing columns to hotels and hotel_directory tables to match Pydantic models.
-- Date: 2026-03-17

-- 1. Enable Vector Extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Update 'hotels' table
ALTER TABLE public.hotels 
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS rating DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS review_count INTEGER,
    ADD COLUMN IF NOT EXISTS stars DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS property_token TEXT,
    ADD COLUMN IF NOT EXISTS fixed_check_in DATE,
    ADD COLUMN IF NOT EXISTS fixed_check_out DATE,
    ADD COLUMN IF NOT EXISTS default_adults INTEGER DEFAULT 2,
    ADD COLUMN IF NOT EXISTS sentiment_breakdown JSONB,
    ADD COLUMN IF NOT EXISTS pricing_dna TEXT,
    ADD COLUMN IF NOT EXISTS sentiment_embedding vector(768),
    ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'current',
    ADD COLUMN IF NOT EXISTS reviews JSONB,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS website TEXT,
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS cid TEXT,
    ADD COLUMN IF NOT EXISTS place_id TEXT;

-- 3. Update 'hotel_directory' table
ALTER TABLE public.hotel_directory
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS website TEXT,
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS cid TEXT,
    ADD COLUMN IF NOT EXISTS place_id TEXT,
    ADD COLUMN IF NOT EXISTS property_token TEXT,
    ADD COLUMN IF NOT EXISTS sentiment_breakdown JSONB,
    ADD COLUMN IF NOT EXISTS pricing_dna TEXT,
    ADD COLUMN IF NOT EXISTS reviews JSONB;

-- 4. Re-grant permissions
GRANT ALL ON TABLE public.hotels TO postgres, service_role, authenticated;
GRANT ALL ON TABLE public.hotel_directory TO postgres, service_role, authenticated, anon;
