"use client";

import { QueryLog } from "@/types";
import {
  Search,
  History,
  ArrowRight,
  MapPin,
  Activity,
  Target,
  Sparkles,
  Command,
} from "lucide-react";
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
    <div className="mt-20">
      <div className="flex items-center justify-between mb-8 px-2">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] border border-[var(--gold-primary)]/20 shadow-[0_0_20px_rgba(212,175,55,0.1)]">
            <History className="w-5 h-5 group-hover:rotate-[-45deg] transition-transform" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic leading-none">
              {title || t("history.searchHistory")}
            </h2>
            <p className="text-[9px] font-black text-[var(--gold-primary)] uppercase tracking-[0.4em] mt-1 opacity-60">
              Query_Recap_Archive
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/5 opacity-50">
          <Command size={12} className="text-[var(--gold-primary)]" />
          <span className="text-[9px] text-white font-black uppercase tracking-widest italic">
            {t("history.recapQueries")}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {searches.map((search) => (
          <button
            key={search.id}
            onClick={() => onReSearch(search.hotel_name, search.location)}
            className="group premium-card p-6 h-full hover:bg-white/[0.03] transition-all border border-white/5 hover:border-[var(--gold-primary)]/20 text-left flex flex-col justify-between active:scale-[0.98] relative overflow-hidden"
          >
            {/* Background Texture Overlay */}
            <div className="absolute inset-0 bg-white/[0.01] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2.5 rounded-xl bg-black border border-white/5 text-[var(--text-muted)] group-hover:text-[var(--gold-primary)] group-hover:border-[var(--gold-primary)]/20 transition-all shadow-2xl">
                  <Search className="w-4 h-4" />
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-tighter group-hover:text-white transition-colors">
                    {formatDate(search.created_at)}
                  </span>
                  <span className="text-[7px] font-bold text-[var(--gold-primary)] uppercase tracking-widest opacity-40">
                    Archived_Req
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-base font-black text-white mb-2 truncate group-hover:text-[var(--gold-primary)] transition-colors tracking-tight leading-none">
                  {search.hotel_name}
                </h3>

                {search.location && (
                  <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-muted)] group-hover:text-white/60 transition-colors uppercase tracking-widest mb-4">
                    <MapPin className="w-3.5 h-3.5 text-[var(--gold-primary)] flex-shrink-0 opacity-40" />
                    <span className="truncate">{search.location}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-white/5 mt-4 relative z-10">
              <div className="flex items-center gap-2 group-hover:text-[var(--gold-primary)] transition-colors">
                <Sparkles
                  size={10}
                  className="text-[var(--gold-primary)] opacity-40 group-hover:opacity-100 transition-opacity"
                />
                <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest group-hover:text-white">
                  {t("history.reSearch")}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--gold-primary)] group-hover:translate-x-1 transition-all" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
