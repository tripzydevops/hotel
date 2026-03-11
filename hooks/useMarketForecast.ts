"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

export interface MarketSignal {
  name: string;
  type: string;
  score: number;
}

export interface ForecastDay {
  city: string;
  date: string;
  compression_score: number;
  signals: MarketSignal[];
  level: string;
  rationale: string;
}

export interface MarketMetadata {
  avg_compression_score: number;
  peak_date: string;
  peak_score: number;
  critical_days_count: number;
  total_signals: number;
  market_stats: {
    avg_fair_intensity: number;
    avg_tga_intensity: number;
  };
}

export function useMarketForecast(city: string, days: number = 30) {
  const [data, setData] = useState<ForecastDay[]>([]);
  const [metadata, setMetadata] = useState<MarketMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchForecast() {
      if (!city) return;
      setLoading(true);
      setError(null);
      try {
        const res = await api.getMarketForecast(city, days) as any;
        // Backend returns { forecast: [], metadata: {} }
        if (res && res.forecast) {
          setData(res.forecast);
          setMetadata(res.metadata);
        } else if (Array.isArray(res)) {
          // Fallback if structure differs
          setData(res);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchForecast();
  }, [city, days]);

  return { data, metadata, loading, error };
}
