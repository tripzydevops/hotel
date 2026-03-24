-- Migration 011: Add embedding_status to hotels
-- This helps track when a hotel's metadata is updated but its AI embedding is pending or failed.

ALTER TABLE hotels 
ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'current' 
CHECK (embedding_status IN ('current', 'stale', 'failed'));

-- Update existing rows to 'current'
UPDATE hotels SET embedding_status = 'current' WHERE embedding_status IS NULL;
