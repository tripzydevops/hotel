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
          <h2 className="text-xl font-black text-white tracking-tight">
            {title || t("history.intelLogs")}
          </h2>
        </div>
        <span className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest">
          {t("history.lastPulseCount").replace("{0}", "10")}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onOpenSession(session)}
            className="group card-blur rounded-[1.5rem] px-6 py-4 flex items-center justify-between hover:bg-white/[0.03] transition-all border border-white/5 hover:border-[#F6C344]/30 text-left"
          >
            <div className="flex items-center gap-6">
              <div
                className={`p-3 rounded-2xl ${
                  session.status === "completed"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                }`}
              >
                {session.status === "completed" ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-black text-white uppercase tracking-wider">
                    {t("history.scanSession").replace(
                      "{0}",
                      session.session_type || "",
                    )}
                  </p>
                  <span className="text-[10px] font-bold text-[var(--text-muted)] bg-white/5 px-2 py-0.5 rounded">
                    {t("history.hotelsCount").replace(
                      "{0}",
                      session.hotels_count.toString(),
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[var(--text-muted)] text-[10px] font-medium">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(session.created_at)}</span>
                  </div>
                  <span className="w-0.5 h-0.5 rounded-full bg-white/20" />
                  <span className="italic">
                    {t("history.sessionIdShort").replace(
                      "{0}",
                      session.id.slice(0, 8),
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <span
                  className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${
                    session.status === "completed"
                      ? "text-emerald-400 bg-emerald-500/5"
                      : "text-amber-500 bg-amber-500/5"
                  }`}
                >
                  {session.status}
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-white group-hover:translate-x-1 transition-all" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
