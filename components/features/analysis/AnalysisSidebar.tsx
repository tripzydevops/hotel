import React from "react";
import { BedDouble, Building2, Check, Star } from "lucide-react";

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
}

export default function AnalysisSidebar({
  allHotels,
  excludedHotelIds,
  onExcludedChange,
  roomType,
  onRoomTypeChange,
  availableRoomTypes,
  onSetTarget,
}: AnalysisSidebarProps) {
  const toggleHotel = (hotelId: string) => {
    if (excludedHotelIds.includes(hotelId)) {
      onExcludedChange(excludedHotelIds.filter((id) => id !== hotelId));
    } else {
      onExcludedChange([...excludedHotelIds, hotelId]);
    }
  };

  const competitors = allHotels.filter((h) => !h.is_target);
  const targetHotel = allHotels.find((h) => h.is_target);

  return (
    <div className="w-64 flex-shrink-0 flex flex-col gap-6">
      {/* Room Type Filter */}
      <div className="glass-panel p-4 rounded-xl border border-white/5 bg-[var(--deep-ocean)]/50 backdrop-blur-md">
        <div className="flex items-center gap-2 mb-4 text-[var(--soft-gold)]">
          <BedDouble className="w-4 h-4" />
          <span className="text-xs font-black uppercase tracking-widest">
            Room Type
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => onRoomTypeChange("")}
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all ${
              !roomType
                ? "bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] border border-[var(--soft-gold)]/20 font-bold"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span>All Room Types</span>
            {!roomType && (
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--soft-gold)] shadow-[0_0_5px_var(--soft-gold)]" />
            )}
          </button>

          {availableRoomTypes.map((rt) => (
            <button
              key={rt}
              onClick={() => onRoomTypeChange(rt)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all ${
                roomType === rt
                  ? "bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] border border-[var(--soft-gold)]/20 font-bold"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="truncate">{rt}</span>
              {roomType === rt && (
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--soft-gold)] shadow-[0_0_5px_var(--soft-gold)]" />
              )}
            </button>
          ))}

          {availableRoomTypes.length === 0 && (
            <div className="text-[10px] text-white/20 italic px-3">
              No room types found
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
