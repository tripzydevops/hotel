-- Migration: 010_create_plans_table.sql
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    price_monthly NUMERIC(10, 2) NOT NULL DEFAULT 0,
    hotel_limit INT NOT NULL DEFAULT 1,
    scan_frequency_limit TEXT DEFAULT 'daily',
    monthly_scan_limit INT DEFAULT 100,
    features TEXT [] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
-- RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
-- Everyone can read active plans
CREATE POLICY "Public can view active plans" ON plans FOR
SELECT USING (is_active = true);
-- Only admins/service role can modify (assuming service role bypasses RLS, or add admin policy if needed)
-- For now, letting service_role handle writes.
-- Insert Defaults
INSERT INTO plans (
        name,
        price_monthly,
        hotel_limit,
        scan_frequency_limit,
        monthly_scan_limit,
        features
    )
VALUES (
        'trial',
        0,
        1,
        'daily',
        100,
        ARRAY ['Basic Monitoring', 'Daily Updates']
    ),
    (
        'starter',
        29,
        5,
        'hourly',
        500,
        ARRAY ['5 Hotels', 'Hourly Updates', 'Email Alerts']
    ),
    (
        'pro',
        99,
        25,
        'hourly',
        2500,
        ARRAY ['25 Hotels', 'Priority Support', 'API Access']
    ),
    (
        'enterprise',
        299,
        100,
        'hourly',
        10000,
        ARRAY ['100 Hotels', 'Dedicated Account Manager']
    );