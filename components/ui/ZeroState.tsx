"use client";

import { Building2, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface ZeroStateProps {
  onAddHotel: () => void;
}

export default function ZeroState({ onAddHotel }: ZeroStateProps) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-8 animate-in fade-in zoom-in duration-700 relative overflow-hidden">
      {/* Tactical Background Element */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--soft-gold)]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative mb-12 group cursor-pointer" onClick={onAddHotel}>
        <div className="absolute inset-0 bg-[var(--soft-gold)]/20 rounded-full blur-2xl group-hover:bg-[var(--soft-gold)]/40 transition-all duration-700 animate-pulse" />
        <div className="relative bg-gradient-to-br from-[var(--deep-ocean-accent)]/80 to-[var(--deep-ocean)] border border-[var(--soft-gold)]/30 p-12 rounded-full shadow-[0_0_50px_rgba(212,175,55,0.1)] backdrop-blur-xl group-hover:scale-105 transition-all duration-500 group-hover:border-[var(--soft-gold)]/60">
          <Building2 className="w-20 h-20 text-[var(--soft-gold)] group-hover:rotate-6 transition-transform duration-500" />
          <div className="absolute -bottom-2 -right-2 bg-[var(--soft-gold)] text-[var(--deep-ocean)] p-3 rounded-xl shadow-2xl transform rotate-12 group-hover:rotate-0 transition-all duration-500">
            <Plus className="w-8 h-8 stroke-[3px]" />
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-2xl">
        <h2 className="text-4xl sm:text-5xl font-black text-[var(--text-primary)] mb-6 tracking-tighter uppercase italic leading-tight">
          {t("dashboard.title")}
        </h2>

        <p className="text-[var(--text-muted)] text-lg sm:text-xl mb-12 leading-relaxed font-medium opacity-80 max-w-lg mx-auto">
          {t("dashboard.subtitle")}
        </p>

        <button
          onClick={onAddHotel}
          className="group relative px-10 py-5 bg-[var(--soft-gold)] text-[var(--deep-ocean)] font-black text-xl uppercase tracking-widest rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-95 shadow-[0_20px_40px_rgba(212,175,55,0.2)] hover:shadow-[0_25px_50px_rgba(212,175,55,0.4)] overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" />
          <span className="relative z-10 flex items-center justify-center gap-3">
            {t("common.addHotel")}
          </span>
        </button>
      </div>

      <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-12 text-center opacity-40">
        <div className="flex flex-col items-center gap-3 group">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--soft-gold)] group-hover:scale-150 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-primary)]">
            {t("alerts.undercut")} ANALYTICS
          </span>
        </div>
        <div className="flex flex-col items-center gap-3 group">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--soft-gold)] group-hover:scale-150 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-primary)]">
            {t("hotelDetails.featureAnalysis")} SYSTEMS
          </span>
        </div>
        <div className="flex flex-col items-center gap-3 group">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--soft-gold)] group-hover:scale-150 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-primary)]">
            {t("alerts.title")} PROTOCOLS
          </span>
        </div>
      </div>
    </div>
  );
}
