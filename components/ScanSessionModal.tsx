"use client";

import { useState, useEffect } from "react";
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
  Target,
  Sparkles,
  Search,
  Cpu,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { ScanSession, QueryLog } from "@/types";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

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

  useEffect(() => {
    if (isOpen && session) {
      fetchSessionLogs();
    }
  }, [isOpen, session]);

  const fetchSessionLogs = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const result = await api.getSessionLogs(session.id);
      setLogs(result);
    } catch (error) {
      console.error("Failed to fetch session logs:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !session) return null;

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
    link.setAttribute("download", `scan_session_${session.id.slice(0, 8)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl transition-all duration-500">
      <div className="premium-card w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in duration-500 bg-black/40 border-[var(--gold-primary)]/10">
        {/* Silk Glow Effect */}
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-[var(--gold-glow)] opacity-10 blur-[100px] pointer-events-none" />

        {/* Header Protocol */}
        <div className="p-8 border-b border-white/5 bg-black/40 backdrop-blur-3xl relative z-10">
          <div className="flex flex-col xl:flex-row xl:items-start justify-between mb-8 gap-8">
            <div className="flex items-center gap-6">
              <div className="relative group">
                <div className="absolute inset-0 bg-[var(--gold-primary)]/20 blur-xl rounded-2xl group-hover:blur-2xl transition-all" />
                <div className="relative p-5 rounded-2xl bg-black border border-[var(--gold-primary)]/40 text-[var(--gold-primary)] shadow-2xl">
                  <Database className="w-8 h-8" />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-emerald-500 p-1 rounded-full shadow-lg z-20">
                  <ShieldCheck className="w-4 h-4 text-black" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">
                    {t("scanSession.title")}
                  </h2>
                  <div
                    className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] border ${
                      session.status === "completed"
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    }`}
                  >
                    {session.status}_Identity
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-6 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-[var(--gold-primary)] opacity-40" />
                    <span>Epoch: {formatDate(session.created_at)}</span>
                  </div>
                  {session.check_in_date && (
                    <div className="flex items-center gap-2">
                      <Target className="w-3.5 h-3.5 text-[var(--gold-primary)] opacity-40" />
                      <span>Reference: {session.check_in_date}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-[var(--gold-primary)] opacity-40" />
                    <span>Nodes: {session.adults || 2} Units</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={exportToCSV}
                disabled={loading || logs.length === 0}
                className="btn-premium px-6 py-3 text-[10px] font-black flex items-center gap-3 group disabled:opacity-30 disabled:pointer-events-none"
              >
                <Download className="w-4 h-4 group-hover:-translate-y-1 transition-transform" />
                {t("scanSession.csvExport")}
              </button>
              <button
                onClick={onClose}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5 text-[var(--text-muted)] hover:text-white group"
              >
                <X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
              </button>
            </div>
          </div>

          {/* Neural Summary Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                label: t("scanSession.averageRate"),
                value:
                  logs.length > 0
                    ? api.formatCurrency(
                        logs.reduce((acc, l) => acc + (l.price || 0), 0) /
                          logs.length,
                        logs[0]?.currency || "TRY",
                      )
                    : "—",
                color: "text-white",
              },
              {
                label: t("scanSession.successRate"),
                value: `${session.hotels_count > 0 ? ((logs.filter((l) => l.status === "success").length / session.hotels_count) * 100).toFixed(0) : "0"}%`,
                color: "text-emerald-500",
              },
              {
                label: t("scanSession.vendors"),
                value: new Set(logs.map((l) => l.vendor).filter(Boolean)).size,
                color: "text-[var(--gold-primary)]",
              },
              {
                label: t("scanSession.sessionId"),
                value: session.id.slice(0, 8).toUpperCase(),
                color: "text-white/40",
                font: "font-mono",
              },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 hover:bg-white/[0.05] transition-all group/stat"
              >
                <p className="text-[9px] text-[var(--text-muted)] uppercase font-black tracking-[0.3em] mb-3 opacity-60 group-hover/stat:text-[var(--gold-primary)] transition-colors">
                  {stat.label}
                </p>
                <div
                  className={`text-2xl font-black tracking-tighter ${stat.color} ${stat.font || ""}`}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Intelligence Stream */}
        <div className="flex-1 overflow-y-auto p-10 bg-[var(--bg-deep)] custom-scrollbar relative">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-[var(--gold-primary)]/20 blur-2xl rounded-full scale-150 animate-pulse" />
                <Cpu className="w-12 h-12 text-[var(--gold-primary)] animate-spin-slow" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--gold-primary)] animate-pulse">
                Synchronizing_Neural_Feed...
              </p>
            </div>
          ) : (
            <div className="space-y-12">
              {/* Agent Mesh Visualization */}
              <div className="premium-card p-10 bg-black/40 border-[var(--gold-primary)]/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Zap className="w-32 h-32 text-[var(--gold-primary)]" />
                </div>
                <h3 className="text-[10px] font-black text-[var(--gold-primary)] uppercase tracking-[0.4em] mb-10 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[var(--gold-primary)] animate-ping" />
                  Agent-Mesh_Orchestration_Protocol
                </h3>

                <div className="grid grid-cols-3 gap-8 relative">
                  {/* Continuous Connection Line */}
                  <div className="absolute top-8 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-[var(--gold-primary)] to-transparent opacity-20" />

                  {[
                    {
                      icon: Search,
                      label: "Extraction Agent",
                      status: session.status !== "pending",
                      desc: "Surface Data Harvested",
                      color: "text-emerald-500",
                    },
                    {
                      icon: Cpu,
                      label: "Synthesis Agent",
                      status: ["completed", "partial", "failed"].includes(
                        session.status,
                      ),
                      desc: "Neural Insights Generated",
                      color: "text-[var(--gold-primary)]",
                    },
                    {
                      icon: Activity,
                      label: "Dispatch Agent",
                      status: session.status === "completed",
                      desc: "Strategic Alerts Issued",
                      color: "text-blue-500",
                    },
                  ].map((agent, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center gap-4 group/node"
                    >
                      <div
                        className={`w-16 h-16 rounded-3xl flex items-center justify-center border-2 transition-all duration-700 relative ${
                          agent.status
                            ? `bg-black border-${agent.color.split("-")[1]}-500/40 shadow-[0_0_30px_rgba(0,0,0,0.5)]`
                            : "bg-white/5 border-white/10 text-white/10"
                        }`}
                      >
                        {agent.status && (
                          <div
                            className={`absolute inset-0 bg-${agent.color.split("-")[1]}-500/10 blur-xl rounded-full animate-pulse`}
                          />
                        )}
                        <agent.icon
                          className={`w-7 h-7 relative z-10 ${agent.status ? agent.color : "text-white/20"}`}
                        />
                      </div>
                      <div className="text-center">
                        <p
                          className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 ${agent.status ? "text-white" : "text-white/20"}`}
                        >
                          {agent.label}
                        </p>
                        <p
                          className={`text-[8px] font-bold uppercase tracking-widest ${agent.status ? "text-[var(--text-muted)]" : "text-white/10"}`}
                        >
                          {agent.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Individual Node Updates */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em] px-2 mb-6">
                  Raw_Data_Stream_Nodes
                </h3>
                {logs.length === 0 ? (
                  <div className="text-center py-20 bg-black/20 rounded-3xl border border-dashed border-white/10">
                    <AlertCircle className="w-16 h-16 text-white/5 mx-auto mb-6" />
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.5em] italic">
                      {t("scanSession.noRecords")}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className="group flex items-center justify-between p-6 bg-black/40 hover:bg-black/60 border border-white/5 hover:border-[var(--gold-primary)]/20 rounded-2xl transition-all duration-500"
                      >
                        <div className="flex items-center gap-6">
                          <div
                            className={`p-4 rounded-xl relative overflow-hidden ${
                              log.status === "success"
                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                                : "bg-red-500/10 text-red-500 border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]"
                            }`}
                          >
                            {log.status === "success" ? (
                              <Sparkles className="w-5 h-5" />
                            ) : (
                              <AlertCircle className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <p className="text-lg font-black text-white tracking-tight uppercase group-hover:text-[var(--gold-primary)] transition-colors">
                              {log.hotel_name}
                            </p>
                            <div className="flex items-center gap-4 mt-2">
                              <div className="flex items-center gap-2 text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                                <MapPin className="w-3 h-3 text-[var(--gold-primary)]" />
                                <span>
                                  {log.location || "Awaiting_Node_Sync"}
                                </span>
                              </div>
                              {log.vendor && (
                                <div className="flex items-center gap-2 px-2 py-0.5 rounded-md bg-white/5 border border-white/5">
                                  <span className="text-[8px] font-black text-[var(--gold-primary)] uppercase tracking-tighter italic">
                                    VIA_{log.vendor}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-10">
                          {log.price && (
                            <div className="text-right">
                              <span className="text-[10px] font-black text-[var(--gold-primary)] uppercase tracking-widest mb-1 block opacity-60">
                                Valuation
                              </span>
                              <p className="text-3xl font-black text-white tracking-tighter font-mono italic">
                                {api.formatCurrency(
                                  log.price,
                                  log.currency || "USD",
                                )}
                              </p>
                            </div>
                          )}
                          <div className="hidden lg:block min-w-[120px] text-right">
                            <span
                              className={`text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-xl border ${
                                log.status === "success"
                                  ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                                  : "text-red-500 border-red-500/20 bg-red-500/5 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                              }`}
                            >
                              {log.status === "success"
                                ? "Verfied"
                                : "Interrupted"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Protocol Footer */}
        <div className="px-10 py-6 border-t border-white/5 bg-black/40 backdrop-blur-3xl flex items-center justify-between relative z-10 transition-all">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-[var(--gold-primary)]/10">
              <ShieldCheck className="w-4 h-4 text-[var(--gold-primary)]" />
            </div>
            <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em]">
              Verified_Neural_Integrity • Deep_Extraction Protocol
            </p>
          </div>
          <div className="flex items-center gap-3 px-5 py-2 rounded-2xl bg-white/5 border border-white/5">
            <Clock className="w-4 h-4 text-[var(--gold-primary)] opacity-60" />
            <span className="text-[10px] text-white font-black uppercase tracking-[0.2em] group-hover:text-[var(--gold-primary)] transition-colors">
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
