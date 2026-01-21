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
  created_at: string;
}

export interface PriceInfo {
  current_price: number;
  previous_price?: number;
  currency: string;
  trend: TrendDirection;
  change_percent: number;
  recorded_at: string;
}

export interface HotelWithPrice extends Hotel {
  price_info?: PriceInfo;
}

export interface Alert {
  id: string;
  user_id: string;
  hotel_id: string;
  alert_type: AlertType;
  message: string;
  old_price?: number;
  new_price?: number;
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
}

export interface DashboardData {
  target_hotel?: HotelWithPrice;
  competitors: HotelWithPrice[];
  unread_alerts_count: number;
  last_updated: string;
}

export interface MonitorResult {
  hotels_checked: number;
  prices_updated: number;
  alerts_generated: number;
  errors: string[];
}
