-- Add per-hotel default scan settings
ALTER TABLE hotels
ADD COLUMN IF NOT EXISTS fixed_check_in DATE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS fixed_check_out DATE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS default_adults INTEGER DEFAULT 2;
-- Comment for clarity
COMMENT ON COLUMN hotels.fixed_check_in IS 'Optional: Override global check-in date for this hotel';
COMMENT ON COLUMN hotels.fixed_check_out IS 'Optional: Override global check-out date for this hotel';
COMMENT ON COLUMN hotels.default_adults IS 'Optional: Override global adults count for this hotel';