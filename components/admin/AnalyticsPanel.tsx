"use client";

import { useState, useEffect } from "react";
import VisibilityChart from "./VisibilityChart";
import CompsetGraph from "./CompsetGraph";
import HeatmapPanel from "./HeatmapPanel";
export default function AnalyticsPanel() {
  const [loading, setLoading] = useState(true);

  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch from the dashboard API which returns enriched hotel data
        const res = await fetch("/api/dashboard");
        if (res.ok) {
          const dashboardData = await res.json();

          // Format for internal modules
          setData({
            visibility: dashboardData.scan_history || [],
            network: {
              nodes: [
                {
                  id: dashboardData.target_hotel?.id,
                  label: dashboardData.target_hotel?.name,
                  type: "target",
                  value: dashboardData.target_hotel?.price_info?.current_price,
                },
                ...(dashboardData.competitors || []).map((h: any) => ({
                  id: h.id,
                  label: h.name,
                  type: "competitor",
                  value: h.price_info?.current_price,
                })),
              ],
              links: (dashboardData.competitors || []).map((h: any) => ({
                source: dashboardData.target_hotel?.id,
                target: h.id,
                strength: 1,
              })),
            },
            hotels: [
              dashboardData.target_hotel,
              ...(dashboardData.competitors || []),
            ].filter(Boolean),
          });
        }
      } catch (err) {
        console.error("Failed to fetch analytics data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading)
    return <div className="p-8 text-white/50">Loading Intelligence Hub...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visibility Module */}
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-white">Visibility Tracker</h2>
            <p className="text-sm text-slate-400">
              How your hotel ranks in local search results over the last 14
              days.
            </p>
          </div>
          <VisibilityChart data={data.visibility} />
        </section>

        {/* Network Module */}
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-white">
              Market Pulse Network
            </h2>
            <p className="text-sm text-slate-400">
              Visualizing the competitive cluster around your target hotel.
            </p>
          </div>
          <CompsetGraph nodes={data.network.nodes} links={data.network.links} />
        </section>
      </div>

      {/* Geospatial Module */}
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white">Geospatial Heatmap</h2>
          <p className="text-sm text-slate-400">Regional price distribution.</p>
        </div>
        {/* Create a client-only wrapper for the map */}
        <HeatmapPanel hotels={data.hotels} />
      </section>

      {/* Insights Banner */}
      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
          ⚡
        </div>
        <div>
          <h4 className="text-sm font-bold text-emerald-300">AI Insight</h4>
          <p className="text-xs text-emerald-200/70">
            Your visibility improved by 1 position this week. You are
            undercutting &quot;Grand Hotel&quot; by $60, suggesting room to
            increase rates.
          </p>
        </div>
      </div>
    </div>
  );
}
