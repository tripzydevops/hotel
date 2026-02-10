"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { api } from "@/lib/api";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function DebugDataPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
        fetchData(session.user.id);
      }
    };
    getSession();
  }, []);

  const fetchData = async (uid: string) => {
    setLoading(true);
    setError(null);
    try {
      console.log("Fetching dashboard data for:", uid);
      const data = await api.getDashboard(uid);
      console.log("Dashboard Data Received:", data);
      setDashboardData(data);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error("Fetch Error:", err);
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050B18] p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Data Inspector
            </h1>
            <p className="text-slate-400 font-medium">
              Raw data visualization for debugging
            </p>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdated && (
              <span className="text-xs text-slate-500 font-mono">
                Last updated: {lastUpdated}
              </span>
            )}
            <button
              onClick={() => userId && fetchData(userId)}
              disabled={loading || !userId}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {loading ? "Fetching..." : "Refresh Data"}
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-red-500">
                Failed to load data
              </h3>
              <p className="text-xs text-red-400 font-mono">{error}</p>
            </div>
          </div>
        )}

        {/* Connection Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatusCard
            label="User ID"
            value={userId || "Not authenticated"}
            status={userId ? "success" : "warning"}
          />
          <StatusCard
            label="Backend Connection"
            value={
              dashboardData ? "Connected" : error ? "Failed" : "Checking..."
            }
            status={dashboardData ? "success" : error ? "error" : "warning"}
          />
          <StatusCard
            label="Hotels Found"
            value={
              dashboardData
                ? (dashboardData.competitors?.length || 0) +
                  (dashboardData.target_hotel ? 1 : 0)
                : "-"
            }
            status={
              dashboardData?.target_hotel ||
              dashboardData?.competitors?.length > 0
                ? "success"
                : "warning"
            }
          />
        </div>

        {/* Target Hotel Data */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <div className="w-1 h-5 bg-blue-500 rounded-full" />
            Target Hotel
          </h2>
          {dashboardData?.target_hotel ? (
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-slate-400 font-bold uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Currency</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Last Scan</th>
                      <th className="px-4 py-3">SerpApi ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-white">
                    <tr>
                      <td className="px-4 py-3 font-medium">
                        {dashboardData.target_hotel.name}
                      </td>
                      <td className="px-4 py-3 font-mono text-blue-400">
                        {dashboardData.target_hotel.price_info?.current_price ||
                          "N/A"}
                      </td>
                      <td className="px-4 py-3 opacity-70">
                        {dashboardData.target_hotel.price_info?.currency || "-"}
                      </td>
                      <td className="px-4 py-3 opacity-70">
                        {dashboardData.target_hotel.price_info?.vendor || "-"}
                      </td>
                      <td className="px-4 py-3 opacity-70">
                        {dashboardData.target_hotel.price_info?.recorded_at
                          ? new Date(
                              dashboardData.target_hotel.price_info.recorded_at,
                            ).toLocaleString()
                          : "-"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs opacity-50">
                        {dashboardData.target_hotel.serp_api_id || "MISSING"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Raw JSON Toggle for Target */}
              <div className="p-4 bg-black/20 border-t border-white/5">
                <details className="text-xs">
                  <summary className="text-slate-500 hover:text-white cursor-pointer select-none">
                    View Raw Target JSON
                  </summary>
                  <pre className="mt-2 text-green-400 font-mono overflow-auto max-h-60 p-2 rounded bg-black/50">
                    {JSON.stringify(dashboardData.target_hotel, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          ) : (
            <div className="p-8 bg-white/5 border border-white/10 rounded-xl text-center text-slate-500">
              No target hotel found.
            </div>
          )}
        </div>

        {/* Competitor Data */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <div className="w-1 h-5 bg-amber-500 rounded-full" />
            Competitors
          </h2>
          {dashboardData?.competitors?.length > 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-slate-400 font-bold uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Currency</th>
                      <th className="px-4 py-3">Distance</th>
                      <th className="px-4 py-3">Similarity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-white">
                    {dashboardData.competitors.map((comp: any) => (
                      <tr key={comp.id}>
                        <td className="px-4 py-3 font-medium">{comp.name}</td>
                        <td className="px-4 py-3 font-mono text-amber-500">
                          {comp.price_info?.current_price || "N/A"}
                        </td>
                        <td className="px-4 py-3 opacity-70">
                          {comp.price_info?.currency || "-"}
                        </td>
                        <td className="px-4 py-3 opacity-70">
                          {comp.distance_km ? `${comp.distance_km} km` : "-"}
                        </td>
                        <td className="px-4 py-3 opacity-70">
                          {comp.similarity
                            ? `${(comp.similarity * 100).toFixed(1)}%`
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-8 bg-white/5 border border-white/10 rounded-xl text-center text-slate-500">
              No competitors found.
            </div>
          )}
        </div>

        {/* Full Raw Data Dump */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <div className="w-1 h-5 bg-slate-500 rounded-full" />
            Full API Response
          </h2>
          <div className="bg-[#0a0f1e] border border-white/10 rounded-xl p-4 overflow-hidden">
            <div className="overflow-auto max-h-[500px]">
              <pre className="text-xs text-slate-300 font-mono">
                {dashboardData
                  ? JSON.stringify(dashboardData, null, 2)
                  : "No data loaded"}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusCard({
  label,
  value,
  status,
}: {
  label: string;
  value: string | number;
  status: "success" | "warning" | "error";
}) {
  const colors = {
    success: "bg-green-500/10 text-green-500 border-green-500/20",
    warning: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    error: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  return (
    <div
      className={`p-4 rounded-xl border flex flex-col gap-1 ${colors[status]}`}
    >
      <span className="text-xs font-bold uppercase opacity-80">{label}</span>
      <span className="text-lg font-black">{value}</span>
    </div>
  );
}
