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
          <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight">
            {title || t("history.searchHistory")}
          </h2>
        </div>
        <span className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest italic">
          {t("history.recapQueries")}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {searches.map((search) => (
          <button
            key={search.id}
            onClick={() => onReSearch(search.hotel_name, search.location)}
            className="group glass-card rounded-[2rem] p-5 hover:bg-white/[0.04] transition-all border-white/5 hover:border-white/10 text-left flex flex-col justify-between h-full"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-white/5 text-[var(--text-muted)] group-hover:text-[var(--soft-gold)] group-hover:bg-[var(--soft-gold)]/10 transition-all">
                  <Search className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.1em] opacity-40 group-hover:opacity-100 transition-opacity">
                  {formatDate(search.created_at)}
                </span>
              </div>

              <h3 className="text-sm font-black text-[var(--text-primary)] mb-1.5 truncate group-hover:text-[var(--soft-gold)] transition-colors tracking-tight uppercase">
                {search.hotel_name}
              </h3>

              {search.location && (
                <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] mb-4 font-bold opacity-60">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-indigo-400/80" />
                  <span className="truncate">{search.location}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5 group-hover:border-[var(--soft-gold)]/20 transition-colors">
              <div className="flex-1">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] group-hover:text-[var(--soft-gold)] transition-colors">
                  {t("history.reSearch")}
                </span>
              </div>
              <div className="p-1.5 rounded-full bg-white/5 group-hover:bg-[var(--soft-gold)]/10 group-hover:text-[var(--soft-gold)] transition-all">
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
