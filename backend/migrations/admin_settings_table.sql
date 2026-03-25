CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maintenance_mode BOOLEAN DEFAULT FALSE,
    signup_enabled BOOLEAN DEFAULT TRUE,
    default_currency VARCHAR(3) DEFAULT 'USD',
    system_alert_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Secure it (enable RLS but allow everything for now or service role)
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow Service Role Full Access" ON admin_settings TO service_role USING (true) WITH CHECK (true);
-- Also allow authenticated users to READ (so frontend can check maintenance mode)
CREATE POLICY "Allow Auth Users Read" ON admin_settings FOR
SELECT TO authenticated USING (true);
-- Insert default row if not exists. 
-- We use a known ID to simulate a singleton, or just fetch the first row in API.
INSERT INTO admin_settings (
        id,
        maintenance_mode,
        signup_enabled,
        default_currency
    )
SELECT '00000000-0000-0000-0000-000000000000',
    FALSE,
    TRUE,
    'USD'
WHERE NOT EXISTS (
        SELECT 1
        FROM admin_settings
    );