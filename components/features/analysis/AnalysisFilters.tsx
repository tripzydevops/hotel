"use client";

import React, { useState } from "react";
import {
  Calendar,
  ChevronDown,
  X,
  Filter,
  Star,
  BedDouble,
} from "lucide-react";

interface Hotel {
  id: string;
  name: string;
  is_target: boolean;
}

interface AnalysisFiltersProps {
  allHotels: Hotel[];
  excludedHotelIds: string[];
  onExcludedChange: (ids: string[]) => void;
  onSetTarget: (id: string) => void;
  startDate: string;
  endDate: string;
  onDateChange: (start: string, end: string) => void;
  roomType?: string;
  onRoomTypeChange?: (type: string) => void;
  availableRoomTypes?: string[];
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
  onSetTarget,
  startDate,
  endDate,
  onDateChange,
  roomType = "",
  onRoomTypeChange,
  availableRoomTypes = [],
}: AnalysisFiltersProps) {
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showHotelDropdown, setShowHotelDropdown] = useState(false);
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);

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
    <div className="glass-card p-4 mb-6 relative z-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Date Range */}
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <Calendar className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wide">
              Date Range
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => onDateChange(e.target.value, endDate)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]"
            />
            <span className="text-white/40">–</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onDateChange(startDate, e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]"
            />
          </div>

          {/* Presets Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDateDropdown(!showDateDropdown)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs font-medium hover:bg-white/10 transition-colors"
            >
              Presets
              <ChevronDown className="w-3 h-3" />
            </button>
            {showDateDropdown && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-[var(--deep-ocean)] border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[140px]">
                {DATE_PRESETS.map((preset) => (
                  <button
                    key={preset.days}
                    onClick={() => applyPreset(preset.days)}
                    className="w-full px-4 py-2 text-left text-xs text-white/80 hover:bg-white/10 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Room Type Filter (New) */}
        {availableRoomTypes &&
          availableRoomTypes.length > 0 &&
          onRoomTypeChange && (
            <div className="relative">
              <button
                onClick={() => setShowRoomDropdown(!showRoomDropdown)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition-colors"
              >
                <BedDouble className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="truncate max-w-[150px]">
                  {roomType || "All Room Types"}
                </span>
                <ChevronDown className="w-3 h-3 text-white/40" />
              </button>

              {showRoomDropdown && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-[var(--deep-ocean)] border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[200px]">
                  <button
                    onClick={() => {
                      onRoomTypeChange("");
                      setShowRoomDropdown(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-xs hover:bg-white/10 transition-colors ${!roomType ? "text-[var(--soft-gold)] font-bold" : "text-white/80"}`}
                  >
                    All Room Types
                  </button>
                  {availableRoomTypes.map((rt) => (
                    <button
                      key={rt}
                      onClick={() => {
                        onRoomTypeChange(rt);
                        setShowRoomDropdown(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-xs hover:bg-white/10 transition-colors ${roomType === rt ? "text-[var(--soft-gold)] font-bold" : "text-white/80"}`}
                    >
                      {rt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

        {/* Hotel Filter */}
        <div className="relative">
          <button
            onClick={() => setShowHotelDropdown(!showHotelDropdown)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition-colors"
          >
            <Filter className="w-4 h-4 text-[var(--text-muted)]" />
            <span>
              Hotels: {includedCount} of {allHotels.length}
            </span>
            <ChevronDown className="w-3 h-3 text-white/40" />
          </button>

          {showHotelDropdown && (
            <div className="absolute top-full right-0 mt-1 z-50 bg-[var(--deep-ocean)] border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[280px]">
              <div className="px-4 py-2 border-b border-white/5">
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                  Exclude from Analysis
                </span>
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                {allHotels.map((hotel) => (
                  <div
                    key={hotel.id}
                    className="flex items-center justify-between px-4 py-2 hover:bg-white/5 transition-colors group"
                  >
                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={excludedHotelIds.includes(hotel.id)}
                        onChange={() => toggleHotelExclusion(hotel.id)}
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-[var(--soft-gold)] focus:ring-[var(--soft-gold)]"
                      />
                      <span
                        className={`text-sm ${excludedHotelIds.includes(hotel.id) ? "text-white/40 line-through" : "text-white"}`}
                      >
                        {hotel.name}
                      </span>
                    </label>
                    <button
                      onClick={() => !hotel.is_target && onSetTarget(hotel.id)}
                      className={`p-1.5 rounded-lg transition-all ${
                        hotel.is_target
                          ? "text-[var(--soft-gold)]"
                          : "text-white/20 hover:text-[var(--soft-gold)] hover:bg-white/5 opacity-0 group-hover:opacity-100"
                      }`}
                      title={
                        hotel.is_target ? "Current Target" : "Set as Target"
                      }
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${hotel.is_target ? "fill-current" : ""}`}
                      />
                    </button>
                  </div>
                ))}
              </div>
              {excludedHotelIds.length > 0 && (
                <div className="px-4 py-2 border-t border-white/5">
                  <button
                    onClick={() => onExcludedChange([])}
                    className="text-xs text-[var(--soft-gold)] hover:underline"
                  >
                    Clear all exclusions
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
