"use client";

import {
  Bell,
  Search,
  User,
  Zap,
  Globe,
  Activity,
  Command,
  ShieldCheck,
} from "lucide-react";

interface CommandHeaderProps {
  userProfile: any;
}

export default function CommandHeader({ userProfile }: CommandHeaderProps) {
  return (
    <header className="h-24 flex items-center justify-between px-10 bg-black/40 backdrop-blur-3xl border-b border-white/5 z-50 relative overflow-hidden">
      {/* Background Silk Aura */}
      <div className="absolute top-0 left-1/4 w-64 h-24 bg-[var(--gold-glow)] opacity-5 blur-[100px] pointer-events-none" />

      {/* Left Intelligence Input */}
      <div className="flex items-center space-x-8 flex-1 max-w-3xl">
        <div className="flex items-center gap-3 px-4 py-2 bg-[var(--gold-primary)]/10 rounded-xl border border-[var(--gold-primary)]/20 shadow-[0_0_15px_rgba(212,175,55,0.05)]">
          <Command size={16} className="text-[var(--gold-primary)]" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--gold-primary)]">
            Protocol_Alpha
          </span>
        </div>

        <div className="relative w-full group">
          <div className="absolute inset-0 bg-[var(--gold-primary)]/5 opacity-0 group-focus-within:opacity-100 rounded-2xl transition-opacity blur-xl" />
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--gold-primary)] transition-all transform group-focus-within:scale-110" />
          <input
            type="text"
            placeholder="Search intelligence matrix..."
            className="w-full bg-black/40 border border-white/5 rounded-2xl py-3.5 pl-14 pr-6 text-sm font-bold text-white placeholder:text-white/20 focus:outline-none focus:border-[var(--gold-primary)]/40 focus:ring-1 focus:ring-[var(--gold-primary)]/20 transition-all shadow-inner uppercase tracking-wide"
          />
        </div>
      </div>

      {/* Right Intelligence Controls */}
      <div className="flex items-center space-x-10">
        {/* Market Sync Indicator */}
        <div className="hidden lg:flex items-center space-x-4 px-6 py-2.5 border border-white/5 rounded-2xl bg-black/60 shadow-2xl group cursor-help transition-all hover:border-[var(--gold-primary)]/20">
          <div className="relative flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,1)]" />
            <div className="absolute inset-0 bg-emerald-500/20 blur-md rounded-full" />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-white uppercase tracking-[0.4em]">
              MARKET_SYNC_STATUS
            </span>
            <span className="text-[8px] font-bold text-emerald-500/60 uppercase tracking-widest mt-0.5">
              OPTIMAL_LATENCY_0.3MS
            </span>
          </div>
        </div>

        {/* Control Cluster */}
        <div className="flex items-center space-x-6">
          {[
            { icon: Bell, alert: true },
            { icon: Globe, alert: false },
            { icon: ShieldCheck, alert: false },
          ].map((item, i) => (
            <button
              key={i}
              className="p-3 rounded-2xl bg-white/5 border border-white/5 text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-all relative transform hover:scale-110 active:scale-95 group"
            >
              <item.icon
                size={20}
                className="group-hover:rotate-6 transition-transform"
              />
              {item.alert && (
                <span className="absolute top-3 right-3 w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,1)] border border-black" />
              )}
            </button>
          ))}
        </div>

        {/* Identity Token */}
        <div className="flex items-center space-x-5 pl-10 border-l border-white/5">
          <div className="text-right hidden xl:block">
            <p className="text-sm font-black text-white tracking-tighter uppercase leading-none mb-1.5">
              {userProfile?.full_name || "Nexus_User"}
            </p>
            <div className="flex items-center justify-end gap-2">
              <Zap size={10} className="text-[var(--gold-primary)]" />
              <p className="text-[9px] text-[var(--gold-primary)] font-black uppercase tracking-[0.3em] opacity-80 leading-none">
                {userProfile?.plan_type || "Pro_Strategist"}
              </p>
            </div>
          </div>
          <div className="relative group">
            <div className="absolute inset-0 bg-[var(--gold-primary)]/20 blur-lg rounded-2xl group-hover:blur-xl transition-all" />
            <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--gold-primary)] to-[#8c6d00] p-[2px] shadow-2xl transform group-hover:rotate-3 transition-transform duration-500">
              <div className="w-full h-full rounded-[14px] bg-black flex items-center justify-center text-[var(--gold-primary)] font-black text-base uppercase tracking-tighter">
                {userProfile?.full_name?.[0] || userProfile?.email?.[0] || "U"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
