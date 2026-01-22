"use client";

import { QueryLog } from "@/types";
import { Search, MapPin, Plus, History } from "lucide-react";

interface RecentSearchesProps {
  searches: QueryLog[];
  onAddHotel: (name: string, location: string) => void;
}

export default function RecentSearches({ searches, onAddHotel }: RecentSearchesProps) {
  if (searches.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-5 h-5 text-[var(--soft-gold)]" />
        <h2 className="text-xl font-bold text-white">Saved & Recent Searches</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {searches.map((search) => (
          <div 
            key={search.id}
            className="glass-card p-4 flex items-center justify-between group hover:border-[var(--soft-gold)]/50 transition-all"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2 rounded-lg bg-white/5 text-[var(--text-muted)] group-hover:text-[var(--soft-gold)] transition-colors">
                <Search className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-white truncate">{search.hotel_name}</p>
                {search.location && (
                  <div className="flex items-center gap-1 text-[var(--text-muted)] text-[10px]">
                    <MapPin className="w-2 h-2" />
                    <span className="truncate">{search.location}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => onAddHotel(search.hotel_name, search.location || "")}
              className="p-2 rounded-lg bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] hover:bg-[var(--soft-gold)] hover:text-[var(--deep-ocean)] transition-all opacity-0 group-hover:opacity-100"
              title="Add as Competitor"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
