"use client";

import { Bell, Search, User, Zap, Globe, Activity } from "lucide-react";

interface CommandHeaderProps {
  userProfile: any;
}

export default function CommandHeader({ userProfile }: CommandHeaderProps) {
  return (
    <header className="h-16 flex items-center justify-between px-6 bg-[#071529]/50 backdrop-blur-md border-b border-[var(--panel-border)] z-10">
      {/* Left Search / Breadcrumb */}
      <div className="flex items-center space-x-4 flex-1 max-w-xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search agents, properties, or signals..."
            className="w-full bg-black/20 border border-[var(--panel-border)] rounded-sm py-2 pl-10 pr-4 text-xs focus:outline-none focus:border-[var(--soft-gold)] transition-colors"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-6">
        {/* System Pulse Indicator */}
        <div className="hidden md:flex items-center space-x-2 px-3 py-1 border border-[var(--panel-border)] rounded-sm bg-black/20">
          <Activity className="w-3 h-3 text-[var(--success)] animate-pulse" />
          <span className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest">
            System Optimal
          </span>
        </div>

        {/* Global Stats */}
        <div className="flex items-center space-x-4 text-[var(--text-muted)]">
          <button className="hover:text-[var(--soft-gold)] transition-colors">
            <Bell size={18} />
          </button>
          <button className="hover:text-[var(--soft-gold)] transition-colors">
            <Globe size={18} />
          </button>
        </div>

        {/* Profile */}
        <div className="flex items-center space-x-3 pl-4 border-l border-[var(--panel-border)]">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-white">
              {userProfile?.full_name || userProfile?.email}
            </p>
            <p className="text-[10px] text-[var(--soft-gold)] font-mono uppercase tracking-tighter">
              {userProfile?.plan_type || "Pro Analyst"}
            </p>
          </div>
          <div className="w-8 h-8 rounded-sm bg-[var(--soft-gold)] flex items-center justify-center text-black font-bold text-xs">
            {userProfile?.full_name?.[0] || userProfile?.email?.[0] || "U"}
          </div>
        </div>
      </div>
    </header>
  );
}
