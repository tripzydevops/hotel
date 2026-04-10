-- Migration: Create user_hotels many-to-many join table
-- Description: Enables sharing of canonical hotel records across multiple user dashboards.

BEGIN;

-- 1. Create the join table
CREATE TABLE IF NOT EXISTS public.user_hotels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    is_target BOOLEAN DEFAULT false,
    is_monitored BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, hotel_id)
);

-- 2. Populate join table from existing data in hotels table
INSERT INTO public.user_hotels (user_id, hotel_id, is_target)
SELECT user_id, id, is_target_hotel
FROM public.hotels
WHERE user_id IS NOT NULL
ON CONFLICT (user_id, hotel_id) DO NOTHING;

-- 3. Update RLS Policies
-- Enable RLS on the new table
ALTER TABLE public.user_hotels ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own hotel associations
CREATE POLICY "Users manage own hotel associations" ON public.user_hotels
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Update main hotels table RLS to allow viewing if associated
-- We need to drop the old policy first
DROP POLICY IF EXISTS "Users manage own hotels" ON public.hotels;

CREATE POLICY "Users view associated hotels" ON public.hotels
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_hotels 
            WHERE user_hotels.hotel_id = hotels.id 
            AND user_hotels.user_id = auth.uid()
        )
    );

-- Keep an admin policy for full control if needed
DROP POLICY IF EXISTS "project_admin_policy" ON public.hotels;
CREATE POLICY "project_admin_policy" ON public.hotels
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

COMMIT;
