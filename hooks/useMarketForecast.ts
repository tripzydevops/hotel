"use client";

import { useState, useEffect, useMemo } from "react";
import { MarketEvent } from "@/hooks/useMarketEvents";

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
  last_synced?: string;
  market_stats: {
    avg_fair_intensity: number;
    avg_tga_intensity: number;
  };
}

// ---------- Helpers ----------

function getLevel(score: number): string {
  if (score >= 8) return "Critical (High Compression)";
  if (score >= 6) return "Elevated (Moderate Compression)";
  if (score >= 4) return "Moderate (Normal Activity)";
  return "Low (Baseline)";
}

function generateRationale(city: string, score: number, signals: MarketSignal[]): string {
  if (signals.length === 0) {
    return "Market stable. Standard seasonal occupancy expected.";
  }

  const signalNames = signals.slice(0, 3).map(s => s.name).join(", ");

  if (score >= 8) {
    return `Critical compression risk in ${city} (${score}/10). High event density from ${signalNames}. Recommend holding ADR floors and monitoring competitor rate movement.`;
  }
  if (score >= 6) {
    return `Elevated demand expected in ${city} (${score}/10) driven by ${signalNames}. Consider aggressive rate positioning and minimum stay restrictions.`;
  }
  if (score >= 4) {
    return `Moderate activity in ${city} (${score}/10). Events include ${signalNames}. Standard revenue management practices apply.`;
  }
  return `Stable demand in ${city} (${score}/10). Focus on occupancy volume and standard seasonal pricing.`;
}

function isSameOrBetween(dateStr: string, startStr: string, endStr: string): boolean {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const start = new Date(startStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endStr || startStr);
  end.setHours(0, 0, 0, 0);
  return d >= start && d <= end;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---------- Core computation ----------

function computeForecast(
  city: string,
  days: number,
  events: MarketEvent[]
): { forecast: ForecastDay[]; metadata: MarketMetadata } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter events for this city (case insensitive)
  const cityEvents = events.filter(
    (e) => e.city.toLowerCase() === city.toLowerCase()
  );

  const forecast: ForecastDay[] = [];
  let totalScore = 0;
  let peakScore = -1;
  let peakDate = "";
  let criticalDays = 0;
  let totalSignals = 0;
  let totalFairIntensity = 0;
  let totalTgaIntensity = 0;
  let fairSignalCount = 0;
  let tgaSignalCount = 0;

  for (let i = 0; i < days; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + i);
    const dateStr = formatDate(targetDate);

    // Find events active on this day
    const activeEvents = cityEvents.filter((e) =>
      isSameOrBetween(dateStr, e.start_date, e.end_date || e.start_date)
    );

    // Compute compression score (same algorithm as backend DemandScoringAgent)
    let fairScore = 0;
    let tgaScore = 0;
    const signals: MarketSignal[] = [];

    for (const event of activeEvents) {
      const score = event.intensity_score ?? event.compression_score ?? 1;
      const etype = event.type;

      if (etype === "fair") {
        fairScore += score;
        totalFairIntensity += score;
        fairSignalCount++;
      } else if (etype === "announcement") {
        tgaScore += score;
        totalTgaIntensity += score;
        tgaSignalCount++;
      }

      signals.push({ name: event.name, type: etype, score });
    }

    // Same formula as backend: (fair * 1.5) + (tga * 0.8), normalized 1-10
    const rawScore = fairScore * 1.5 + tgaScore * 0.8;
    const compressionScore = Math.min(Math.max(Math.round(rawScore), signals.length > 0 ? 1 : 0), 10);

    totalScore += compressionScore;
    totalSignals += signals.length;

    if (compressionScore > peakScore) {
      peakScore = compressionScore;
      peakDate = dateStr;
    }
    if (compressionScore >= 8) {
      criticalDays++;
    }

    forecast.push({
      city,
      date: dateStr,
      compression_score: compressionScore,
      signals,
      level: getLevel(compressionScore),
      rationale: generateRationale(city, compressionScore, signals),
    });
  }

  const avgScore = forecast.length > 0 ? Math.round((totalScore / forecast.length) * 10) / 10 : 0;

  // Find last sync time from most recent event
  const latestEvent = events.length > 0
    ? events.reduce((latest, e) =>
        new Date(e.updated_at || e.created_at) > new Date(latest.updated_at || latest.created_at) ? e : latest
      )
    : null;

  return {
    forecast,
    metadata: {
      avg_compression_score: avgScore,
      peak_date: peakDate,
      peak_score: peakScore,
      critical_days_count: criticalDays,
      total_signals: totalSignals,
      last_synced: latestEvent?.updated_at || latestEvent?.created_at || undefined,
      market_stats: {
        avg_fair_intensity: fairSignalCount > 0 ? Math.round((totalFairIntensity / fairSignalCount) * 10) / 10 : 0,
        avg_tga_intensity: tgaSignalCount > 0 ? Math.round((totalTgaIntensity / tgaSignalCount) * 10) / 10 : 0,
      },
    },
  };
}

// ---------- Hook ----------

/**
 * Computes market compression forecast ENTIRELY client-side from events data.
 * No backend call needed — events are fetched once via useMarketEvents,
 * and this hook derives daily compression scores using the same algorithm
 * as the backend DemandScoringAgent.
 */
export function useMarketForecast(city: string, days: number = 30, events: MarketEvent[] = []) {
  const result = useMemo(() => {
    if (!city || events.length === 0) {
      return { forecast: [] as ForecastDay[], metadata: null };
    }
    const { forecast, metadata } = computeForecast(city, days, events);
    return { forecast, metadata };
  }, [city, days, events]);

  return {
    data: result.forecast,
    metadata: result.metadata,
    loading: false,   // No async call — always instant
    error: null,
  };
}
