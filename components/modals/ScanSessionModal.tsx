"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  Calendar,
  Database,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  Users,
  Zap,
} from "lucide-react";

import { ScanSession, QueryLog } from "@/types";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import EmptyState from "@/components/ui/EmptyState";

interface ScanSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: ScanSession | null;
}

export default function ScanSessionModal({
  isOpen,
  onClose,
  session,
}: ScanSessionModalProps) {
  const { t } = useI18n();
  const [logs, setLogs] = useState<QueryLog[]>([]);
  const [loading, setLoading] = useState(false);
  // EXPLANATION: Live Session Polling
  // The initial `session` prop is a snapshot from when the modal was opened.
  // We poll the backend for updated session data (reasoning_trace, status)
  // so that the Agent Mesh icons and Reasoning Timeline update live.
  const [liveSession, setLiveSession] = useState<ScanSession | null>(session);

  // Sync liveSession when session prop changes (e.g., different scan selected)
  useEffect(() => {
    setLiveSession(session);
  }, [session]);

  const fetchSessionLogs = useCallback(async () => {
    if (!session) return;
    try {
      const result = await api.getSessionLogs(session.id);
      setLogs(result);
    } catch (error) {
      console.error("Failed to fetch session logs:", error);
    }
  }, [session]);

  // EXPLANATION: Poll for session data (reasoning_trace + status) every 3s
  // This powers the Agent Mesh step indicators and Reasoning Timeline.
  const fetchSession = useCallback(async () => {
    if (!session) return;
    try {
      const updated = await api.getSession(session.id);
      if (updated && !updated.error) {
        setLiveSession(updated as ScanSession);
      }
    } catch (error) {
      console.error("Failed to fetch session:", error);
    }
  }, [session]);

  useEffect(() => {
    let logsIntervalId: NodeJS.Timeout | undefined;
    let sessionIntervalId: NodeJS.Timeout | undefined;

    if (isOpen && session) {
      fetchSessionLogs();
      fetchSession();

      // Poll for updates if scan is not finished
      const isActive = liveSession?.status === "running" || liveSession?.status === "pending";
      if (isActive) {
        logsIntervalId = setInterval(fetchSessionLogs, 3000);
        sessionIntervalId = setInterval(fetchSession, 3000);
      } else {
        // Do one final fetch even for completed scans to get the latest reasoning_trace
        fetchSession();
      }
    }

    return () => {
      if (logsIntervalId) clearInterval(logsIntervalId);
      if (sessionIntervalId) clearInterval(sessionIntervalId);
    };
  }, [isOpen, session, liveSession?.status, fetchSessionLogs, fetchSession]);

  // Use liveSession for rendering — it has the most up-to-date data
  const activeSession = liveSession || session;
  if (!isOpen || !activeSession) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const exportToCSV = () => {
    const headers = [
      "Hotel Name",
      "Location",
      "Price",
      "Currency",
      "Vendor",
      "Status",
      "Date",
    ];
    const rows = logs.map((log) => [
      log.hotel_name,
      log.location || "",
      log.price || "",
      log.currency || "",
      log.vendor || "",
      log.status,
      log.created_at,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `scan_session_${activeSession.id.slice(0, 8)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md transition-all">
      <div className="bg-[var(--deep-ocean-card)] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="p-4 sm:p-8 border-b border-white/5 bg-white/[0.02]">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-3 sm:p-4 rounded-2xl bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] border border-[var(--soft-gold)]/20 shadow-inner">
                <Database className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <div>
                <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  {t("scanSession.title")}
                  <span
                    className={`text-[9px] sm:text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 sm:py-1 rounded-full font-bold self-start ${
                      activeSession.status === "completed"
                        ? "bg-optimal-green/20 text-optimal-green"
                        : "bg-amber-500/20 text-amber-500"
                    }`}
                  >
                    {activeSession.status}
                  </span>
                </h2>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 sm:mt-2 text-[10px] sm:text-xs text-[var(--text-muted)] font-medium">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span>Scan: {formatDate(activeSession.created_at)}</span>
                  </div>
                  {activeSession.check_in_date && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-white/10" />
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[var(--soft-gold)]" />
                        <span>Booked: {activeSession.check_in_date}</span>
                      </div>
                      <span className="w-1 h-1 rounded-full bg-white/10" />
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[var(--soft-gold)]" />
                        <span>{activeSession.adults || 2} People</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <button
                  onClick={exportToCSV}
                  // EXPLANATION: Prevent "possibly undefined" TypeScript error when reasoning_trace is optional
                  // Using null-coalescing (?? 0) ensures we compare a number to a number.
                  disabled={logs.length === 0 && !((activeSession.reasoning_trace?.length ?? 0) > 0)}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-white/5 border border-white/10 text-white text-[10px] sm:text-xs font-bold hover:bg-white/10 transition-all flex items-center gap-1.5 group disabled:opacity-50"
                >
                  <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:-translate-y-0.5 transition-transform" />
                  {t("scanSession.csvExport")}
                </button>
              </div>
              <button
                onClick={onClose}
                className="p-2 sm:p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5 text-[var(--text-muted)] hover:text-white"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>

          {/* Summary Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 sm:p-4">
              <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest mb-1">
                {t("scanSession.averageRate")}
              </p>
              <div className="flex items-end gap-1">
                <span className="text-xl sm:text-2xl font-black text-white">
                  {logs.length > 0
                    ? (
                        logs.reduce((acc, l) => acc + (l.price || 0), 0) /
                        logs.length
                      ).toFixed(0)
                    : "—"}
                </span>
                <span className="text-[9px] sm:text-[10px] text-[var(--text-muted)] mb-1 sm:mb-1.5">
                  {logs[0]?.currency || "USD"}
                </span>
              </div>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 sm:p-4">
              <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest mb-1">
                {t("scanSession.successRate")}
              </p>
              <div className="flex items-end gap-1">
                <span className="text-xl sm:text-2xl font-black text-optimal-green">
                  {activeSession.hotels_count > 0
                    ? (
                        (logs.filter((l) => l.status === "success").length /
                          activeSession.hotels_count) *
                        100
                      ).toFixed(0)
                    : "0"}
                  %
                </span>
              </div>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 sm:p-4">
              <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest mb-1">
                {t("scanSession.vendors")}
              </p>
              <div className="flex items-end gap-1">
                <span className="text-xl sm:text-2xl font-black text-white">
                  {new Set(logs.map((l) => l.vendor).filter(Boolean)).size}
                </span>
              </div>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 sm:p-4">
              <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest mb-1">
                {t("scanSession.sessionId")}
              </p>
              <div className="flex items-end gap-1">
                <span className="text-xs sm:text-sm font-mono text-[var(--text-muted)] mb-1">
                  {activeSession.id.slice(0, 8)}...
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-[var(--deep-ocean)]/30 backdrop-blur-sm">
          <div className="space-y-8">
            {/* Live Progress Bar */}
            {(activeSession.status === "running" || activeSession.status === "pending") && (
              <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl">
                <div className="flex justify-between items-end mb-3">
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-wider mb-1">
                      Scan in Progress...
                    </h4>
                    <p className="text-[10px] text-[var(--text-muted)] font-medium">
                      {activeSession.status === "running" ? "Agents harvesting data..." : "Queued in Mesh..."}
                    </p>
                  </div>
                  <span className="text-sm font-black text-[var(--soft-gold)]">
                    {Math.round(
                      (logs.length / (activeSession.hotels_count || 1)) * 100,
                    )}
                    %
                  </span>
                </div>
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-[var(--soft-gold)] to-amber-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_var(--soft-gold)]/30"
                    style={{
                      width: `${(logs.length / (activeSession.hotels_count || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Agent Mesh Processing Map */}
            <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <Zap className="w-24 h-24 text-[var(--soft-gold)]" />
              </div>
              <h3 className="text-[10px] font-black text-[var(--soft-gold)] uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--soft-gold)] animate-pulse" />
                Agent-Mesh Processing Status
              </h3>
              <div className="flex items-center justify-between max-w-2xl mx-auto relative px-4">
                {/* Connection Lines */}
                <div className="absolute top-5 left-0 right-0 h-[2px] bg-white/5 -z-0" />

                {/* Step 1: Scraper */}
                <div className="relative z-10 flex flex-col items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 ${
                      activeSession.status !== "pending" || (activeSession.reasoning_trace || []).some(t => JSON.stringify(t).includes("Scraper"))
                        ? "bg-optimal-green/20 border-optimal-green/50 text-optimal-green shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                        : "bg-white/5 border-white/10 text-[var(--text-muted)]"
                    }`}
                  >
                    <Database className="w-5 h-5" />
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-black uppercase text-white tracking-widest">
                      Scraper Agent
                    </p>
                    <p className="text-[8px] font-bold text-[var(--text-muted)]">
                      Data Harvested
                    </p>
                  </div>
                </div>

                {/* Step 2: Analyst */}
                <div className="relative z-10 flex flex-col items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 ${
                      ["completed", "partial", "failed"].includes(activeSession.status) || (activeSession.reasoning_trace || []).some(t => JSON.stringify(t).includes("Analyst"))
                        ? "bg-[var(--soft-gold)]/20 border-[var(--soft-gold)]/50 text-[var(--soft-gold)] shadow-[0_0_15px_rgba(255,215,0,0.2)]"
                        : "bg-white/5 border-white/10 text-[var(--text-muted)]"
                    }`}
                  >
                    <Zap className="w-5 h-5" />
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-black uppercase text-white tracking-widest">
                      Analyst Agent
                    </p>
                    <p className="text-[8px] font-bold text-[var(--text-muted)]">
                      Insights Generated
                    </p>
                  </div>
                </div>

                {/* Step 3: Notifier */}
                <div className="relative z-10 flex flex-col items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 ${
                      activeSession.status === "completed" || (activeSession.reasoning_trace || []).some(t => JSON.stringify(t).includes("Notifier"))
                        ? "bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                        : "bg-white/5 border-white/10 text-[var(--text-muted)]"
                    }`}
                  >
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-black uppercase text-white tracking-widest">
                      Notifier Agent
                    </p>
                    <p className="text-[8px] font-bold text-[var(--text-muted)]">
                      Alerts Dispatched
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {/* Agent Reasoning Timeline */}
            {activeSession.reasoning_trace && activeSession.reasoning_trace.length > 0 && (
              <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl">
                <h4 className="text-[10px] font-black text-[var(--soft-gold)] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--soft-gold)] animate-pulse" />
                  Agent Reasoning Timeline
                </h4>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {activeSession.reasoning_trace.map((trace: any, i: number) => {
                    // Handle Legacy String Traces
                    if (typeof trace === "string") {
                      return (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                          <span className="text-xs">📝</span>
                          <span className="text-[10px] text-white/80 font-mono leading-relaxed">
                            {trace}
                          </span>
                        </div>
                      );
                    }

                    // Handle New Structured ReasoningLog
                    const { step, level, message, timestamp } = trace;
                    let colorClass = "text-white/80";
                    let iconEmoji = "📝";
                    let bgClass = "bg-white/5";
                    let borderClass = "border-white/10";

                    switch (level) {
                      case "info":
                        if (step === "Scraping") { iconEmoji = "🌐"; colorClass = "text-blue-200"; bgClass="bg-blue-500/10"; borderClass="border-blue-500/20"; }
                        break;
                      case "success": iconEmoji = "✅"; colorClass = "text-optimal-green"; break;
                      case "error": iconEmoji = "❌"; colorClass = "text-alert-red"; break;
                    }

                    return (
                      <div key={i} className={`flex flex-col gap-1 p-3 rounded-xl border ${bgClass} ${borderClass}`}>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-[8px] font-black uppercase tracking-wider text-white/40">
                            {iconEmoji} {step}
                          </span>
                          <span className="text-[8px] font-mono text-white/20">
                            {timestamp ? new Date(timestamp * 1000).toLocaleTimeString() : ""}
                          </span>
                        </div>
                        <span className={`text-[10px] font-mono leading-relaxed ${colorClass}`}>
                          {message}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {logs.length === 0 ? (
              <EmptyState
                title={t("scanSession.noRecords") || "No records found"}
                icon={AlertCircle}
                className="bg-white/[0.01] border-dashed border-white/10"
              />
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="group flex items-center justify-between p-5 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 rounded-2xl transition-all duration-200"
                  >
                    <div className="flex items-center gap-5">
                      <div
                        className={`p-3 rounded-xl ${
                          log.status === "success"
                            ? "bg-optimal-green/10 text-optimal-green border border-optimal-green/20"
                            : "bg-alert-red/10 text-alert-red border border-alert-red/20"
                        }`}
                      >
                        {log.status === "success" ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <AlertCircle className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="text-base font-black text-white leading-none mb-1.5">
                          {log.hotel_name}
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-wider">
                            <MapPin className="w-3 h-3" />
                            <span>{log.location || t("common.pending")}</span>
                          </div>
                          {log.vendor && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-white/10" />
                              <span className="text-[10px] font-bold text-[var(--soft-gold)]/80 italic">
                                via {log.vendor}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      {log.price && (
                        <div className="text-right">
                          <p className="text-xl font-black text-white tracking-tight">
                            {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: log.currency || "USD",
                              minimumFractionDigits: 0,
                            }).format(log.price)}
                          </p>
                          <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-0.5">
                            {t("scanSession.liveRate")}
                          </p>
                        </div>
                      )}
                      <div className="hidden sm:block">
                        <span
                          className={`text-[10px] font-black uppercase tracking-[0.15em] px-3 py-1 rounded-lg ${
                            log.status === "success"
                              ? "text-optimal-green bg-optimal-green/5 border border-optimal-green/10"
                              : "text-alert-red bg-alert-red/5 border border-alert-red/10"
                          }`}
                        >
                          {log.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
          <p className="text-[10px] text-[var(--text-muted)] font-medium">
            {t("scanSession.verifiedSerp")} • {t("hotelDetails.foundVia")}{" "}
            SerpApi
          </p>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="text-[10px] text-white font-bold uppercase tracking-wider">
              {t("scanSession.generatedAt").replace(
                "{0}",
                new Date().toLocaleTimeString(),
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
