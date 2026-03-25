-- Migration: 010_pricing_dna.sql
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
$$;