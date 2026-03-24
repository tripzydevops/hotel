"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

export interface MarketEvent {
  id: string;
  external_id: string;
  name: string;
  type: string;
  start_date: string;
  end_date: string;
  city: string;
  venue?: string;
  description?: string;
  source_url?: string;
  expected_attendees?: number;
  intensity_score?: number;
  created_at: string;
  updated_at: string;
}

export function useMarketEvents(city?: string) {
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getMarketEvents(city);
        
        // Filter out past events
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day
        
        const upcomingEvents = (data || []).filter((e: MarketEvent) => {
          const endDate = new Date(e.end_date || e.start_date);
          return endDate >= today;
        });

        // Sort chronologically
        const sortedEvents = upcomingEvents.sort((a: MarketEvent, b: MarketEvent) => {
          return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
        });

        setEvents(sortedEvents);
      } catch (err: any) {
        console.error("Error fetching market events:", err);
        setError(err.message || "Failed to load events");
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, [city]);

  return { events, loading, error, refetch: () => setLoading(true) }; // Refetch triggers effect
}
