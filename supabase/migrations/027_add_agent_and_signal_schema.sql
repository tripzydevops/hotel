-- Migration: Add Cold Start and Agentic Reasoning Infrastructure
-- Description: Creates the necessary tables for Layer 1 (Signal Collection) and Layer 2 (Agent Workflows)

-- 1. User Profiles for Cold Start Recommendations
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    lifestyle_embedding vector(1536), -- Requires pgvector extension
    travel_persona_tags JSONB DEFAULT '[]'::jsonb,
    is_cold_start BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. User Signals Collection (Buffer for explicit and implicit signals)
CREATE TABLE IF NOT EXISTS public.user_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Nullable for anonymous tracking
    session_id TEXT NOT NULL,
    signal_type TEXT NOT NULL, -- e.g., 'view', 'dwell_time', 'click_amenity', 'search_filter'
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast aggregation of signals per user/session
CREATE INDEX IF NOT EXISTS idx_user_signals_user_id ON public.user_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_signals_session_id ON public.user_signals(session_id);

-- 3. Agent Workflows (For asynchronous Agentic Reasoning tracking)
-- NOTE: Merged schema from 027_add_agent_workflows_schema.sql (hotel_id column)
-- to resolve migration conflict. See that file for history.
CREATE TABLE IF NOT EXISTS public.agent_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    agent_role TEXT NOT NULL, -- e.g., 'Analyst', 'Market Intelligence', 'Price Scraper'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'complete', 'failed'
    reasoning_trace JSONB, -- Stores the AI's step-by-step logic
    triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fetching active workflows
CREATE INDEX IF NOT EXISTS idx_agent_workflows_status ON public.agent_workflows(status);
