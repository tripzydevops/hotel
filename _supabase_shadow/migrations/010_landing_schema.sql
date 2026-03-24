-- Migration: 010_landing_schema.sql
-- Description: Create landing_page_config table for Kaizen CMS

CREATE TABLE IF NOT EXISTS landing_page_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL, -- e.g., 'hero', 'stats', 'features'
    content JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE landing_page_config ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Allow public read access" ON landing_page_config
    FOR SELECT USING (true);

-- Admin write access
CREATE POLICY "Allow admin write access" ON landing_page_config
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_landing_page_config_updated_at
    BEFORE UPDATE ON landing_page_config
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
