"use client";

import { Building2, Plus } from "lucide-react";

interface ZeroStateProps {
  onAddHotel: () => void;
}

export default function ZeroState({ onAddHotel }: ZeroStateProps) {
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
        Welcome to Rate Sentinel
      </h2>

      <p className="text-[var(--text-secondary)] max-w-md text-lg mb-8 leading-relaxed">
        Your dashboard is empty. Start by adding a
        <span className="text-[var(--soft-gold)] font-bold mx-1">
          Target Hotel
        </span>
        to monitor its rates against competitors automatically.
      </p>

      <button
        onClick={onAddHotel}
        className="btn-gold text-lg px-8 py-4 shadow-[0_0_20px_rgba(255,215,0,0.15)] hover:shadow-[0_0_30px_rgba(255,215,0,0.3)] transform hover:-translate-y-1 transition-all"
      >
        Add Your First Hotel
      </button>

      <div className="mt-12 grid grid-cols-3 gap-8 text-center opacity-50">
        <div className="flex flex-col items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--soft-gold)]" />
          <span className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
            Track Prices
          </span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--soft-gold)]" />
          <span className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
            Spy Competitors
          </span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--soft-gold)]" />
          <span className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
            Get Alerts
          </span>
        </div>
      </div>
    </div>
  );
}
