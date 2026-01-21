/**
 * Supabase Database Types
 * Auto-generate with: npx supabase gen types typescript --project-id <project-id> > types/database.ts
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
          description: string;
          location_city: string;
          location_country: string;
          location_address: string;
          rating: number;
          review_count: number;
          price_per_night: number;
          currency: string;
          images: string[];
          amenities: string[];
          category: string;
          featured: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          location_city: string;
          location_country: string;
          location_address: string;
          rating?: number;
          review_count?: number;
          price_per_night: number;
          currency?: string;
          images?: string[];
          amenities?: string[];
          category?: string;
          featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          location_city?: string;
          location_country?: string;
          location_address?: string;
          rating?: number;
          review_count?: number;
          price_per_night?: number;
          currency?: string;
          images?: string[];
          amenities?: string[];
          category?: string;
          featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      bookings: {
        Row: {
          id: string;
          hotel_id: string;
          user_id: string;
          check_in: string;
          check_out: string;
          guests: number;
          rooms: number;
          total_price: number;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          hotel_id: string;
          user_id: string;
          check_in: string;
          check_out: string;
          guests: number;
          rooms?: number;
          total_price: number;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          hotel_id?: string;
          user_id?: string;
          check_in?: string;
          check_out?: string;
          guests?: number;
          rooms?: number;
          total_price?: number;
          status?: string;
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}
