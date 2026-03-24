DO $$
BEGIN
    -- 1. Verify all emails in auth.users
    UPDATE auth.users SET email_verified = true;
    
    -- 2. Set Admin status for tripzydevops and askin in auth.users
    UPDATE auth.users SET is_project_admin = true WHERE email IN ('tripzydevops@gmail.com', 'asknsezen@gmail.com');
    
    -- 3. Update user_profiles with new IDs and roles
    -- tripzydevops
    UPDATE user_profiles SET user_id = '287aae1d-d72a-4be1-8e84-e8b0d65d2019', role = 'admin' WHERE email = 'tripzydevops@gmail.com';
    -- askin
    UPDATE user_profiles SET user_id = '6f44982b-1d95-48da-9040-97c6a36fe631', role = 'admin' WHERE email = 'asknsezen@gmail.com';
    -- sales
    UPDATE user_profiles SET user_id = 'b7347da7-b95b-44b3-8039-19e53f0b701c', role = 'user' WHERE email = 'sales@ramadabalikesir.com';

    -- 4. Re-link data from legacy IDs to new IDs in other tables
    -- Hotels
    UPDATE hotels SET user_id = '287aae1d-d72a-4be1-8e84-e8b0d65d2019' WHERE user_id = 'eb284dd9-7198-47be-acd0-fdb0403bcd0a';
    UPDATE hotels SET user_id = '6f44982b-1d95-48da-9040-97c6a36fe631' WHERE user_id = 'd33fc277-7006-468f-91b6-8cc7897fd910';
    UPDATE hotels SET user_id = 'b7347da7-b95b-44b3-8039-19e53f0b701c' WHERE user_id = '5da924ed-c375-4d9e-85f8-bf41d692c7de';

    -- Query Logs
    UPDATE query_logs SET user_id = '287aae1d-d72a-4be1-8e84-e8b0d65d2019' WHERE user_id = 'eb284dd9-7198-47be-acd0-fdb0403bcd0a';
    UPDATE query_logs SET user_id = '6f44982b-1d95-48da-9040-97c6a36fe631' WHERE user_id = 'd33fc277-7006-468f-91b6-8cc7897fd910';
    UPDATE query_logs SET user_id = 'b7347da7-b95b-44b3-8039-19e53f0b701c' WHERE user_id = '5da924ed-c375-4d9e-85f8-bf41d692c7de';

    -- Scan Sessions
    UPDATE scan_sessions SET user_id = '287aae1d-d72a-4be1-8e84-e8b0d65d2019' WHERE user_id = 'eb284dd9-7198-47be-acd0-fdb0403bcd0a';
    UPDATE scan_sessions SET user_id = '6f44982b-1d95-48da-9040-97c6a36fe631' WHERE user_id = 'd33fc277-7006-468f-91b6-8cc7897fd910';
    UPDATE scan_sessions SET user_id = 'b7347da7-b95b-44b3-8039-19e53f0b701c' WHERE user_id = '5da924ed-c375-4d9e-85f8-bf41d692c7de';

    -- Alerts
    UPDATE alerts SET user_id = '287aae1d-d72a-4be1-8e84-e8b0d65d2019' WHERE user_id = 'eb284dd9-7198-47be-acd0-fdb0403bcd0a';
    UPDATE alerts SET user_id = '6f44982b-1d95-48da-9040-97c6a36fe631' WHERE user_id = 'd33fc277-7006-468f-91b6-8cc7897fd910';
    UPDATE alerts SET user_id = 'b7347da7-b95b-44b3-8039-19e53f0b701c' WHERE user_id = '5da924ed-c375-4d9e-85f8-bf41d692c7de';

    -- Settings
    UPDATE settings SET user_id = '287aae1d-d72a-4be1-8e84-e8b0d65d2019' WHERE user_id = 'eb284dd9-7198-47be-acd0-fdb0403bcd0a';
    UPDATE settings SET user_id = '6f44982b-1d95-48da-9040-97c6a36fe631' WHERE user_id = 'd33fc277-7006-468f-91b6-8cc7897fd910';
    UPDATE settings SET user_id = 'b7347da7-b95b-44b3-8039-19e53f0b701c' WHERE user_id = '5da924ed-c375-4d9e-85f8-bf41d692c7de';

END $$;
