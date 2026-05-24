-- Migration: 044_add_collaboration_and_alert_schema.sql
-- Description: Adds hotel_annotations table for Collaborative Intelligence (7.6)
--              and enhances the alerts table with alert_type + severity fields (7.3)

-- ============================================================
-- STEP 1: Hotel Annotations (Collaborative Intelligence)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hotel_annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    note TEXT NOT NULL,
    annotation_type TEXT NOT NULL DEFAULT 'general',
    -- Types: 'general' | 'decision' | 'question' | 'risk'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.hotel_annotations IS
    'Team annotations on hotel competitive intelligence data. '
    'Used by Collaborative Intelligence feature for decision logging '
    'and AI-powered meeting prep summaries.';

-- RLS: Users can only see annotations for hotels they own
ALTER TABLE public.hotel_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view annotations for their hotels"
    ON public.hotel_annotations FOR SELECT
    USING (
        hotel_id IN (
            SELECT hotel_id FROM public.user_hotels WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert annotations for their hotels"
    ON public.hotel_annotations FOR INSERT
    WITH CHECK (
        hotel_id IN (
            SELECT hotel_id FROM public.user_hotels WHERE user_id = auth.uid()
        )
        AND user_id = auth.uid()
    );

CREATE POLICY "Users can delete their own annotations"
    ON public.hotel_annotations FOR DELETE
    USING (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hotel_annotations_hotel_id
    ON public.hotel_annotations (hotel_id, created_at DESC);

-- ============================================================
-- STEP 2: Enhance alerts table with proactive alert fields
-- ============================================================

ALTER TABLE public.alerts
    ADD COLUMN IF NOT EXISTS alert_type TEXT DEFAULT 'price_change',
    ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.alerts.alert_type IS
    'Type of alert: price_change | margin_erosion | rate_opportunity | parity_violation | sentiment_drop';

COMMENT ON COLUMN public.alerts.severity IS
    'Alert urgency: low | medium | high | critical';

COMMENT ON COLUMN public.alerts.title IS
    'Short alert title displayed in the notification panel.';

COMMENT ON COLUMN public.alerts.metadata IS
    'Structured data context for the alert (e.g. competitor prices, OTA breakdown).';

-- Index for unread alert counts (used by notification badge)
CREATE INDEX IF NOT EXISTS idx_alerts_user_unread
    ON public.alerts (user_id, is_read, created_at DESC)
    WHERE is_read = FALSE;
