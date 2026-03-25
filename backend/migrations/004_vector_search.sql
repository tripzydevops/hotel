-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
-- Add embedding column to hotel_directory for semantic search
ALTER TABLE hotel_directory
ADD COLUMN IF NOT EXISTS embedding vector(768);
-- Create an HNSW index for high-speed similarity search
CREATE INDEX IF NOT EXISTS hotel_directory_embedding_idx ON hotel_directory USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
-- Comment for documentation
COMMENT ON COLUMN hotel_directory.embedding IS 'Semantic embedding of hotel metadata (vibe, segment, location) for autonomous discovery.';
-- RPC function for vector similarity search
CREATE OR REPLACE FUNCTION match_hotels (
        query_embedding vector(768),
        match_threshold float,
        match_count int,
        target_hotel_id uuid
    ) RETURNS TABLE (
        id uuid,
        name text,
        location text,
        stars float,
        rating float,
        similarity float
    ) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY
SELECT h.id,
    h.name,
    h.location,
    h.stars::float,
    h.rating::float,
    (1 - (h.embedding <=> query_embedding))::float AS similarity
FROM hotel_directory h
WHERE 1 - (h.embedding <=> query_embedding) > match_threshold
    AND h.id <> target_hotel_id
ORDER BY similarity DESC
LIMIT match_count;
END;
$$;