"use client";

import { ScanSession } from "@/types";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Database,
  ChevronRight,
  Zap,
  Activity,
  Cpu,
  Target,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface ScanHistoryProps {
  sessions: ScanSession[];
  onOpenSession: (session: ScanSession) => void;
  title?: string;
}

export default function ScanHistory({
  sessions,
  onOpenSession,
  title,
}: ScanHistoryProps) {
  const { t, locale } = useI18n();
  if (sessions.length === 0) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(
      locale === "en" ? "en-US" : "tr-TR",
      {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      },
    );
  };

  return (
    <div className="mt-20">
      <div className="flex items-center justify-between mb-8 px-2">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] border border-[var(--gold-primary)]/20 shadow-[0_0_20px_rgba(212,175,55,0.1)]">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic leading-none">
              {title || t("history.intelLogs")}
            </h2>
            <p className="text-[9px] font-black text-[var(--gold-primary)] uppercase tracking-[0.4em] mt-1 opacity-60">
              Activity History Log
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/5">
          <Cpu size={12} className="text-[var(--gold-primary)] opacity-40" />
          <span className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em]">
            {t("history.lastPulseCount").replace("{0}", "10")} Tracked
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onOpenSession(session)}
            className="group premium-card px-8 py-6 flex items-center justify-between hover:bg-white/[0.03] transition-all border border-white/5 hover:border-[var(--gold-primary)]/20 text-left relative overflow-hidden active:scale-[0.99]"
          >
            {/* Horizontal Silk Glow on Hover */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--gold-primary)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="flex items-center gap-8">
              <div
                className={`p-4 rounded-2xl transition-all duration-500 relative ${
                  session.status === "completed"
                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                }`}
              >
                {session.status === "completed" ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <AlertCircle className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-4 mb-2">
                  <p className="text-lg font-black text-white uppercase tracking-tight group-hover:text-[var(--gold-primary)] transition-colors leading-none">
                    {t("history.scanSession").replace(
                      "{0}",
                      session.session_type || "",
                    )}
                  </p>
                  <div className="flex items-center gap-2 px-2.5 py-1 bg-white/5 border border-white/5 rounded-lg">
                    <Target className="w-3 h-3 text-[var(--gold-primary)] opacity-40" />
                    <span className="text-[9px] font-black text-white/40 uppercase tracking-widest whitespace-nowrap">
                      {t("history.hotelsCount").replace(
                        "{0}",
                        session.hotels_count.toString(),
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-6 text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] relative">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[var(--gold-primary)] opacity-40" />
                    <span>Epoch: {formatDate(session.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
                    <span className="italic opacity-60">
                      SIG_{session.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-8">
              <div className="text-right hidden sm:block">
                <span
                  className={`text-[9px] font-black uppercase tracking-[0.25em] px-4 py-2 rounded-xl border transition-all duration-500 ${
                    session.status === "completed"
                      ? "text-emerald-500 bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                      : "text-amber-500 bg-amber-500/5 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                  }`}
                >
                  Status:{" "}
                  {session.status === "completed" ? "Success" : "Partial"}
                </span>
              </div>
              <div className="p-3 bg-white/5 rounded-xl group-hover:bg-[var(--gold-primary)] transition-all">
                <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-black transition-all group-hover:translate-x-1" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
