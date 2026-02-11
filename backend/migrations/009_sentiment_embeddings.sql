-- Migration: 009_sentiment_embeddings.sql
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
$$;