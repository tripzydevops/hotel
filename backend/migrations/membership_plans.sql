-- Create membership_plans table
CREATE TABLE IF NOT EXISTS membership_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    price_monthly NUMERIC(10, 2) NOT NULL DEFAULT 0,
    hotel_limit INTEGER NOT NULL DEFAULT 1,
    scan_frequency_limit TEXT DEFAULT 'daily' CHECK (
        scan_frequency_limit IN ('hourly', 'daily', 'weekly')
    ),
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Seed Initial Plans (Idempotent)
INSERT INTO membership_plans (
        name,
        price_monthly,
        hotel_limit,
        scan_frequency_limit,
        features
    )
VALUES (
        'Trial',
        0,
        1,
        'daily',
        '["1 Hotel Monitor", "Daily Scans", "Email Alerts"]'
    ),
    (
        'Starter',
        29,
        5,
        'daily',
        '["5 Hotel Monitors", "Daily Scans", "Email & Push Alerts", "Basic Reports"]'
    ),
    (
        'Pro',
        99,
        25,
        'hourly',
        '["25 Hotel Monitors", "Hourly Scans", "All Alert Types", "Advanced Analytics", "Priority Support"]'
    ),
    (
        'Enterprise',
        299,
        100,
        'hourly',
        '["100+ Hotel Monitors", "Hourly High-Frequency", "Dedicated Account Manager", "Custom Integrations"]'
    ) ON CONFLICT (name) DO NOTHING;
-- Enable RLS
ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;
-- Policies
-- Allow public read access (so frontend can see plans if needed, though usually proxied)
CREATE POLICY "Public read active plans" ON membership_plans FOR
SELECT USING (true);
-- Allow Service Role (Backend) full access implicitly (bypasses RLS)
-- We DO NOT add policies for INSERT/UPDATE/DELETE for 'auth.users' users, 
-- effectively making this table Read-Only for direct client connections.
-- All modifications must go through the Backend API (which uses Service Role).