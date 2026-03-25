-- Migration 006: Fix Embedding Dimensions (768 -> 3072)
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
$$;