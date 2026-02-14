import React from "react";
import { BedDouble, Building2, Check, Star } from "lucide-react";
import { getStandardizedRoomCategory } from "@/utils/roomNormalization";

interface Hotel {
  id: string;
  name: string;
  is_target: boolean;
}

interface AnalysisSidebarProps {
  allHotels: Hotel[];
  excludedHotelIds: string[];
  onExcludedChange: (ids: string[]) => void;
  roomType: string;
  onRoomTypeChange: (type: string) => void;
  availableRoomTypes: string[];
  onSetTarget: (id: string) => void;
  effectiveCompetitors?: { id: string; name: string }[];
}

export default function AnalysisSidebar({
  allHotels,
  excludedHotelIds,
  onExcludedChange,
  roomType,
  onRoomTypeChange,
  availableRoomTypes,
  onSetTarget,
  effectiveCompetitors,
}: AnalysisSidebarProps) {
  const toggleHotel = (hotelId: string) => {
    if (excludedHotelIds.includes(hotelId)) {
      onExcludedChange(excludedHotelIds.filter((id) => id !== hotelId));
    } else {
      onExcludedChange([...excludedHotelIds, hotelId]);
    }
  };

  const competitors =
    allHotels.length > 1
      ? allHotels.filter((h) => !h.is_target)
      : effectiveCompetitors
        ? effectiveCompetitors.map((c) => ({
            id: c.id,
            name: c.name,
            is_target: false,
          }))
        : [];
  const targetHotel = allHotels.find((h) => h.is_target);

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

  return (
    <div className="w-48 flex-shrink-0 flex flex-col gap-6">
      {/* Room Type Filter */}
      <div className="glass-panel p-4 rounded-xl border border-white/5 bg-[var(--deep-ocean)]/50 backdrop-blur-md">
        <div className="flex items-center gap-2 mb-4 text-[var(--soft-gold)]">
          <BedDouble className="w-4 h-4" />
          <span className="text-xs font-black uppercase tracking-widest">
            Room Type
          </span>
        </div>

        {/* Room Type Filter (Dropdown) */}
        <div className="flex flex-col gap-2 relative">
          <select
            value={getStandardizedRoomCategory(roomType)}
            onChange={(e) => {
              const category = e.target.value;
              const actualRoom = getFirstRoomForCategory(category);
              if (actualRoom) onRoomTypeChange(actualRoom);
            }}
            className="w-full appearance-none bg-[var(--soft-gold)]/5 border border-[var(--soft-gold)]/20 text-white text-xs font-bold rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[var(--soft-gold)] cursor-pointer"
          >
            {/* Disabled placeholder if no selection yet */}
            {!roomType && (
              <option
                value=""
                disabled
                className="bg-[var(--deep-ocean)] text-white/40"
              >
                Select Room Type
              </option>
            )}

            {/* Group and Deduplicate Room Types */}
            {uniqueRoomCategories.map((category) => (
              <option
                key={category}
                value={category}
                className="bg-[var(--deep-ocean)] text-white"
              >
                {category}
              </option>
            ))}
          </select>
          {/* Custom Arrow */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--soft-gold)]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>

          {availableRoomTypes.length === 0 && (
            <div className="text-[10px] text-white/20 italic px-1 mt-1">
              No types found
            </div>
          )}
        </div>
      </div>

      {/* Competitors Filter */}
      <div className="glass-panel p-4 rounded-xl border border-white/5 bg-[var(--deep-ocean)]/50 backdrop-blur-md">
        <div className="flex items-center gap-2 mb-4 text-[var(--text-muted)]">
          <Building2 className="w-4 h-4" />
          <span className="text-xs font-black uppercase tracking-widest">
            Competitors
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {/* Target Hotel (Always visible logic) */}
          {targetHotel && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--soft-gold)]/5 border border-[var(--soft-gold)]/10">
              <div className="w-4 h-4 flex items-center justify-center rounded bg-[var(--soft-gold)] text-[var(--deep-ocean)]">
                <Star className="w-2.5 h-2.5 fill-current" />
              </div>
              <span className="text-xs font-bold text-white truncate flex-1">
                {targetHotel.name}
              </span>
              <span className="text-[9px] font-black uppercase text-[var(--soft-gold)]">
                You
              </span>
            </div>
          )}

          <div className="h-px bg-white/5 my-1" />

          {/* Competitor List */}
          {competitors.map((comp) => {
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
                <span
                  className={`text-xs truncate transition-colors ${isSelected ? "text-white font-medium" : "text-white/40 group-hover:text-white/80"}`}
                >
                  {comp.name}
                </span>

                {/* Set Target Button (Hidden unless hovered) */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onSetTarget(comp.id);
                  }}
                  className="ml-auto opacity-0 group-hover:opacity-100 p-1 hover:text-[var(--soft-gold)] transition-all"
                  title="Set as Target"
                >
                  <Star className="w-3 h-3" />
                </button>
              </label>
            );
          })}

          {competitors.length === 0 && (
            <div className="text-[10px] text-white/20 italic px-3">
              No competitors found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
