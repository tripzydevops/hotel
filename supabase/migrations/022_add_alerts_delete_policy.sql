-- Migration: 022_add_alerts_delete_policy.sql
-- Enables users to delete their own alerts.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'alerts' AND policyname = 'Users can delete own alerts'
    ) THEN
        CREATE POLICY "Users can delete own alerts" ON alerts
        FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;
