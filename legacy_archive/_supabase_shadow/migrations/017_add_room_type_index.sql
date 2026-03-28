-- Add GIN index on room_types JSONB column for faster search performance
CREATE INDEX IF NOT EXISTS idx_price_logs_room_types ON price_logs USING gin (room_types);
