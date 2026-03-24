-- Definitive Repair and Recovery Script
-- Generated during system recovery task

-- 1. Schema Reconstruction (if not present)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.hotel_directory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT,
    serp_api_id TEXT UNIQUE,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    rating DOUBLE PRECISION,
    stars INTEGER,
    image_url TEXT,
    review_count INTEGER,
    amenities TEXT[],
    embedding VECTOR(768),
    last_verified_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. User Profile Alignment
UPDATE user_profiles 
SET role = 'authenticated', 
    is_verified = true, 
    plan_type = 'enterprise' 
WHERE email = 'successofmentors@gmail.com';

UPDATE profiles 
SET role = 'authenticated' 
WHERE email = 'successofmentors@gmail.com';

-- 3. Discovery RPC
CREATE OR REPLACE FUNCTION public.match_hotels(
    query_embedding vector(768),
    match_threshold double precision,
    match_count integer,
    target_hotel_id text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    name text,
    location text,
    similarity double precision,
    image_url text,
    rating double precision,
    stars integer,
    review_count integer
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        hd.id,
        hd.name,
        hd.location,
        1 - (hd.embedding <=> query_embedding) AS similarity,
        hd.image_url,
        hd.rating,
        hd.stars,
        hd.review_count
    FROM hotel_directory hd
    WHERE (1 - (hd.embedding <=> query_embedding)) > match_threshold
      AND (target_hotel_id IS NULL OR hd.serp_api_id = target_hotel_id)
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;
