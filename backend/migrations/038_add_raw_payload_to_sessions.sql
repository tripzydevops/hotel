-- Migration: Add raw_payload column to scan_sessions for 'Everything Vault'
-- Description: Stores the raw API response or metadata for background scans.

ALTER TABLE scan_sessions ADD COLUMN IF NOT EXISTS raw_payload JSONB;
