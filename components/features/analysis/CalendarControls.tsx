"use client";

import React, { useRef, useState, useEffect } from "react";
import { BedDouble, Check, ChevronDown, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { getStandardizedRoomCategory } from "@/utils/roomNormalization";

interface CalendarControlsProps {
  // Room Type Props
  roomType: string;
  onRoomTypeChange: (type: string) => void;
  availableRoomTypes: string[];

  // Date Navigation Props
  viewDate: Date;
  onNavigate: (days: number) => void;
  visibleRangeLabel: string;

  // Competitor Props
  competitors: { id: string; name: string }[];
  excludedHotelIds: string[];
  onExcludedChange: (ids: string[]) => void;
}

/**
 * CalendarControls Component
 * 
 * A horizontal toolbar for the Rate Calendar page.
 * Contains:
 * 1. Room Type Selector (Dropdown with standardized categories)
 * 2. Date Navigation (Previous/Next week, current range display)
 * 3. Competitor Filter (Multi-select dropdown with "Select All"/"Clear" actions)
 * 
 * Replaces the old vertical AnalysisSidebar to save screen space.
 */
export default function CalendarControls({
  roomType,
  onRoomTypeChange,
  availableRoomTypes,
  viewDate,
  onNavigate,
  visibleRangeLabel,
  competitors,
  excludedHotelIds,
  onExcludedChange,
}: CalendarControlsProps) {
  // Group room types by standardized category
  const uniqueRoomCategories = Array.from(
    new Set(availableRoomTypes.map((rt) => getStandardizedRoomCategory(rt)))
  ).sort();

  // Helper to find the first actual room type for a selected category
  const getFirstRoomForCategory = (category: string) => {
    return availableRoomTypes.find(
      (rt) => getStandardizedRoomCategory(rt) === category
    );
  };

  const [isCompDropdownOpen, setIsCompDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCompDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleHotel = (hotelId: string) => {
    if (excludedHotelIds.includes(hotelId)) {
      onExcludedChange(excludedHotelIds.filter((id) => id !== hotelId));
    } else {
      onExcludedChange([...excludedHotelIds, hotelId]);
    }
  };

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 p-4 rounded-xl bg-[var(--deep-ocean)] border border-[var(--soft-gold)]/10 shadow-lg">
      
      {/* LEFT: Room Type Selector */}
      <div className="flex items-center gap-3 w-full md:w-auto">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[var(--soft-gold)]">
          <BedDouble className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Room Type</span>
        </div>
        
        <div className="relative min-w-[180px]">
           <select
            value={getStandardizedRoomCategory(roomType)}
            onChange={(e) => {
              const category = e.target.value;
              const actualRoom = getFirstRoomForCategory(category);
              if (actualRoom) onRoomTypeChange(actualRoom);
            }}
            className="w-full appearance-none bg-[var(--soft-gold)]/5 border border-[var(--soft-gold)]/20 text-white text-xs font-bold rounded-lg px-3 py-2.5 pr-8 focus:outline-none focus:ring-1 focus:ring-[var(--soft-gold)] cursor-pointer hover:bg-[var(--soft-gold)]/10 transition-colors"
          >
            {!roomType && (
              <option value="" disabled className="bg-[var(--deep-ocean)] text-white/40">
                Select Room Type
              </option>
            )}
            {uniqueRoomCategories.map((category) => (
              <option key={category} value={category} className="bg-[var(--deep-ocean)] text-white">
                {category}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--soft-gold)] pointer-events-none" />
        </div>
      </div>

      {/* CENTER: Date Navigation (The most prominent control) */}
      <div className="flex items-center p-1 rounded-xl bg-black/20 border border-[var(--soft-gold)]/20 shadow-inner">
        <button
          onClick={() => onNavigate(-7)}
          className="p-2 hover:bg-[var(--soft-gold)]/10 text-white/70 hover:text-[var(--soft-gold)] transition-all rounded-lg active:scale-95"
          title="Previous 7 days"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="px-6 py-1.5 flex flex-col items-center min-w-[180px] border-x border-white/5 mx-1">
          <span className="text-[9px] font-black uppercase text-[var(--soft-gold)] tracking-widest mb-0.5">
            Viewing Range
          </span>
          <span className="text-sm font-bold text-white whitespace-nowrap">
            {visibleRangeLabel}
          </span>
        </div>

        <button
          onClick={() => onNavigate(7)}
          className="p-2 hover:bg-[var(--soft-gold)]/10 text-white/70 hover:text-[var(--soft-gold)] transition-all rounded-lg active:scale-95"
          title="Next 7 days"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* RIGHT: Competitor Filter (Multi-select) */}
      <div className="relative w-full md:w-auto" ref={dropdownRef}>
        <button
          onClick={() => setIsCompDropdownOpen(!isCompDropdownOpen)}
          className={`flex items-center justify-between gap-3 w-full md:w-auto min-w-[200px] px-3 py-2.5 rounded-lg border text-xs font-bold transition-all ${
            isCompDropdownOpen
              ? "bg-[var(--soft-gold)]/10 border-[var(--soft-gold)] text-white"
              : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
          }`}
        >
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5" />
            <span>
                {excludedHotelIds.length === 0 
                    ? "All Competitors" 
                    : `${competitors.length - excludedHotelIds.length} Selected`}
            </span>
          </div>
          <ChevronDown className={`w-3 h-3 transition-transform ${isCompDropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {isCompDropdownOpen && (
          <div className="absolute right-0 top-full mt-2 w-64 p-2 bg-[var(--deep-ocean)] border border-[var(--soft-gold)]/20 rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-top-2">
            <div className="max-h-[300px] overflow-y-auto space-y-1 custom-scrollbar">
                {competitors.length === 0 ? (
                    <div className="p-4 text-center text-xs text-white/40 italic">
                        No competitors found for this period.
                    </div>
                ) : (
                    competitors.map((comp) => {
                        const isSelected = !excludedHotelIds.includes(comp.id);
                        return (
                        <label
                            key={comp.id}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer group transition-colors"
                        >
                            <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                isSelected
                                ? "bg-[var(--optimal-green)] border-[var(--optimal-green)] text-[var(--deep-ocean)]"
                                : "border-white/20 bg-transparent group-hover:border-white/40"
                            }`}
                            >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[4]" />}
                            </div>
                            <input
                            type="checkbox"
                            className="hidden"
                            checked={isSelected}
                            onChange={() => toggleHotel(comp.id)}
                            />
                            <span className={`text-xs truncate transition-colors ${isSelected ? "text-white font-medium" : "text-white/40 group-hover:text-white/80"}`}>
                            {comp.name}
                            </span>
                        </label>
                        );
                    })
                )}
            </div>
            
            {/* Actions */}
            {competitors.length > 0 && (
                <div className="pt-2 mt-2 border-t border-white/10 flex gap-2">
                    <button 
                        onClick={() => onExcludedChange([])} // Select All = Clear Excluded
                        className="flex-1 py-1.5 text-[10px] font-bold text-[var(--soft-gold)] hover:bg-[var(--soft-gold)]/10 rounded"
                    >
                        Select All
                    </button>
                    <button 
                        onClick={() => onExcludedChange(competitors.map(c => c.id))} // Deselect All = Exclude All
                        className="flex-1 py-1.5 text-[10px] font-bold text-white/40 hover:text-white hover:bg-white/5 rounded"
                    >
                        Clear
                    </button>
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
