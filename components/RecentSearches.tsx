"use client";

import { ScanSession } from "@/types";
import {
  History,
  Plus,
  ChevronRight,
  Activity,
  Zap,
  Cpu,
  Target,
  Sparkles,
} from "lucide-react";

interface RecentSearchesProps {
  sessions: ScanSession[];
  onOpenSession: (session: ScanSession) => void;
  onAddHotel: (name: string, location: string) => void;
}

export default function RecentSearches({
  sessions,
  onOpenSession,
  onAddHotel,
}: RecentSearchesProps) {
  if (sessions.length === 0) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="mt-20">
      <div className="flex items-center justify-between mb-8 px-2">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] border border-[var(--gold-primary)]/20 shadow-[0_0_20px_rgba(212,175,55,0.1)]">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic leading-none">
              Rapid_Pulse_Stream
            </h2>
            <p className="text-[9px] font-black text-[var(--gold-primary)] uppercase tracking-[0.4em] mt-1 opacity-60">
              Real-Time_Capture_Logs
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onOpenSession(session)}
            className="group premium-card p-6 h-full hover:bg-white/[0.03] transition-all border border-white/5 hover:border-[var(--gold-primary)]/20 text-left relative overflow-hidden flex flex-col justify-between active:scale-[0.98]"
          >
            {/* Corner Glow */}
            <div className="absolute -right-8 -top-8 w-24 h-24 bg-[var(--gold-primary)]/5 blur-3xl group-hover:bg-[var(--gold-primary)]/10 transition-all rounded-full" />

            <div className="space-y-6 relative z-10">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 text-[var(--gold-primary)] shadow-2xl group-hover:scale-110 transition-transform">
                  <Activity className="w-4 h-4" />
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[9px] font-black text-white/20 uppercase tracking-widest group-hover:text-white transition-colors">
                    {formatDate(session.created_at)} UTC
                  </span>
                  <span className="text-[7px] font-bold text-[var(--gold-primary)] uppercase tracking-[0.3em] opacity-40">
                    Live_Capture
                  </span>
                </div>
              </div>

              <div>
                <p className="text-lg font-black text-white mb-2 group-hover:text-[var(--gold-primary)] transition-colors leading-none tracking-tight">
                  {session.hotels_count}_Node_Batch
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                      session.status === "completed"
                        ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                        : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                    }`}
                  />
                  <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest leading-none">
                    {session.status}_Status
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 mt-6 border-t border-white/5 relative z-10">
              <div className="flex items-center gap-2">
                <Cpu
                  size={10}
                  className="text-[var(--gold-primary)] opacity-40 group-hover:opacity-100 transition-opacity"
                />
                <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] group-hover:text-white transition-colors">
                  Sync_Details
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--gold-primary)] group-hover:translate-x-1 transition-all" />
            </div>

            {/* Visual Progress Bar Mockup */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5">
              <div
                className={`h-full bg-[var(--gold-gradient)] transition-all duration-1000 ${session.status === "completed" ? "w-full" : "w-1/2"}`}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
