-- Migration: 025_add_soft_delete_to_hotels.sql
-- Description: Add deleted_at column to hotels table and update RLS policies to handle archiving.

-- 1. Add deleted_at column
ALTER TABLE public.hotels
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Add comment
COMMENT ON COLUMN public.hotels.deleted_at IS 'Timestamp of when the hotel was soft-deleted. NULL means active.';

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_hotels_deleted_at ON public.hotels(deleted_at);
