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
  created_at: string;
}

export interface PriceInfo {
  current_price: number;
  previous_price?: number;
  currency: string;
  trend: TrendDirection;
  change_percent: number;
  recorded_at: string;
  vendor?: string;
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
  push_subscription?: any; // JSONB
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
}

export interface ScanSession {
  id: string;
  user_id: string;
  session_type: "manual" | "scheduled";
  status: "pending" | "completed" | "failed";
  hotels_count: number;
  created_at: string;
  completed_at?: string;
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

export interface MonitorResult {
  hotels_checked: number;
  prices_updated: number;
  alerts_generated: number;
  errors: string[];
}
