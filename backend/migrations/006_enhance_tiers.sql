-- Migration: 006_enhance_tiers.sql
-- Description: Add manual scan limits and Enterprise tier.
ALTER TABLE tier_configs
ADD COLUMN IF NOT EXISTS manual_scans_per_day INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sentiment_analysis_enabled BOOLEAN DEFAULT FALSE;
-- Update/Insert Tiers
INSERT INTO tier_configs (
        plan_type,
        max_hotels,
        can_scan_hourly,
        max_history_days,
        manual_scans_per_day,
        sentiment_analysis_enabled
    )
VALUES ('starter', 5, FALSE, 30, 0, FALSE),
    ('pro', 25, TRUE, 90, 0, TRUE),
    -- Pro gets auto-scan but NO manual scan
    ('enterprise', 100, TRUE, 365, 1, TRUE) -- Enterprise gets 1 manual scan/day + auto-scan
    ON CONFLICT (plan_type) DO
UPDATE
SET max_hotels = EXCLUDED.max_hotels,
    can_scan_hourly = EXCLUDED.can_scan_hourly,
    max_history_days = EXCLUDED.max_history_days,
    manual_scans_per_day = EXCLUDED.manual_scans_per_day,
    sentiment_analysis_enabled = EXCLUDED.sentiment_analysis_enabled;