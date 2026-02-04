"use client";

import { ScanSession } from "@/types";
import {
  Activity,
  Zap,
  ChevronRight,
  Cpu,
  Target,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface RapidPulseHistoryProps {
  sessions: ScanSession[];
  onOpenSession: (session: ScanSession) => void;
  title?: string;
}

export default function RapidPulseHistory({
  sessions,
  onOpenSession,
  title,
}: RapidPulseHistoryProps) {
  const { t, locale } = useI18n();
  if (sessions.length === 0) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString(
      locale === "en" ? "en-US" : "tr-TR",
      {
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
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic leading-none">
              {title || t("history.rapidPulseHistory")}
            </h2>
            <p className="text-[9px] font-black text-[var(--gold-primary)] uppercase tracking-[0.4em] mt-1 opacity-60">
              Neural_Signal_Stream
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onOpenSession(session)}
            className="group premium-card p-6 hover:bg-white/[0.03] transition-all border border-white/5 hover:border-[var(--gold-primary)]/20 text-left relative overflow-hidden flex flex-col justify-between active:scale-[0.98]"
          >
            {/* Corner Glow */}
            <div className="absolute -right-8 -top-8 w-24 h-24 bg-[var(--gold-primary)]/5 blur-3xl group-hover:bg-[var(--gold-primary)]/10 transition-all rounded-full" />

            <div className="relative z-10 space-y-6">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-black border border-white/5 text-[var(--gold-primary)] shadow-2xl group-hover:scale-110 transition-transform">
                  <Activity className="w-4 h-4" />
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[9px] font-black text-white/20 uppercase tracking-widest group-hover:text-white transition-colors">
                    {formatDate(session.created_at)} UTC
                  </span>
                  <span className="text-[7px] font-bold text-[var(--gold-primary)] uppercase tracking-[0.3em] opacity-40">
                    Live_Pulse
                  </span>
                </div>
              </div>

              <div>
                <p className="text-lg font-black text-white mb-2 group-hover:text-[var(--gold-primary)] transition-colors leading-none tracking-tight">
                  {t("history.propertiesBatch").replace(
                    "{0}",
                    session.hotels_count.toString(),
                  )}
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-1.5 h-1.5 rounded-full animate-pulse shadow-sm ${
                      session.status === "completed"
                        ? "bg-emerald-500 shadow-emerald-500/40"
                        : "bg-amber-500 shadow-amber-500/40"
                    }`}
                  />
                  <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest leading-none">
                    {session.status}_Identity
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-white/5 mt-4">
                <div className="flex items-center gap-2">
                  <Cpu
                    size={10}
                    className="text-[var(--gold-primary)] opacity-40 group-hover:opacity-100 transition-opacity"
                  />
                  <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest group-hover:text-white transition-colors">
                    {t("history.viewDetails")}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--gold-primary)] group-hover:translate-x-1 transition-all" />
              </div>
            </div>

            {/* Visual Signal Bar */}
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
