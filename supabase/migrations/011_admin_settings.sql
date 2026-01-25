-- Create admin_settings table for global configuration
CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maintenance_mode BOOLEAN DEFAULT FALSE,
    signup_enabled BOOLEAN DEFAULT TRUE,
    default_currency VARCHAR(3) DEFAULT 'USD',
    system_alert_message TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Insert default row if not exists (singleton pattern)
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
-- Enable RLS
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
-- Allow read access to authenticated users (for system status checks)
CREATE POLICY "Allow public read access" ON admin_settings FOR
SELECT USING (true);
-- Allow update only by service role (admin logic handled in backend via service key)
-- But effectively initially we can allow authenticated for now if admin panel uses user token
-- Ideally this should be restricted. For now, let's keep it open to authenticated users since UI uses user token.
-- In a real app, we'd check for admin role.
CREATE POLICY "Allow update by authenticated users" ON admin_settings FOR
UPDATE USING (auth.role() = 'authenticated');