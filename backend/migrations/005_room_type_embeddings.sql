-- Migration 005: Room Type Semantic Matching
-- Creates a catalog of room types with vector embeddings
-- for cross-hotel room equivalence matching.
-- 1. Room Type Catalog Table
-- Stores unique room types per hotel with their semantic embeddings.
-- This enables matching "Standart Oda" ≈ "Classic Room" across hotels.
CREATE TABLE IF NOT EXISTS room_type_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
COMMENT ON TABLE price_history_daily IS 'Aggregated daily price summaries for long-term storage after raw price_logs are archived';