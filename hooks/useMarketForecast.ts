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

export function useMarketForecast(city: string, days: number = 30) {
  const [data, setData] = useState<ForecastDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchForecast() {
      if (!city) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/market/forecast?city=${city}&days=${days}`);
        if (!res.ok) throw new Error("Failed to fetch market forecast");
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchForecast();
  }, [city, days]);

  return { data, loading, error };
}
