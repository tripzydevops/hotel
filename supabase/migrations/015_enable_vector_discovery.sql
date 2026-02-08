-- Migration: 015_enable_vector_discovery.sql
-- Description: Enable pgvector and implement semantic search for Ghost Competitors
-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
-- 2. Add embedding column to hotel_directory
ALTER TABLE hotel_directory
ADD COLUMN IF NOT EXISTS embedding vector(768);
-- 3. Create HNSW index for high-speed similarity search
CREATE INDEX IF NOT EXISTS idx_hotel_directory_embedding ON hotel_directory USING hnsw (embedding vector_cosine_ops);
-- 4. Implement match_hotels RPC 
-- This function finds properties similar to a target hotel, excluding the target itself.
CREATE OR REPLACE FUNCTION match_hotels (
        query_embedding vector(768),
        match_threshold float,
        match_count int,
        target_hotel_id text
    ) RETURNS TABLE (
        id uuid,
        name text,
        location text,
        stars numeric,
        rating numeric,
        similarity float
    ) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY
SELECT hd.id,
    hd.name,
    hd.location,
    hd.stars,
    hd.rating,
    1 - (hd.embedding <=> query_embedding) AS similarity
FROM hotel_directory hd
WHERE 1 - (hd.embedding <=> query_embedding) > match_threshold
    AND hd.serp_api_id != target_hotel_id -- Exclude target itself (using SerpApi ID for directory)
ORDER BY hd.embedding <=> query_embedding
LIMIT match_count;
END;
$$;