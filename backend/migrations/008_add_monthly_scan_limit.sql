-- Add monthly_scan_limit column to membership_plans
ALTER TABLE membership_plans
ADD COLUMN IF NOT EXISTS monthly_scan_limit INTEGER DEFAULT 100;