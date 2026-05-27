-- Migration 045: Provision Hotels Vector Embedding Columns and Align Dimensions to 768 (Performance Boost)
-- Description: Adds 'embedding' and 'semantic_description' columns to public.hotels (aligned to 768 dimensions), provisions HNSW index, and creates/re-creates the match_hotels_simple RPC function.

-- 1. Drop the legacy match_hotels 3-parameter signature to clean up
DROP FUNCTION IF EXISTS public.match_hotels(vector(1536), float, int);
DROP FUNCTION IF EXISTS public.match_hotels(vector(768), float, int);

-- 2. Drop existing match_hotels_simple RPC function if it exists
DROP FUNCTION IF EXISTS public.match_hotels_simple(vector(768), float, int);

-- 3. Drop the old HNSW index if it exists
DROP INDEX IF EXISTS idx_hotels_embedding;

-- 4. Add embedding and semantic_description columns if they do not exist
ALTER TABLE public.hotels ADD COLUMN IF NOT EXISTS embedding vector(768);
ALTER TABLE public.hotels ADD COLUMN IF NOT EXISTS semantic_description TEXT;

-- 5. Alter the public.hotels.embedding column type to vector(768) (if it was somehow created as 1536 previously)
ALTER TABLE public.hotels ALTER COLUMN embedding TYPE vector(768);

-- 6. Create/Re-create the HNSW index on vector(768) using cosine similarity
CREATE INDEX IF NOT EXISTS idx_hotels_embedding ON public.hotels USING hnsw (embedding vector_cosine_ops);

-- 7. Create/Re-create the match_hotels_simple RPC function with vector(768) signature
CREATE OR REPLACE FUNCTION public.match_hotels_simple(
    query_embedding vector(768),
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
        (1 - (h.embedding <=> query_embedding))::float AS similarity
    FROM public.hotels h
    WHERE h.embedding IS NOT NULL AND (1 - (h.embedding <=> query_embedding)) > match_threshold
    ORDER BY h.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
