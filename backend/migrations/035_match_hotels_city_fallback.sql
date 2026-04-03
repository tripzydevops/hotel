-- Migration 035: Enhanced match_hotels with City Fallback
-- This version ensures that if coordinates are missing, it falls back to city-level string matching
-- to prevent cross-city "semantic leakage" (e.g. Istanbul matching Denizli).

CREATE OR REPLACE FUNCTION public.match_hotels(
    query_embedding vector(768),
    match_threshold double precision,
    match_count integer,
    target_hotel_id uuid,
    target_lat double precision DEFAULT NULL,
    target_lon double precision DEFAULT NULL,
    max_distance_km double precision DEFAULT NULL,
    target_city text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    name text,
    location text,
    similarity double precision,
    stars double precision,
    rating double precision,
    distance double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        h.id,
        h.name,
        h.location,
        (1 - (h.embedding <=> query_embedding))::float AS similarity,
        h.stars::float,
        h.rating::float,
        CASE
            WHEN target_lat IS NULL OR target_lon IS NULL OR h.latitude IS NULL OR h.longitude IS NULL THEN NULL
            ELSE (
                6371 * acos(
                    LEAST(1.0, GREATEST(-1.0, 
                        cos(radians(target_lat)) * cos(radians(h.latitude)) *
                        cos(radians(h.longitude) - radians(target_lon)) +
                        sin(radians(target_lat)) * sin(radians(h.latitude))
                    ))
                )
            )::float
        END AS distance
    FROM hotel_directory h
    WHERE 
        -- 1. Semantic Similarity Threshold
        (1 - (h.embedding <=> query_embedding)) > match_threshold
        
        -- 2. Exclude the target hotel itself
        AND h.id <> target_hotel_id
        
        -- 3. Proximity or City Fallback
        AND (
            -- High Priority: Strict Distance Check (if coordinates exist for both)
            (
                target_lat IS NOT NULL AND target_lon IS NOT NULL AND h.latitude IS NOT NULL AND h.longitude IS NOT NULL
                AND (
                    6371 * acos(
                        LEAST(1.0, GREATEST(-1.0, 
                            cos(radians(target_lat)) * cos(radians(h.latitude)) *
                            cos(radians(h.longitude) - radians(target_lon)) +
                            sin(radians(target_lat)) * sin(radians(h.latitude))
                        ))
                    ) <= COALESCE(max_distance_km, 50) -- Default to 50km if radius not set
                )
            )
            OR
            -- Fallback: City Match (if coordinates are missing for either)
            (
                (target_lat IS NULL OR target_lon IS NULL OR h.latitude IS NULL OR h.longitude IS NULL)
                AND (
                    target_city IS NULL 
                    OR h.location ILIKE '%' || target_city || '%'
                )
            )
        )
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- Drop legacy overloads to avoid confusion (careful: only if they exist)
-- DROP FUNCTION IF EXISTS public.match_hotels(vector, double precision, integer, text);
