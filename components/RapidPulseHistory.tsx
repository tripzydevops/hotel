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
          <div className="p-2 rounded-xl bg-[var(--soft-gold)]/10 text-[var(--soft-gold)]">
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
            className="group glass-card p-5 hover:bg-white/[0.04] transition-all border border-white/5 hover:border-[var(--soft-gold)]/30 text-left relative overflow-hidden"
          >
            {/* Background Glow */}
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-[var(--soft-gold)]/5 blur-2xl group-hover:bg-[var(--soft-gold)]/10 transition-all rounded-full" />

            <div className="flex flex-col gap-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-white/5 text-[var(--text-muted)] group-hover:text-[var(--soft-gold)] transition-colors">
                  <Activity className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-black text-[var(--text-muted)] group-hover:text-white uppercase tracking-widest">
                  {formatDate(session.created_at)}
                </span>
              </div>

              <div>
                <p className="text-sm font-black text-white mb-1 group-hover:text-[var(--soft-gold)] transition-colors">
                  {t("history.propertiesBatch").replace(
                    "{0}",
                    session.hotels_count.toString(),
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      session.status === "completed"
                        ? "bg-optimal-green"
                        : "bg-amber-500"
                    }`}
                  />
                  <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                    {session.status} Scan
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">
                  {t("history.viewDetails")}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
