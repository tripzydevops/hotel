-- Migrate legacy user IDs to new InsForge Auth IDs
DO $$
DECLARE
    legacy_id TEXT := 'eb284dd9-7198-47be-acd0-fdb0403bcd0a';
    new_id TEXT := '287aae1d-d72a-4be1-8e84-e8b0d65d2019';
BEGIN
    -- Update user_profiles
    UPDATE user_profiles SET user_id = new_id WHERE user_id = legacy_id;
    
    -- Update hotels
    UPDATE hotels SET user_id = new_id WHERE user_id = legacy_id;
    
    -- Update query_logs
    UPDATE query_logs SET user_id = new_id WHERE user_id = legacy_id;
    
    -- Update settings
    UPDATE settings SET user_id = new_id WHERE user_id = legacy_id;
    
    -- Update scan_sessions
    UPDATE scan_sessions SET user_id = new_id WHERE user_id = legacy_id;
    
    -- Update alerts
    UPDATE alerts SET user_id = new_id WHERE user_id = legacy_id;
    
    RAISE NOTICE 'User ID synchronization complete.';
END $$;
