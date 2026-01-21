/**
 * Hotel Rate Monitor - Type Definitions
 */

// Trend direction for price changes
export type TrendDirection = "up" | "down" | "stable";

// Alert types for notifications
export type AlertType = "threshold_breach" | "competitor_undercut";

/**
 * Price information with trend data
 */
export interface PriceInfo {
  current_price: number;
  previous_price?: number;
  currency: string;
  trend: TrendDirection;
  change_percent: number;
  recorded_at: string;
}

/**
 * Hotel with pricing data
 */
export interface HotelWithPrice {
  id: string;
  name: string;
  is_target_hotel: boolean;
  location?: string;
  serp_api_id?: string;
  price_info?: PriceInfo;
}

/**
 * User settings for alerts
 */
export interface UserSettings {
  threshold_percent: number;
  check_frequency_minutes: number;
  notification_email?: string;
  notifications_enabled: boolean;
}

/**
 * Alert notification
 */
export interface Alert {
  id: string;
  hotel_id: string;
  alert_type: AlertType;
  message: string;
  old_price?: number;
  new_price?: number;
  is_read: boolean;
  created_at: string;
}

/**
 * Dashboard API response
 */
export interface DashboardData {
  target_hotel?: HotelWithPrice;
  competitors: HotelWithPrice[];
  unread_alerts_count: number;
  last_updated?: string;
}

/**
 * Monitor result from API
 */
export interface MonitorResult {
  hotels_checked: number;
  prices_updated: number;
  alerts_generated: number;
  errors: string[];
}
