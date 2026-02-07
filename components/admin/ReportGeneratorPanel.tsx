"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { DirectoryEntry } from "@/types";

type ReportType = "in-depth" | "comparison";

const CITIES = [
  "Istanbul",
  "Antalya",
  "Izmir",
  "Bodrum",
  "Fethiye",
  "Ankara",
  "Bursa",
  "Mugla",
];

export default function ReportGeneratorPanel() {
  const [loading, setLoading] = useState(false);
  const [loadingHotels, setLoadingHotels] = useState(false);
  const [hotels, setHotels] = useState<DirectoryEntry[]>([]);
  const [selectedHotels, setSelectedHotels] = useState<string[]>([]);
  const [periodMonths, setPeriodMonths] = useState(3);
  const [reportType, setReportType] = useState<ReportType>("in-depth");
  const [generatedReport, setGeneratedReport] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("Istanbul");

  // Fetch hotels when city changes
  useEffect(() => {
    async function loadHotels() {
      setLoadingHotels(true);
      try {
        // Fetch from market intelligence endpoint which returns hotels by city
        const res = await api.fetch(
          `/api/admin/market-intelligence?city=${encodeURIComponent(selectedCity)}&limit=50`,
        );
        if (res.hotels) {
          setHotels(
            res.hotels.map((h: any) => ({
              id: h.id,
              name: h.name,
              location: h.location || selectedCity,
              rating: h.rating,
              stars: h.stars,
            })),
          );
        }
      } catch (e) {
        console.error("Failed to load hotels:", e);
        // Fallback to empty
        setHotels([]);
      } finally {
        setLoadingHotels(false);
      }
    }
    loadHotels();
    // Clear selection when city changes
    setSelectedHotels([]);
  }, [selectedCity]);

  const handleGenerate = async () => {
    if (selectedHotels.length === 0) return;
    setLoading(true);
    setGeneratedReport(null);

    try {
      const title =
        reportType === "in-depth"
          ? `In-depth Analysis: ${hotels.find((h) => String(h.id) === selectedHotels[0])?.name}`
          : `Comparison Report - ${new Date().toLocaleDateString()}`;

      const res = await api.fetch("/api/admin/reports/generate", {
        method: "POST",
        body: JSON.stringify({
          hotel_ids: selectedHotels,
          period_months: periodMonths,
          comparison_mode: reportType === "comparison",
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
    if (reportType === "in-depth") {
      // Single selection mode
      setSelectedHotels([id]);
    } else {
      // Multi-selection for comparison
      if (selectedHotels.includes(id)) {
        setSelectedHotels((prev) => prev.filter((h) => h !== id));
      } else {
        if (selectedHotels.length >= 3) {
          alert("Max 3 hotels for comparison.");
          return;
        }
        setSelectedHotels((prev) => [...prev, id]);
      }
    }
  };

  const filteredHotels = hotels.filter((h) =>
    h.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const maxHotels = reportType === "in-depth" ? 1 : 3;

  return (
    <div className="space-y-6">
      {/* Report Type Toggle */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400 font-medium">
            Report Type:
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setReportType("in-depth");
                setSelectedHotels([]);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                reportType === "in-depth"
                  ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-300"
                  : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"
              }`}
            >
              🔍 In-depth Analysis
            </button>
            <button
              onClick={() => {
                setReportType("comparison");
                setSelectedHotels([]);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                reportType === "comparison"
                  ? "bg-blue-500/20 border border-blue-500/50 text-blue-300"
                  : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"
              }`}
            >
              📊 Comparison Report
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {reportType === "in-depth"
            ? "Deep dive into a single hotel's pricing, trends, and market position."
            : "Compare up to 3 hotels side-by-side with competitive insights."}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Configuration Panel */}
        <div className="flex-1 space-y-6">
          {/* City Filter */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-bold text-white mb-4">
              1. Select City
            </h3>
            <div className="flex flex-wrap gap-2">
              {CITIES.map((city) => (
                <button
                  key={city}
                  onClick={() => setSelectedCity(city)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                    selectedCity === city
                      ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-300"
                      : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"
                  }`}
                >
                  {city}
                </button>
              ))}
            </div>
          </div>

          {/* Hotel Selection */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-bold text-white mb-4">
              2. Select Hotel{reportType === "comparison" ? "s (Max 3)" : ""}
            </h3>
            <input
              type="text"
              placeholder="Search hotels..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white mb-4 focus:ring-2 focus:ring-emerald-500/50 outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {loadingHotels ? (
                <div className="flex items-center justify-center h-full text-slate-500">
                  Loading hotels...
                </div>
              ) : filteredHotels.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-500">
                  No hotels found in {selectedCity}
                </div>
              ) : (
                filteredHotels.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => toggleHotel(String(h.id))}
                    className={`p-3 rounded-lg cursor-pointer border transition-all ${
                      selectedHotels.includes(String(h.id))
                        ? "bg-emerald-500/20 border-emerald-500/50 text-white"
                        : "bg-slate-800/50 border-transparent hover:bg-slate-800 text-slate-400"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{h.name}</div>
                        <div className="text-xs opacity-70">{h.location}</div>
                      </div>
                      {h.rating && (
                        <div className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded">
                          ⭐ {h.rating}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            {selectedHotels.length > 0 && (
              <div className="mt-3 text-xs text-slate-400">
                Selected: {selectedHotels.length} / {maxHotels}
              </div>
            )}
          </div>

          {/* Analysis Period */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-bold text-white mb-4">
              3. Analysis Period
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
            {loading
              ? "Analyzing Market Data..."
              : `Generate ${reportType === "in-depth" ? "In-depth" : "Comparison"} Report`}
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
                {generatedReport.report_data?.ai_insights?.map(
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

              {generatedReport.report_data?.hotels && (
                <div className="mt-6 pt-6 border-t border-slate-800">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    {generatedReport.report_data.hotels.map(
                      (h: any, i: number) => (
                        <div key={i}>
                          <div className="text-xs text-slate-500 mb-1">
                            {h.hotel?.name || "Hotel"}
                          </div>
                          <div className="text-xl font-bold text-white">
                            ${h.metrics?.avg_price || "N/A"}
                          </div>
                          <div className="text-xs text-emerald-400">
                            Avg Price
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full glass-card bg-slate-900/20 border-dashed border-slate-800 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-3xl mb-4 grayscale opacity-50">
                {reportType === "in-depth" ? "🔍" : "📊"}
              </div>
              <h3 className="text-lg font-medium text-slate-400 mb-2">
                Ready to Analyze
              </h3>
              <p className="text-sm text-slate-500 max-w-xs">
                {reportType === "in-depth"
                  ? "Select a hotel to generate a comprehensive in-depth analysis powered by Gemini AI."
                  : "Select 2-3 hotels to generate a comparative market analysis report."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
