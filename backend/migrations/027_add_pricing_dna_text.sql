-- Migration: 027_add_pricing_dna_text.sql
-- Description: Add readable text column for Pricing DNA strategy.
ALTER TABLE hotels 
ADD COLUMN IF NOT EXISTS pricing_dna_text TEXT;

COMMENT ON COLUMN hotels.pricing_dna_text IS 'Readable AI-generated pricing strategy description.';
