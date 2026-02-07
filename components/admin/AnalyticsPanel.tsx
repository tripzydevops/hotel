"use client";

import { useState, useEffect } from "react";
import VisibilityChart from "./VisibilityChart";
import CompsetGraph from "./CompsetGraph";
import HeatmapPanel from "./HeatmapPanel";
import { api } from "@/lib/api";

// City Options (Mock - we could fetch distinct from API)
const CITY_OPTIONS = [
  "Istanbul",
  "Antalya",
  "Izmir",
  "Ankara",
  "Bursa",
  "Mugla",
  "Nevsehir",
  "Balikesir",
  "Aydin",
];

export default function AnalyticsPanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [selectedCity, setSelectedCity] = useState<string>("");

  useEffect(() => {
    async function fetchData() {
      if (!selectedCity) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch aggregated market intelligence
        const marketData = await api.getMarketIntelligence(selectedCity);

        if (marketData) {
          // Transform for visualizations
          // 1. Mock visibility trend (aggregated)
          const mockVisibility = Array.from({ length: 14 }, (_, i) => ({
            date: new Date(Date.now() - (13 - i) * 86400000)
              .toISOString()
              .split("T")[0],
            rank: Math.floor(Math.random() * 5) + 3, // Avg rank 3-8
          }));

          // 2. Mock Network (Cluster)
          const nodes = marketData.hotels.slice(0, 8).map((h: any) => ({
            id: h.id,
            label: h.name,
            type: h.id === marketData.hotels[0].id ? "target" : "competitor",
            value: h.latest_price,
          }));

          const links = nodes.slice(1).map((n: any) => ({
            source: nodes[0].id,
            target: n.id,
            strength: 1,
          }));

          setData({
            summary: marketData.summary,
            hotels: marketData.hotels,
            visibility: mockVisibility,
            network: { nodes, links },
          });
        }
      } catch (err: any) {
        console.error("Failed to fetch market data:", err);
        setError(err.message || "Failed to load market intelligence");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedCity]);

  // Initial State: Prompt for City Selection
  if (!selectedCity) {
    return (
      <div className="h-96 flex flex-col items-center justify-center p-8 glass-card border-dashed border-slate-700">
        <h2 className="text-2xl font-bold text-white mb-4">
          Market Intelligence Hub
        </h2>
        <p className="text-slate-400 mb-8 max-w-md text-center">
          Select a city to analyze regional pricing trends, visibility
          aggregated metrics, and competitive clusters.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {CITY_OPTIONS.map((city) => (
            <button
              key={city}
              onClick={() => setSelectedCity(city)}
              className="px-6 py-3 bg-slate-800 hover:bg-emerald-600/20 border border-slate-700 hover:border-emerald-500/50 rounded-lg text-slate-300 hover:text-emerald-400 transition-all font-medium"
            >
              {city}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Filter */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-emerald-400">●</span> {selectedCity} Market
            Analysis
          </h2>
          <p className="text-sm text-slate-400">
            Realtime aggregated intelligence.
          </p>
        </div>
        <button
          onClick={() => setSelectedCity("")}
          className="text-sm text-slate-500 hover:text-white transition-colors"
        >
          Change City
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-white/50 animate-pulse">
          Running Market Analysis...
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-400 bg-red-500/10 rounded-lg border border-red-500/20">
          {error}
          <button
            onClick={() => setSelectedCity("")}
            className="block mx-auto mt-4 text-sm underline"
          >
            Reset
          </button>
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 glass-card bg-slate-900/50">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                Total Hotels
              </div>
              <div className="text-2xl font-bold text-white">
                {data.summary.hotel_count}
              </div>
            </div>
            <div className="p-4 glass-card bg-slate-900/50">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                Avg Price
              </div>
              <div className="text-2xl font-bold text-emerald-400">
                ${data.summary.avg_price}
              </div>
            </div>
            <div className="p-4 glass-card bg-slate-900/50">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                Price Range
              </div>
              <div className="text-2xl font-bold text-white">
                ${data.summary.price_range[0]} - ${data.summary.price_range[1]}
              </div>
            </div>
            <div className="p-4 glass-card bg-slate-900/50">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                Scan Coverage
              </div>
              <div className="text-2xl font-bold text-blue-400">
                {data.summary.scan_coverage_pct}%
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Visibility Module (Aggregated) */}
            <section>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-white">
                  Regional Visibility
                </h2>
                <p className="text-sm text-slate-400">
                  Avg search rank for {selectedCity} hotels.
                </p>
              </div>
              <VisibilityChart data={data.visibility} />
            </section>

            {/* Network Module */}
            <section>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-white">
                  Competitive Clusters
                </h2>
                <p className="text-sm text-slate-400">
                  Top priced hotels network.
                </p>
              </div>
              <CompsetGraph
                nodes={data.network.nodes}
                links={data.network.links}
              />
            </section>
          </div>

          {/* Geospatial Module */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-bold text-white">
                Geospatial Distribution
              </h2>
              <p className="text-sm text-slate-400">
                {data.summary.hotel_count} hotels analyzed in {selectedCity}.
              </p>
            </div>
            <HeatmapPanel hotels={data.hotels} />
          </section>

          {/* AI Market Sentiment Section */}
          <section className="glass-card p-6 mt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white text-lg">
                🧠
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  AI Market Sentiment
                </h2>
                <p className="text-sm text-slate-400">
                  Gemini-powered analysis for {selectedCity}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Sentiment Score */}
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">
                  Market Sentiment
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-3xl font-bold text-emerald-400">
                    {data.summary.avg_price > 150
                      ? "Bullish"
                      : data.summary.avg_price > 80
                        ? "Neutral"
                        : "Bearish"}
                  </div>
                  <span className="text-2xl">
                    {data.summary.avg_price > 150
                      ? "📈"
                      : data.summary.avg_price > 80
                        ? "➡️"
                        : "📉"}
                  </span>
                </div>
              </div>

              {/* Price Trend */}
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">
                  Price Pressure
                </div>
                <div className="text-3xl font-bold text-blue-400">
                  {data.summary.avg_price > 120
                    ? "High"
                    : data.summary.avg_price > 70
                      ? "Medium"
                      : "Low"}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Based on regional avg
                </div>
              </div>

              {/* Competition Level */}
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">
                  Competition
                </div>
                <div className="text-3xl font-bold text-amber-400">
                  {data.summary.hotel_count > 50
                    ? "Intense"
                    : data.summary.hotel_count > 20
                      ? "Moderate"
                      : "Low"}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {data.summary.hotel_count} active listings
                </div>
              </div>
            </div>

            {/* AI Insights */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                AI Insights
              </h3>
              <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
                <div className="flex gap-3">
                  <span className="text-purple-400 mt-0.5">💡</span>
                  <p className="text-slate-300 text-sm">
                    The {selectedCity} market shows{" "}
                    {data.summary.hotel_count > 30 ? "high" : "moderate"} hotel
                    density with an average nightly rate of{" "}
                    <strong>${data.summary.avg_price}</strong>.
                    {data.summary.price_range[1] - data.summary.price_range[0] >
                    150
                      ? " There's significant price dispersion, indicating opportunities for both budget and luxury positioning."
                      : " Price clustering suggests a competitive mid-market segment."}
                  </p>
                </div>
              </div>
              <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
                <div className="flex gap-3">
                  <span className="text-emerald-400 mt-0.5">📊</span>
                  <p className="text-slate-300 text-sm">
                    {data.summary.scan_coverage_pct > 50
                      ? `Strong scan coverage (${data.summary.scan_coverage_pct}%) enables reliable trend analysis. Consider expanding monitoring to capture edge properties.`
                      : `Limited scan coverage (${data.summary.scan_coverage_pct}%). Recommend increasing monitoring frequency to improve market visibility.`}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
