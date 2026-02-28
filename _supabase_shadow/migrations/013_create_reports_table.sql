-- Migration: 013_create_reports_table.sql
-- Description: Table for storing generated reports and AI insights
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    report_type TEXT NOT NULL,
    -- 'single' or 'comparison'
    hotel_ids TEXT [] NOT NULL,
    period_months INT NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    report_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
-- Admins only
CREATE POLICY "Admins can do everything on reports" ON reports FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM user_profiles
        WHERE user_id = auth.uid()
            AND role IN ('admin', 'market_admin', 'market admin')
    )
);