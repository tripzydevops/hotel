-- Migration: Move user-specific settings to user_hotels
-- Description: Enables independent hotel settings for multiple users tracking the same hotel.

BEGIN;

-- 1. Add new columns to user_hotels
ALTER TABLE public.user_hotels 
ADD COLUMN IF NOT EXISTS pricing_dna JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS preferred_currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS fixed_check_in DATE,
ADD COLUMN IF NOT EXISTS fixed_check_out DATE,
ADD COLUMN IF NOT EXISTS default_adults INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 2. Migrate data from hotels to user_hotels
-- We update existing associations with values from the hotels table.
-- Since the hotels table still has user_id, we can map them precisely.
UPDATE public.user_hotels uh
SET 
    pricing_dna = h.pricing_dna,
    preferred_currency = h.preferred_currency,
    fixed_check_in = h.fixed_check_in,
    fixed_check_out = h.fixed_check_out,
    default_adults = h.default_adults
FROM public.hotels h
WHERE uh.hotel_id = h.id 
AND uh.user_id = h.user_id;

-- 3. Add index for performance on user_id
CREATE INDEX IF NOT EXISTS idx_user_hotels_user_id ON public.user_hotels(user_id);
CREATE INDEX IF NOT EXISTS idx_user_hotels_hotel_id ON public.user_hotels(hotel_id);

-- Note: We NOT dropping columns from 'hotels' yet per user request.
-- Keeping legacy columns for backward compatibility during transition.

COMMIT;
