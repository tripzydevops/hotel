-- Add observation_date to allow historical trends (Price for date X as seen on Day Y)
ALTER TABLE price_history_daily ADD COLUMN IF NOT EXISTS observation_date DATE;

-- Composite unique constraint to prevent duplicate rollups
-- Note: Depending on existing data, this might fail if duplicates already exist.
-- But since it's unused, it should be safe.
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_history_daily_unique_obs 
ON price_history_daily (hotel_id, date, observation_date);
