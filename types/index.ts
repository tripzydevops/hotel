/**
 * Hotel Rate Monitor - Type Definitions
 */

// Trend direction for price changes
export type TrendDirection = "up" | "down" | "stable";

// Alert types for notifications
export type AlertType = "threshold_breach" | "competitor_undercut" | string;

export interface Hotel {
  id: string;
  name: string;
  is_target_hotel: boolean;
  location?: string;
  user_id: string;
  serp_api_id?: string;
  rating?: number;
  stars?: number;
  image_url?: string;
  property_token?: string;
  preferred_currency?: string;
  fixed_check_in?: string; // "YYYY-MM-DD"
  fixed_check_out?: string; // "YYYY-MM-DD"
  default_adults?: number;
  created_at: string;
  amenities?: string[];
  images?: Array<{ thumbnail?: string; original?: string }>;
  sentiment_breakdown?: Array<{ name: string; rating: number; total?: number }>;
  reviews?: Array<{ text: string; sentiment?: string; date?: string }>;
}

export interface PriceInfo {
  current_price: number;
  previous_price?: number;
  currency: string;
  trend: TrendDirection;
  change_percent: number;
  recorded_at: string;
  vendor?: string;
  check_in?: string; // ISO Date "YYYY-MM-DD"
  check_out?: string; // ISO Date "YYYY-MM-DD"
  adults?: number;
  offers?: { vendor?: string; price?: number }[];
  room_types?: { name?: string; price?: number; currency?: string }[];
}

export interface PricePoint {
  price: number;
  recorded_at: string;
}

export interface HotelWithPrice extends Hotel {
  price_info?: PriceInfo;
  price_history?: PricePoint[];
}

export interface Alert {
  id: string;
  user_id: string;
  hotel_id: string;
  alert_type: AlertType;
  message: string;
  old_price?: number;
  new_price?: number;
  currency?: string;
  is_read: boolean;
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  threshold_percent: number;
  check_frequency_minutes: number;
  notification_email?: string;
  notifications_enabled: boolean;
  whatsapp_number?: string;
  push_enabled?: boolean;
  push_subscription?: Record<string, unknown>; // JSONB
  currency?: string;
}
export interface QueryLog {
  id: string;
  hotel_name: string;
  location?: string;
  action_type: string;
  status: string;
  created_at: string;
  price?: number;
  currency?: string;
  vendor?: string;
  session_id?: string;
  check_in_date?: string;
  adults?: number;
}

export interface ScanSession {
  id: string;
  user_id: string;
  session_type: "manual" | "scheduled";
  status: "pending" | "completed" | "failed" | "partial";
  hotels_count: number;
  created_at: string;
  completed_at?: string;
  check_in_date?: string;
  check_out_date?: string;
  adults?: number;
  currency?: string;
  // Enriched with logs
  logs?: QueryLog[];
}

export interface DashboardData {
  target_hotel?: HotelWithPrice;
  competitors: HotelWithPrice[];
  recent_searches: QueryLog[];
  scan_history: QueryLog[];
  recent_sessions: ScanSession[];
  unread_alerts_count: number;
  last_updated: string;
}

export interface ScanOptions {
  check_in?: string;
  check_out?: string;
  adults?: number;
  currency?: string;
}

export interface MonitorResult {
  hotels_checked: number;
  prices_updated: number;
  alerts_generated: number;
  errors: string[];
}

export interface AdminStats {
  total_users: number;
  total_hotels: number;
  total_scans: number;
  directory_size: number;
  api_calls_today: number;
  service_role_active: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  display_name?: string;
  created_at: string;
  company_name?: string;
  job_title?: string;
  phone?: string;
  timezone?: string;
  hotel_count: number;
  scan_count: number;
  plan_type?: "trial" | "starter" | "pro" | "enterprise";
  subscription_status?: "active" | "trial" | "past_due" | "canceled";
  current_period_end?: string;
}

export interface DirectoryEntry {
  id: number;
  name: string;
  location?: string;
  serp_api_id?: string;
}

export interface AdminLog {
  id: number;
  timestamp: string;
  level: string;
  action: string;
  details: string;
}

export interface KeyStatus {
  total_keys: number;
  active_keys: number;
  current_key_index: number;
  quota_per_key: number;
  keys_status: {
    index: number;
    key_suffix: string;
    is_current: boolean;
    is_exhausted: boolean;
    exhausted_at: string | null;
  }[];
}

export interface MembershipPlan {
  id: string;
  name: string;
  price_monthly: number;
  hotel_limit: number;
  scan_frequency_limit: "hourly" | "daily" | "weekly";
  features: string[]; // JSONB
  is_active: boolean;
  created_at?: string;
}

export interface MarketAnalysis {
  market_average: number;
  market_min: number;
  market_max: number;
  target_price?: number;
  competitive_rank: number;
  price_history: PricePoint[];
  competitors: HotelWithPrice[];
  display_currency: string;
  ari: number;
  sentiment_index: number;
  advisory_msg?: string;
  quadrant_x: number;
  quadrant_y: number;
  quadrant_label: string;
}
