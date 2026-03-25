-- Migration: 028_hnsw_audit_fix.sql
-- Description: Consolidated HNSW index audit to ensure high-speed vector discovery for all intelligence layers.
-- Part of Hyperspeed Phase 3 polish.

-- 1. Ensure hotels.pricing_dna is optimized
CREATE INDEX IF NOT EXISTS idx_hotels_pricing_dna_hnsw ON hotels 
USING hnsw (pricing_dna vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- 2. Ensure hotels.sentiment_embedding is optimized
CREATE INDEX IF NOT EXISTS idx_hotels_sentiment_embedding_hnsw ON hotels 
USING hnsw (sentiment_embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- 3. Ensure hotel_directory.embedding is optimized (Divergence check)
CREATE INDEX IF NOT EXISTS idx_hotel_directory_embedding_hnsw ON hotel_directory 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- 4. Ensure room_type_catalog.embedding is optimized
CREATE INDEX IF NOT EXISTS idx_room_type_catalog_embedding_hnsw ON room_type_catalog 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- 5. Add GIN index for text search on location (Bonus Speed Audit)
CREATE INDEX IF NOT EXISTS idx_hotels_location_trgm ON hotels USING gin (location gin_trgm_ops);

-- Documentation
COMMENT ON INDEX idx_hotels_pricing_dna_hnsw IS 'HNSW index for aggressive pricing strategy matching';
COMMENT ON INDEX idx_hotels_sentiment_embedding_hnsw IS 'HNSW index for high-fidelity hotel sentiment profile discovery';
