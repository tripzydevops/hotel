"use client";

import { Building2, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface ZeroStateProps {
  onAddHotel: () => void;
}

export default function ZeroState({ onAddHotel }: ZeroStateProps) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-in fade-in zoom-in duration-500">
      <div className="relative mb-8 group cursor-pointer" onClick={onAddHotel}>
        <div className="absolute inset-0 bg-[var(--soft-gold)]/20 rounded-full blur-xl group-hover:bg-[var(--soft-gold)]/30 transition-all duration-500" />
        <div className="relative bg-gradient-to-br from-[var(--soft-gold)]/10 to-[var(--deep-ocean)] border border-[var(--soft-gold)]/30 p-8 rounded-full shadow-2xl backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
          <Building2 className="w-16 h-16 text-[var(--soft-gold)]" />
          <div className="absolute -bottom-2 -right-2 bg-[var(--soft-gold)] text-[var(--deep-ocean)] p-2 rounded-full shadow-lg">
            <Plus className="w-6 h-6" />
          </div>
        </div>
      </div>

      <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">
        {t("dashboard.title")}
      </h2>

      <p className="text-[var(--text-secondary)] max-w-md text-lg mb-8 leading-relaxed">
        {t("dashboard.subtitle")}
      </p>

      <button
        onClick={onAddHotel}
        className="bg-gradient-to-r from-[var(--soft-gold)] to-[#B49020] text-white font-extrabold text-lg px-8 py-4 rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] transform hover:-translate-y-1 transition-all"
      >
        {t("common.addHotel")}
      </button>

      <div className="mt-12 grid grid-cols-3 gap-8 text-center opacity-50">
        <div className="flex flex-col items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--soft-gold)]" />
          <span className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
            {t("alerts.undercut")}
          </span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--soft-gold)]" />
          <span className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
            {t("hotelDetails.featureAnalysis")}
          </span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--soft-gold)]" />
          <span className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
            {t("alerts.title")}
          </span>
        </div>
      </div>
    </div>
  );
}
