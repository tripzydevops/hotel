"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { DirectoryEntry } from "@/types";

export default function ReportGeneratorPanel() {
  const [loading, setLoading] = useState(false);
  const [hotels, setHotels] = useState<DirectoryEntry[]>([]);
  const [selectedHotels, setSelectedHotels] = useState<string[]>([]);
  const [periodMonths, setPeriodMonths] = useState(3);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Fetch hotels for selection
    async function loadHotels() {
      try {
        // Using existing list endpoint or fetching directory
        const res = await api.getSettings("dummy"); // We might need a better list endpoint
        // START WORKAROUND: Mock fetching for now if list endpoint is admin-specific
        const mockHotels = [
          { id: 1, name: "Grand Hotel Istanbul", location: "Istanbul" },
          { id: 2, name: "Hilton Bomonti", location: "Istanbul" },
          { id: 3, name: "Swissotel The Bosphorus", location: "Istanbul" },
          { id: 4, name: "Rixos Premium", location: "Antalya" },
          { id: 5, name: "Maxx Royal", location: "Antalya" },
        ];
        // In real output replace with: const list = await api.getAdminDirectoryList();
        setHotels(mockHotels as any);
      } catch (e) {
        console.error(e);
      }
    }
    loadHotels();
  }, []);

  const handleGenerate = async () => {
    if (selectedHotels.length === 0) return;
    setLoading(true);
    setGeneratedReport(null);

    try {
      const title = `Market Analysis - ${new Date().toLocaleDateString()}`;
      const res = await api.fetch("/api/admin/reports/generate", {
        method: "POST",
        body: JSON.stringify({
          hotel_ids: selectedHotels,
          period_months: periodMonths,
          comparison_mode: selectedHotels.length > 1,
          title,
        }),
      });
      setGeneratedReport(res.data);
    } catch (err) {
      console.error(err);
      alert("Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const toggleHotel = (id: string) => {
    if (selectedHotels.includes(id)) {
      setSelectedHotels((prev) => prev.filter((h) => h !== id));
    } else {
      if (selectedHotels.length >= 3) {
        alert("Max 3 hotels for comparison in this version.");
        return;
      }
      setSelectedHotels((prev) => [...prev, id]);
    }
  };

  const filteredHotels = hotels.filter((h) =>
    h.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Configuration Panel */}
        <div className="flex-1 space-y-6">
          <div className="glass-card p-6">
            <h3 className="text-lg font-bold text-white mb-4">
              1. Select Hotels (Max 3)
            </h3>
            <input
              type="text"
              placeholder="Search hotels..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white mb-4 focus:ring-2 focus:ring-emerald-500/50 outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {filteredHotels.map((h) => (
                <div
                  key={h.id}
                  onClick={() => toggleHotel(String(h.id))}
                  className={`p-3 rounded-lg cursor-pointer border transition-all ${
                    selectedHotels.includes(String(h.id))
                      ? "bg-emerald-500/20 border-emerald-500/50 text-white"
                      : "bg-slate-800/50 border-transparent hover:bg-slate-800 text-slate-400"
                  }`}
                >
                  <div className="font-medium">{h.name}</div>
                  <div className="text-xs opacity-70">{h.location}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-lg font-bold text-white mb-4">
              2. Analysis Period
            </h3>
            <div className="flex gap-3">
              {[3, 6, 12].map((m) => (
                <button
                  key={m}
                  onClick={() => setPeriodMonths(m)}
                  className={`flex-1 py-3 rounded-lg border font-medium transition-all ${
                    periodMonths === m
                      ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                  }`}
                >
                  {m} Months
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || selectedHotels.length === 0}
            className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
              loading || selectedHotels.length === 0
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-900/20"
            }`}
          >
            {loading ? "Analyzing Market Data..." : "Generate AI Report"}
          </button>
        </div>

        {/* Preview / Result Panel */}
        <div className="flex-1">
          {generatedReport ? (
            <div className="glass-card p-6 h-full flex flex-col animate-in fade-in slide-in-from-bottom-4">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider mb-1">
                    Analysis Complete
                  </div>
                  <h2 className="text-2xl font-bold text-white">
                    {generatedReport.title}
                  </h2>
                </div>
                <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm flex items-center gap-2 transition-colors">
                  <span>📄</span> Download PDF
                </button>
              </div>

              <div className="space-y-4 flex-1">
                {generatedReport.report_data.ai_insights.map(
                  (insight: string, i: number) => (
                    <div
                      key={i}
                      className="p-4 bg-slate-900/50 rounded-lg border border-slate-800"
                    >
                      <div className="flex gap-3">
                        <div className="mt-1 text-emerald-400">⚡</div>
                        <p className="text-slate-300 text-sm leading-relaxed">
                          {insight}
                        </p>
                      </div>
                    </div>
                  ),
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-slate-800">
                <div className="grid grid-cols-3 gap-4 text-center">
                  {generatedReport.report_data.hotels.map(
                    (h: any, i: number) => (
                      <div key={i}>
                        <div className="text-xs text-slate-500 mb-1">
                          {h.hotel.name}
                        </div>
                        <div className="text-xl font-bold text-white">
                          ${h.metrics.avg_price}
                        </div>
                        <div className="text-xs text-emerald-400">
                          Avg Price
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full glass-card bg-slate-900/20 border-dashed border-slate-800 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-3xl mb-4 grayscale opacity-50">
                📊
              </div>
              <h3 className="text-lg font-medium text-slate-400 mb-2">
                Ready to Analyze
              </h3>
              <p className="text-sm text-slate-500 max-w-xs">
                Select hotels and a time period to generate a comprehensive
                market analysis report powered by Gemini AI.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
