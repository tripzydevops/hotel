-- Add locale support to landing_page_config
-- Migration: 014_add_locale_to_landing.sql

-- 1. Add locale column with default 'tr'
ALTER TABLE landing_page_config ADD COLUMN locale TEXT NOT NULL DEFAULT 'tr';

-- 2. Update unique constraint to be (key, locale)
ALTER TABLE landing_page_config DROP CONSTRAINT landing_page_config_key_key;
ALTER TABLE landing_page_config ADD CONSTRAINT landing_page_config_key_locale_unique UNIQUE (key, locale);

-- 3. Update RLS policies (re-creating slightly for clarity)
DROP POLICY IF EXISTS "Allow public read access" ON landing_page_config;
CREATE POLICY "Allow public read access" ON landing_page_config
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow admin write access" ON landing_page_config;
CREATE POLICY "Allow admin write access" ON landing_page_config
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );
