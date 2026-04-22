"use client";

import { ScanSession } from "@/types";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Database,
  ChevronRight,
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
    <div className="mt-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#F6C344]/10 text-[#F6C344]">
            <Database className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight">
            {title || t("history.intelLogs")}
          </h2>
        </div>
        <span className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest">
          {t("history.lastPulseCount").replace("{0}", "10")}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onOpenSession(session)}
            className="group glass-card rounded-[2rem] px-6 py-5 flex items-center justify-between hover:bg-white/[0.04] transition-all border-[var(--overlay-border)] hover:border-[var(--overlay-border)] text-left"
          >
            <div className="flex items-center gap-6">
              <div
                className={`p-3.5 rounded-2xl ${
                  session.status === "completed"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                } group-hover:scale-110 transition-transform`}
              >
                {session.status === "completed" ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1.5">
                  <p className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
                    {t("history.scanSession").replace(
                      "{0}",
                      session.session_type || "",
                    )}
                  </p>
                  <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20 uppercase tracking-widest">
                    {t("history.hotelsCount").replace(
                      "{0}",
                      session.hotels_count.toString(),
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest opacity-60">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatDate(session.created_at)}</span>
                  </div>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className="italic font-medium normal-case">
                    {t("history.sessionIdShort").replace(
                      "{0}",
                      session.id.slice(0, 8),
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right hidden sm:block">
                <span
                  className={`text-[10px] font-black uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-full border ${
                    session.status === "completed"
                      ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/20"
                      : "text-amber-500 bg-amber-500/5 border-amber-500/20"
                  }`}
                >
                  {session.status}
                </span>
              </div>
              <div className="p-2 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
                <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
