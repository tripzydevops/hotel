"use client";

import { QueryLog } from "@/types";
import { Search, History, ArrowRight, MapPin } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface SearchHistoryProps {
  searches: QueryLog[];
  onReSearch: (hotelName: string, location?: string) => void;
  title?: string;
}

export default function SearchHistory({
  searches,
  onReSearch,
  title,
}: SearchHistoryProps) {
  const { t, locale } = useI18n();
  if (searches.length === 0) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale === "en" ? "en-US" : "tr-TR", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#F6C344]/10 text-[#F6C344]">
            <History className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">
            {title || t("history.searchHistory")}
          </h2>
        </div>
        <span className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest italic">
          {t("history.recapQueries")}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {searches.map((search) => (
          <button
            key={search.id}
            onClick={() => onReSearch(search.hotel_name, search.location)}
            className="group card-blur rounded-[1.5rem] p-4 hover:bg-white/[0.04] transition-all border border-white/5 hover:border-[#F6C344]/30 text-left flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 rounded-lg bg-white/5 text-slate-500 group-hover:text-[#F6C344] transition-colors">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
                  {formatDate(search.created_at)}
                </span>
              </div>

              <h3 className="text-sm font-black text-white mb-1 truncate group-hover:text-[#F6C344] transition-colors">
                {search.hotel_name}
              </h3>

              {search.location && (
                <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] mb-3">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{search.location}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 mt-2 text-[#F6C344] group-hover:text-white transition-colors">
              <span className="text-[9px] font-black uppercase tracking-widest">
                {t("history.reSearch")}
              </span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
