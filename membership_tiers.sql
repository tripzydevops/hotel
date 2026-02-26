
-- EXPLANATION: Dynamic Membership Tiers (Fixed)
-- Reconciling with existing 'membership_plans' table which uses 'hotel_limit'.

-- 1. Ensure new columns exist in the existing table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='membership_plans' AND column_name='ui_comparison_limit') THEN
        ALTER TABLE public.membership_plans ADD COLUMN ui_comparison_limit INTEGER NOT NULL DEFAULT 5;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='membership_plans' AND column_name='can_scan_hourly') THEN
        ALTER TABLE public.membership_plans ADD COLUMN can_scan_hourly BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='membership_plans' AND column_name='history_days') THEN
        ALTER TABLE public.membership_plans ADD COLUMN history_days INTEGER NOT NULL DEFAULT 30;
    END IF;
END $$;

-- 2. Upsert tiered limits using correct column names
INSERT INTO public.membership_plans (name, hotel_limit, ui_comparison_limit, can_scan_hourly, history_days, price_monthly)
VALUES 
    ('trial', 5, 5, FALSE, 7, 0),
    ('starter', 20, 5, FALSE, 30, 49),
    ('pro', 100, 10, TRUE, 365, 149),
    ('enterprise', 9999, 15, TRUE, 9999, 399)
ON CONFLICT (name) DO UPDATE SET
    hotel_limit = EXCLUDED.hotel_limit,
    ui_comparison_limit = EXCLUDED.ui_comparison_limit,
    can_scan_hourly = EXCLUDED.can_scan_hourly,
    history_days = EXCLUDED.history_days,
    price_monthly = EXCLUDED.price_monthly;
