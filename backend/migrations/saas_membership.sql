-- Migration: Support SaaS Subscription Model
-- Run this in Supabase SQL Editor
-- 1. Update profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial',
    -- active, trial, past_due, canceled, unpaid
ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'starter',
    -- starter, pro
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days');
-- Default to 7 day trial
-- 2. Create Tier Configuration (Optional, or just hardcode in Backend Service)
-- For simplicity in MVP, we often hardcode these in code, but a table is flexible.
CREATE TABLE IF NOT EXISTS tier_configs (
    plan_type TEXT PRIMARY KEY,
    max_hotels INTEGER NOT NULL,
    can_scan_hourly BOOLEAN DEFAULT FALSE,
    max_history_days INTEGER DEFAULT 7
);
-- Seed Tiers
INSERT INTO tier_configs (
        plan_type,
        max_hotels,
        can_scan_hourly,
        max_history_days
    )
VALUES ('starter', 10, FALSE, 30),
    ('pro', 50, TRUE, 365) ON CONFLICT (plan_type) DO
UPDATE
SET max_hotels = EXCLUDED.max_hotels,
    can_scan_hourly = EXCLUDED.can_scan_hourly,
    max_history_days = EXCLUDED.max_history_days;