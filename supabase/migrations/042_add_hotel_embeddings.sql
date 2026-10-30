-- Migration: Add Hotel Embeddings and Hybrid Match RPC
-- Description: Enables semantic vector search for the Autonomous Recommendation Engine

-- 1. Add embedding column to hotels table
ALTER TABLE public.hotels 
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS semantic_description TEXT;

-- 2. Create an HNSW index for fast nearest-neighbor search (requires pgvector)
CREATE INDEX IF NOT EXISTS idx_hotels_embedding ON public.hotels USING hnsw (embedding vector_cosine_ops);

-- 3. Create the Hybrid Match RPC for the recommendation engine
CREATE OR REPLACE FUNCTION public.match_hotels(
    query_embedding vector(1536),
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    location TEXT,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        h.id,
        h.name,
        h.location,
        1 - (h.embedding <=> query_embedding) AS similarity
    FROM public.hotels h
    WHERE 1 - (h.embedding <=> query_embedding) > match_threshold
    ORDER BY h.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
