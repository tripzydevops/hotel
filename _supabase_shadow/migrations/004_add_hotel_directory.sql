-- Shared Hotel Directory for Auto-complete
-- Migration: 004_add_hotel_directory.sql

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE hotel_directory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  serp_api_id TEXT,
  popularity_score INT DEFAULT 1,
  last_verified_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Prevent duplicates for the same hotel in the same city
  UNIQUE(name, location)
);

-- Enable RLS
ALTER TABLE hotel_directory ENABLE ROW LEVEL SECURITY;

-- Allow public read access for auto-complete
CREATE POLICY "Public read access for hotel_directory" ON hotel_directory
  FOR SELECT USING (true);

-- Only service role can modify (backend)
CREATE POLICY "Service role can modify hotel_directory" ON hotel_directory
  FOR ALL USING (true);

-- Index for search performance
CREATE INDEX idx_hotel_directory_name_trgm ON hotel_directory USING gin (name gin_trgm_ops);
CREATE INDEX idx_hotel_directory_location ON hotel_directory(location);
