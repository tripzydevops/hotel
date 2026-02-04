"use client";

import {
  Building2,
  Plus,
  Zap,
  Sparkles,
  Target,
  Activity,
  ZapOff,
  ShieldCheck,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface ZeroStateProps {
  onAddHotel: () => void;
}

export default function ZeroState({ onAddHotel }: ZeroStateProps) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] text-center p-8 animate-in fade-in zoom-in duration-1000 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[var(--gold-glow)] opacity-5 blur-[150px] pointer-events-none" />

      <div className="relative mb-16 group cursor-pointer" onClick={onAddHotel}>
        {/* Pulsing Aura */}
        <div className="absolute inset-0 bg-[var(--gold-primary)]/20 rounded-full blur-[120px] group-hover:bg-[var(--gold-primary)]/40 transition-all duration-1000 opacity-60 animate-pulse" />

        <div className="relative bg-black/40 border-2 border-[var(--gold-primary)]/10 p-16 rounded-[4rem] shadow-[0_50px_100px_rgba(0,0,0,0.8)] backdrop-blur-3xl group-hover:scale-105 group-hover:rotate-1 transition-all duration-700 group-hover:border-[var(--gold-primary)]/40 overflow-hidden">
          {/* Moving Shine Effect */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--gold-primary)] to-transparent opacity-20 transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

          <Building2 className="w-32 h-32 text-[var(--gold-primary)] filter drop-shadow-[0_0_20px_rgba(212,175,55,0.4)]" />

          <div className="absolute -bottom-6 -right-6 bg-[var(--gold-gradient)] text-black p-6 rounded-3xl shadow-[0_20px_50px_rgba(212,175,55,0.4)] transform rotate-12 group-hover:rotate-0 transition-all duration-500 hover:scale-110">
            <Plus className="w-10 h-10 font-black" />
          </div>
        </div>
      </div>

      <div className="space-y-6 relative z-10">
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-[var(--gold-primary)] opacity-40" />
          <span className="text-[10px] font-black text-[var(--gold-primary)] uppercase tracking-[0.6em] italic">
            System_Idle
          </span>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-[var(--gold-primary)] opacity-40" />
        </div>

        <h2 className="text-6xl font-black text-white mb-8 tracking-tighter uppercase leading-none italic max-w-2xl bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
          READY_FOR_DEPLOYMENT
        </h2>

        <p className="text-[var(--text-muted)] max-w-lg text-lg mb-14 leading-relaxed font-bold uppercase tracking-tight opacity-80 mx-auto border-l-2 border-[var(--gold-primary)]/20 pl-8 text-left">
          Initialize your first market intelligence node to establish signal
          parity and activate real-time yield optimization matrix.
        </p>

        <div className="flex flex-col items-center gap-8">
          <button
            onClick={onAddHotel}
            className="btn-premium flex items-center justify-center gap-6 text-sm px-16 py-6 shadow-[0_30px_60px_rgba(212,175,55,0.2)] transition-all hover:scale-105 hover:shadow-[0_40px_80px_rgba(212,175,55,0.3)] group/btn relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
            <Zap
              size={22}
              className="text-black fill-current animate-pulse relative z-10"
            />
            <span className="font-black uppercase tracking-[0.4em] text-black relative z-10 text-lg">
              Initialize_Network
            </span>
          </button>

          <div className="flex items-center gap-3 opacity-40 group cursor-default">
            <ShieldCheck size={14} className="text-[var(--gold-primary)]" />
            <span className="text-[9px] font-black text-white uppercase tracking-[0.4em] group-hover:text-[var(--gold-primary)] transition-colors">
              Yield_Secure_Environment
            </span>
          </div>
        </div>
      </div>

      <div className="mt-28 flex flex-wrap justify-center items-center gap-12 text-center opacity-20 select-none">
        {[
          { icon: Sparkles, label: "Market_Capture" },
          { icon: Activity, label: "Neural_Drift" },
          { icon: Target, label: "Yield_Parity" },
        ].map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-4 group/stat hover:opacity-100 transition-opacity"
          >
            <item.icon
              size={16}
              className="text-[var(--gold-primary)] group-hover:scale-125 transition-transform"
            />
            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white">
              {item.label}
            </span>
            {i < 2 && <div className="ml-8 w-[1px] h-6 bg-white/20" />}
          </div>
        ))}
      </div>
    </div>
  );
}
