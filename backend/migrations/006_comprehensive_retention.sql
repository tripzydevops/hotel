-- 1. Upgrade price_history_daily with analytical columns
ALTER TABLE price_history_daily ADD COLUMN IF NOT EXISTS observation_date DATE;
ALTER TABLE price_history_daily ADD COLUMN IF NOT EXISTS room_type_summary JSONB DEFAULT '{}'::jsonb;
ALTER TABLE price_history_daily ADD COLUMN IF NOT EXISTS sentiment_snapshot JSONB DEFAULT '{}'::jsonb;
ALTER TABLE price_history_daily ADD COLUMN IF NOT EXISTS parity_metrics JSONB DEFAULT '{}'::jsonb;
ALTER TABLE price_history_daily ADD COLUMN IF NOT EXISTS top_vendor TEXT;

-- Composite unique constraint to prevent duplicate rollups (Hotel + Stay Date + Obs Date)
-- Using INDEX instead of CONSTRAINT to allow IF NOT EXISTS
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_history_daily_unique_obs 
ON price_history_daily (hotel_id, date, observation_date);

-- 2. Create Maintenance Logs table
CREATE TABLE IF NOT EXISTS maintenance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_name TEXT NOT NULL,
    status TEXT NOT NULL,
    rows_processed INTEGER DEFAULT 0,
    rows_deleted INTEGER DEFAULT 0,
    duration_ms INTEGER,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_logs_task_created ON maintenance_logs (task_name, created_at DESC);
