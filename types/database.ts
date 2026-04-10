/**
 * Supabase Database Types - Synchronized with current schema
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      hotels: {
        Row: {
          id: string;
          name: string;
          serp_api_id: string | null;
          location: string | null;
          latitude: number | null;
          longitude: number | null;
          rating: number | null;
          review_count: number | null;
          stars: number | null;
          image_url: string | null;
          property_token: string | null;
          amenities: Json | null;
          images: Json | null;
          sentiment_breakdown: Json | null;
          reviews: Json | null;
          phone: string | null;
          email: string | null;
          website: string | null;
          address: string | null;
          description: string | null;
          cid: string | null;
          place_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          serp_api_id?: string | null;
          location?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          rating?: number | null;
          review_count?: number | null;
          stars?: number | null;
          image_url?: string | null;
          property_token?: string | null;
          amenities?: Json | null;
          images?: Json | null;
          sentiment_breakdown?: Json | null;
          reviews?: Json | null;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          address?: string | null;
          description?: string | null;
          cid?: string | null;
          place_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          serp_api_id?: string | null;
          location?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          rating?: number | null;
          review_count?: number | null;
          stars?: number | null;
          image_url?: string | null;
          property_token?: string | null;
          amenities?: Json | null;
          images?: Json | null;
          sentiment_breakdown?: Json | null;
          reviews?: Json | null;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          address?: string | null;
          description?: string | null;
          cid?: string | null;
          place_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_hotels: {
        Row: {
          id: string;
          user_id: string;
          hotel_id: string;
          is_target: boolean;
          is_monitored: boolean;
          pricing_dna: Json | null;
          preferred_currency: string;
          fixed_check_in: string | null;
          fixed_check_out: string | null;
          default_adults: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          hotel_id: string;
          is_target?: boolean;
          is_monitored?: boolean;
          pricing_dna?: Json | null;
          preferred_currency?: string;
          fixed_check_in?: string | null;
          fixed_check_out?: string | null;
          default_adults?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          hotel_id?: string;
          is_target?: boolean;
          is_monitored?: boolean;
          pricing_dna?: Json | null;
          preferred_currency?: string;
          fixed_check_in?: string | null;
          fixed_check_out?: string | null;
          default_adults?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      price_logs: {
        Row: {
          id: string;
          hotel_id: string;
          price: number;
          currency: string;
          check_in_date: string | null;
          source: string;
          vendor: string | null;
          offers: Json | null;
          room_types: Json | null;
          search_rank: number | null;
          serp_api_id: string | null;
          session_id: string | null;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          hotel_id: string;
          price: number;
          currency?: string;
          check_in_date?: string | null;
          source?: string;
          vendor?: string | null;
          offers?: Json | null;
          room_types?: Json | null;
          search_rank?: number | null;
          serp_api_id?: string | null;
          session_id?: string | null;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          hotel_id?: string;
          price?: number;
          currency?: string;
          check_in_date?: string | null;
          source?: string;
          vendor?: string | null;
          offers?: Json | null;
          room_types?: Json | null;
          search_rank?: number | null;
          serp_api_id?: string | null;
          session_id?: string | null;
          recorded_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          timezone: string;
          theme_preference: string;
          language_preference: string;
          phone: string | null;
          next_scan_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          theme_preference?: string;
          language_preference?: string;
          phone?: string | null;
          next_scan_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          theme_preference?: string;
          language_preference?: string;
          phone?: string | null;
          next_scan_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_profiles: {
        Row: {
          user_id: string;
          company_name: string | null;
          job_title: string | null;
          phone: string | null;
          plan_type: string;
          subscription_status: string;
          role: string;
          is_verified: boolean;
          trial_ends_at: string | null;
          subscription_end_date: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          company_name?: string | null;
          job_title?: string | null;
          phone?: string | null;
          plan_type?: string;
          subscription_status?: string;
          role?: string;
          is_verified?: boolean;
          trial_ends_at?: string | null;
          subscription_end_date?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          company_name?: string | null;
          job_title?: string | null;
          phone?: string | null;
          plan_type?: string;
          subscription_status?: string;
          role?: string;
          is_verified?: boolean;
          trial_ends_at?: string | null;
          subscription_end_date?: string | null;
          updated_at?: string;
        };
      };
      settings: {
        Row: {
          user_id: string;
          threshold_percent: number;
          check_frequency_minutes: number;
          notification_email: string | null;
          whatsapp_number: string | null;
          push_enabled: boolean;
          push_subscription: Json | null;
          notifications_enabled: boolean;
          currency: string;
          dynamic_threshold_enabled: boolean;
          dynamic_threshold_sensitivity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          threshold_percent?: number;
          check_frequency_minutes?: number;
          notification_email?: string | null;
          whatsapp_number?: string | null;
          push_enabled?: boolean;
          push_subscription?: Json | null;
          notifications_enabled?: boolean;
          currency?: string;
          dynamic_threshold_enabled?: boolean;
          dynamic_threshold_sensitivity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          threshold_percent?: number;
          check_frequency_minutes?: number;
          notification_email?: string | null;
          whatsapp_number?: string | null;
          push_enabled?: boolean;
          push_subscription?: Json | null;
          notifications_enabled?: boolean;
          currency?: string;
          dynamic_threshold_enabled?: boolean;
          dynamic_threshold_sensitivity?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      scan_sessions: {
        Row: {
          id: string;
          user_id: string;
          session_type: string;
          status: string;
          hotels_count: number;
          check_in_date: string | null;
          check_out_date: string | null;
          adults: number;
          currency: string;
          reasoning_trace: Json | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_type?: string;
          status: string;
          hotels_count?: number;
          check_in_date?: string | null;
          check_out_date?: string | null;
          adults?: number;
          currency?: string;
          reasoning_trace?: Json | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_type?: string;
          status?: string;
          hotels_count?: number;
          check_in_date?: string | null;
          check_out_date?: string | null;
          adults?: number;
          currency?: string;
          reasoning_trace?: Json | null;
          created_at?: string;
          completed_at?: string | null;
        };
      };
      alerts: {
        Row: {
          id: string;
          user_id: string;
          hotel_id: string;
          alert_type: string;
          message: string;
          old_price: number | null;
          new_price: number | null;
          currency: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          hotel_id: string;
          alert_type: string;
          message: string;
          old_price?: number | null;
          new_price?: number | null;
          currency?: string;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          hotel_id?: string;
          alert_type?: string;
          message?: string;
          old_price?: number | null;
          new_price?: number | null;
          currency?: string;
          is_read?: boolean;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
