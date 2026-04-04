"use client";

import { ScanSession } from "@/types";
import { Activity, Zap, ChevronRight } from "lucide-react";
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
    <div className="mt-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#F6C344]/10 text-[#F6C344]">
            <Zap className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">
            {title || t("history.rapidPulseHistory")}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onOpenSession(session)}
            className="group glass-card rounded-[2.5rem] p-6 hover:bg-white/[0.04] transition-all border-white/5 hover:border-white/10 text-left relative overflow-hidden h-full flex flex-col justify-between"
          >
            {/* Background Glow */}
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/5 blur-3xl group-hover:bg-indigo-500/10 transition-all rounded-full" />

            <div className="flex flex-col gap-5 relative z-10">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-white/5 text-[var(--text-muted)] group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-all">
                  <Activity className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-black text-[var(--text-muted)] group-hover:text-white uppercase tracking-[0.2em] opacity-60">
                  {formatDate(session.created_at)}
                </span>
              </div>

              <div>
                <p className="text-sm font-black text-[var(--text-primary)] mb-1.5 group-hover:text-indigo-300 transition-colors tracking-tight uppercase">
                  {t("history.propertiesBatch").replace(
                    "{0}",
                    session.hotels_count.toString(),
                  )}
                </p>
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/5 border border-white/5 w-fit">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      session.status === "completed"
                        ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                        : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                    }`}
                  />
                  <p className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest">
                    {session.status} Scan
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-5 mt-5 border-t border-white/5 group-hover:border-indigo-500/20 transition-all">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] group-hover:text-indigo-300 transition-colors">
                {t("history.viewDetails")}
              </span>
              <div className="p-1.5 rounded-full bg-white/5 group-hover:bg-indigo-500/10 transition-all">
                <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-indigo-300 group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
