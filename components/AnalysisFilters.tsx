"use client";

import React, { useState } from "react";
import { Calendar, ChevronDown, X, Filter, Zap, Target } from "lucide-react";

interface Hotel {
  id: string;
  name: string;
  is_target: boolean;
}

interface AnalysisFiltersProps {
  allHotels: Hotel[];
  excludedHotelIds: string[];
  onExcludedChange: (ids: string[]) => void;
  startDate: string;
  endDate: string;
  onDateChange: (start: string, end: string) => void;
}

const DATE_PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "All time", days: 0 },
];

export default function AnalysisFilters({
  allHotels,
  excludedHotelIds,
  onExcludedChange,
  startDate,
  endDate,
  onDateChange,
}: AnalysisFiltersProps) {
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showHotelDropdown, setShowHotelDropdown] = useState(false);

  const applyPreset = (days: number) => {
    if (days === 0) {
      onDateChange("", "");
    } else {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);
      onDateChange(
        start.toISOString().split("T")[0],
        end.toISOString().split("T")[0],
      );
    }
    setShowDateDropdown(false);
  };

  const toggleHotelExclusion = (hotelId: string) => {
    if (excludedHotelIds.includes(hotelId)) {
      onExcludedChange(excludedHotelIds.filter((id) => id !== hotelId));
    } else {
      onExcludedChange([...excludedHotelIds, hotelId]);
    }
  };

  const includedCount = allHotels.length - excludedHotelIds.length;

  return (
    <div className="premium-card p-6 mb-8 relative z-20 bg-black/40 border-[var(--gold-primary)]/10">
      <div className="flex flex-col xl:flex-row items-start xl:items-center gap-6">
        {/* Date Range Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 flex-1 w-full">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--gold-primary)]/10 text-[var(--gold-primary)]">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)]">
              Analysis_Epoch
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative group flex-1 sm:flex-none">
              <input
                type="date"
                value={startDate}
                onChange={(e) => onDateChange(e.target.value, endDate)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-[var(--gold-primary)]/50 transition-all font-bold [color-scheme:dark]"
              />
            </div>
            <span className="text-[var(--gold-primary)] opacity-40 font-black">
              /
            </span>
            <div className="relative group flex-1 sm:flex-none">
              <input
                type="date"
                value={endDate}
                onChange={(e) => onDateChange(startDate, e.target.value)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-[var(--gold-primary)]/50 transition-all font-bold [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Presets Dropdown */}
          <div className="relative w-full sm:w-auto">
            <button
              onClick={() => setShowDateDropdown(!showDateDropdown)}
              className="w-full sm:w-auto flex items-center justify-between gap-3 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all hover:text-white"
            >
              <span>{t("common.presets") || "Presets"}</span>
              <ChevronDown
                className={`w-3 h-3 transition-transform duration-300 ${showDateDropdown ? "rotate-180" : ""}`}
              />
            </button>
            {showDateDropdown && (
              <div className="absolute top-full left-0 right-0 sm:right-auto sm:min-w-[180px] mt-2 z-50 bg-[var(--bg-deep)]/95 backdrop-blur-3xl border border-[var(--card-border)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                {DATE_PRESETS.map((preset) => (
                  <button
                    key={preset.days}
                    onClick={() => applyPreset(preset.days)}
                    className="w-full px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-[var(--gold-primary)] hover:bg-white/5 transition-all border-b border-white/5 last:border-none"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Hotel Filter Section */}
        <div className="relative w-full xl:w-auto">
          <button
            onClick={() => setShowHotelDropdown(!showHotelDropdown)}
            className="w-full xl:w-auto flex items-center justify-between gap-4 px-6 py-3 rounded-2xl bg-black/40 border border-[var(--gold-primary)]/20 text-white text-xs font-black uppercase tracking-[0.2em] hover:bg-black/60 hover:border-[var(--gold-primary)]/40 transition-all shadow-[0_0_20px_rgba(212,175,55,0.05)]"
          >
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-[var(--gold-primary)]" />
              <span>
                Nodes:{" "}
                <span className="text-[var(--gold-primary)]">
                  {includedCount}
                </span>{" "}
                / {allHotels.length}
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 opacity-40 transition-transform duration-300 ${showHotelDropdown ? "rotate-180" : ""}`}
            />
          </button>

          {showHotelDropdown && (
            <div className="absolute top-full right-0 mt-3 z-50 bg-[var(--bg-deep)]/95 backdrop-blur-3xl border border-[var(--card-border)] rounded-2xl shadow-[0_30px_70px_rgba(0,0,0,0.6)] overflow-hidden min-w-[320px] animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="px-6 py-4 border-b border-white/5 bg-white/5">
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-[var(--gold-primary)] opacity-80">
                  Node_Selection_Protocol
                </span>
              </div>
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                {allHotels.map((hotel) => (
                  <label
                    key={hotel.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-white/5 cursor-pointer transition-all border-b border-white/5 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={!excludedHotelIds.includes(hotel.id)}
                          onChange={() => toggleHotelExclusion(hotel.id)}
                          className="peer appearance-none w-5 h-5 rounded-lg border border-white/10 bg-black/40 checked:bg-[var(--gold-primary)] checked:border-transparent transition-all cursor-pointer"
                        />
                        <Zap className="absolute inset-0 m-auto w-3 h-3 text-black opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                      </div>
                      <div className="flex flex-col">
                        <span
                          className={`text-xs font-bold tracking-tight transition-all ${excludedHotelIds.includes(hotel.id) ? "text-white/20 line-through" : "text-white"}`}
                        >
                          {hotel.name}
                        </span>
                        {hotel.is_target && (
                          <span className="text-[8px] font-black text-[var(--gold-primary)] uppercase tracking-widest mt-0.5 flex items-center gap-1">
                            <Target size={8} /> Target_Baseline
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              {excludedHotelIds.length > 0 && (
                <div className="p-4 bg-black/40">
                  <button
                    onClick={() => onExcludedChange([])}
                    className="w-full py-2.5 rounded-xl bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--gold-primary)] hover:bg-[var(--gold-primary)] hover:text-black transition-all"
                  >
                    Restore_All_Nodes
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
