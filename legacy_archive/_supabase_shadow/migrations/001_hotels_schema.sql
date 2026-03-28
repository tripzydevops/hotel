-- Hotel Competitive Rate Monitor Schema
-- Migration: 001_hotels_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core Table for Hotels to Monitor
CREATE TABLE hotels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_target_hotel BOOLEAN DEFAULT false,
  serp_api_id TEXT, -- ID used to fetch specific hotel data from SerpApi
  location TEXT, -- City/region for context
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Historical Price Logs
CREATE TABLE price_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
  price NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  check_in_date DATE, -- The date the price was for
  source TEXT DEFAULT 'serpapi', -- Where the price came from
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- User Preferences for Alerts
CREATE TABLE settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  threshold_percent FLOAT DEFAULT 2.0, -- Alert if price changes by this %
  check_frequency_minutes INT DEFAULT 144, -- 10 times per 24h
  notification_email TEXT,
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Alerts History
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'threshold_breach' | 'competitor_undercut'
  message TEXT NOT NULL,
  old_price NUMERIC(10, 2),
  new_price NUMERIC(10, 2),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_hotels_user_id ON hotels(user_id);
CREATE INDEX idx_hotels_is_target ON hotels(is_target_hotel);
CREATE INDEX idx_price_logs_hotel_id ON price_logs(hotel_id);
CREATE INDEX idx_price_logs_recorded_at ON price_logs(recorded_at DESC);
CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);

-- RLS Policies
ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Hotels: Users can only see their own hotels
CREATE POLICY "Users can view own hotels" ON hotels
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own hotels" ON hotels
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own hotels" ON hotels
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own hotels" ON hotels
  FOR DELETE USING (auth.uid() = user_id);

-- Price Logs: Users can see logs for their hotels
CREATE POLICY "Users can view price logs for own hotels" ON price_logs
  FOR SELECT USING (
    hotel_id IN (SELECT id FROM hotels WHERE user_id = auth.uid())
  );

CREATE POLICY "Service can insert price logs" ON price_logs
  FOR INSERT WITH CHECK (true); -- Backend service inserts

-- Settings: Users can only access their own settings
CREATE POLICY "Users can view own settings" ON settings
  FOR ALL USING (auth.uid() = user_id);

-- Alerts: Users can only see their own alerts
CREATE POLICY "Users can view own alerts" ON alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts" ON alerts
  FOR UPDATE USING (auth.uid() = user_id);
