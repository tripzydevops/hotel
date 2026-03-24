-- CONSOLIDATED DATABASE REPAIR SCRIPT (V6 - DEFINITIVE FIXED)
-- Purpose: Absolute 100% parity with backup data.

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- KILL EXISTING (CASCADING)
DROP TABLE IF EXISTS public.price_logs CASCADE;
DROP TABLE IF EXISTS public.alerts CASCADE;
DROP TABLE IF EXISTS public.query_logs CASCADE;
DROP TABLE IF EXISTS public.hotels CASCADE;
DROP TABLE IF EXISTS public.scan_sessions CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.hotel_directory CASCADE;
DROP TABLE IF EXISTS public.market_events CASCADE;

-- 1. Profiles
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    next_scan_at TIMESTAMPTZ DEFAULT now(),
    scan_frequency_minutes INTEGER DEFAULT 1440,
    role TEXT DEFAULT 'user',
    company_name TEXT,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Hotels
CREATE TABLE public.hotels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_target_hotel BOOLEAN DEFAULT false,
    serp_api_id TEXT,
    location TEXT,
    preferred_currency TEXT DEFAULT 'USD',
    rating NUMERIC(3, 1),
    stars NUMERIC(2, 1),
    image_url TEXT,
    amenities JSONB DEFAULT '[]'::jsonb,
    images JSONB DEFAULT '[]'::jsonb,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    address TEXT,
    cid TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Price Logs
CREATE TABLE public.price_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    price NUMERIC(10, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    check_in_date DATE,
    source TEXT DEFAULT 'serpapi',
    recorded_at TIMESTAMPTZ DEFAULT now(),
    vendor TEXT,
    offers JSONB DEFAULT '[]'::jsonb,
    room_types JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_estimated BOOLEAN DEFAULT false
);

-- 4. Alerts
CREATE TABLE public.alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL,
    message TEXT NOT NULL,
    old_price NUMERIC(10, 2),
    new_price NUMERIC(10, 2),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    currency TEXT DEFAULT 'USD'
);

-- 5. Scan Sessions
CREATE TABLE public.scan_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    hotels_count INT DEFAULT 0,
    adults INT DEFAULT 2,
    currency TEXT DEFAULT 'USD',
    check_in_date DATE,
    check_out_date DATE,
    reasoning_trace TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Hotel Directory
CREATE TABLE public.hotel_directory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    location TEXT,
    serp_api_id TEXT UNIQUE,
    popularity_score INT DEFAULT 0,
    stars NUMERIC(2, 1),
    rating NUMERIC(3, 1),
    description TEXT,
    amenities JSONB DEFAULT '[]'::jsonb,
    images JSONB DEFAULT '[]'::jsonb,
    embedding vector(768),
    image_url TEXT,
    pricing_dna JSONB DEFAULT '{}'::jsonb,
    sentiment_breakdown JSONB DEFAULT '{}'::jsonb,
    reviews JSONB DEFAULT '[]'::jsonb,
    review_count INT DEFAULT 0,
    phone TEXT,
    email TEXT,
    website TEXT,
    address TEXT,
    cid TEXT,
    place_id TEXT,
    last_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Query Logs
CREATE TABLE public.query_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    hotel_name TEXT,
    location TEXT,
    action_type TEXT,
    status TEXT DEFAULT 'success',
    created_at TIMESTAMPTZ DEFAULT now(),
    price NUMERIC(10, 2),
    currency TEXT,
    vendor TEXT,
    session_id UUID REFERENCES public.scan_sessions(id) ON DELETE SET NULL,
    check_in_date DATE,
    adults INT DEFAULT 2,
    status_detail TEXT,
    api_key_suffix TEXT
);

-- 8. Settings
CREATE TABLE public.settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    threshold_percent FLOAT DEFAULT 2.0,
    check_frequency_minutes INT DEFAULT 144,
    notification_email TEXT,
    notifications_enabled BOOLEAN DEFAULT true,
    currency TEXT DEFAULT 'USD',
    whatsapp_number TEXT,
    push_enabled BOOLEAN DEFAULT false,
    push_subscription JSONB,
    dynamic_threshold_enabled BOOLEAN DEFAULT false,
    dynamic_threshold_sensitivity FLOAT DEFAULT 0.5,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Market Events
CREATE TABLE public.market_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    city TEXT,
    start_date DATE,
    end_date DATE,
    event_type TEXT,
    intensity_score INT,
    compression_score INT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users manage own hotels" ON public.hotels FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users view relevant price logs" ON public.price_logs FOR SELECT USING (
    hotel_id IN (SELECT id FROM public.hotels WHERE user_id = auth.uid())
);
CREATE POLICY "Service can insert logs" ON public.price_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Users view own alerts" ON public.alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own settings" ON public.settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users view own sessions" ON public.scan_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service manage sessions" ON public.scan_sessions FOR ALL USING (true);

-- INDEXES
CREATE INDEX idx_hotels_user_id ON public.hotels(user_id);
CREATE INDEX idx_hotels_deleted_at ON public.hotels(deleted_at);
CREATE INDEX idx_price_logs_hotel_id ON public.price_logs(hotel_id);
CREATE INDEX idx_price_logs_recorded_at ON public.price_logs(recorded_at DESC);
CREATE INDEX idx_alerts_user_id ON public.alerts(user_id);
CREATE INDEX idx_hotel_directory_embedding ON public.hotel_directory USING hnsw (embedding vector_cosine_ops);

-- RPC FUNCTIONS
CREATE OR REPLACE FUNCTION match_hotels (
        query_embedding vector(768),
        match_threshold float,
        match_count int,
        target_hotel_id text
    ) RETURNS TABLE (
        id uuid,
        name text,
        location text,
        stars numeric,
        rating numeric,
        similarity float
    ) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY
SELECT hd.id,
    hd.name,
    hd.location,
    hd.stars,
    hd.rating,
    1 - (hd.embedding <=> query_embedding) AS similarity
FROM hotel_directory hd
WHERE 1 - (hd.embedding <=> query_embedding) > match_threshold
    AND hd.serp_api_id != target_hotel_id
ORDER BY hd.embedding <=> query_embedding
LIMIT match_count;
END;
$$;
