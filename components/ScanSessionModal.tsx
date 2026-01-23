"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Database, Download, CheckCircle2, AlertCircle, Clock, MapPin } from "lucide-react";
import { ScanSession, QueryLog } from "@/types";
import { api } from "@/lib/api";

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
      // We'll need to implement this endpoint or just fetch all logs for this session
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
    const headers = ["Hotel Name", "Location", "Price", "Currency", "Vendor", "Status", "Date"];
    const rows = logs.map(log => [
      log.hotel_name,
      log.location || "",
      log.price || "",
      log.currency || "",
      log.vendor || "",
      log.status,
      log.created_at
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
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

  const exportToJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `scan_session_${session.id.slice(0, 8)}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md transition-all">
      <div className="bg-[var(--deep-ocean-card)] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="p-8 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] border border-[var(--soft-gold)]/20 shadow-inner">
                <Database className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                  Pulse Intelligence Report
                  <span className={`text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-full font-bold ${
                    session.status === 'completed' ? 'bg-optimal-green/20 text-optimal-green' : 'bg-amber-500/20 text-amber-500'
                  }`}>
                    {session.status}
                  </span>
                </h2>
                <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-muted)] font-medium">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatDate(session.created_at)}</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-white/20" />
                  <div className="flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" />
                    <span className="text-white">{session.hotels_count} Properties Analyzed</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 mr-4">
                <button 
                  onClick={exportToCSV}
                  disabled={loading || logs.length === 0}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 transition-all flex items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
                  Export CSV
                </button>
                <button 
                  onClick={exportToJSON}
                  disabled={loading || logs.length === 0}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 transition-all flex items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
                  JSON
                </button>
              </div>
              <button
                onClick={onClose}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5 text-[var(--text-muted)] hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          
          {/* Summary Row */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
              <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest mb-1">Average Rate</p>
              <div className="flex items-end gap-1">
                <span className="text-2xl font-black text-white">
                  ${logs.length > 0 ? (logs.reduce((acc, l) => acc + (l.price || 0), 0) / logs.length).toFixed(0) : "—"}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] mb-1.5">USD</span>
              </div>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
              <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest mb-1">Success Rate</p>
              <div className="flex items-end gap-1">
                <span className="text-2xl font-black text-optimal-green">
                  {session.hotels_count > 0 ? ((logs.filter(l => l.status === 'success').length / session.hotels_count) * 100).toFixed(0) : "0"}%
                </span>
              </div>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
              <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest mb-1">Vendors</p>
              <div className="flex items-end gap-1">
                <span className="text-2xl font-black text-white">
                  {new Set(logs.map(l => l.vendor).filter(Boolean)).size}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] mb-1.5">Sourced</span>
              </div>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
              <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest mb-1">Session ID</p>
              <div className="flex items-end gap-1">
                <span className="text-sm font-mono text-[var(--text-muted)] mb-1">
                  {session.id.slice(0, 8)}...
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-[var(--deep-ocean)]/30 backdrop-blur-sm">
          {loading ? (
            <div className="h-40 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-4 border-[var(--soft-gold)] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[var(--text-muted)] font-medium">Extracting pulse data...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.length === 0 ? (
                <div className="text-center py-20 bg-white/[0.01] rounded-3xl border border-dashed border-white/10">
                  <AlertCircle className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4 opacity-20" />
                  <p className="text-[var(--text-muted)] font-medium italic">No detailed records found for this session</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {logs.map((log) => (
                    <div 
                      key={log.id} 
                      className="group flex items-center justify-between p-5 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 rounded-2xl transition-all duration-200"
                    >
                      <div className="flex items-center gap-5">
                        <div className={`p-3 rounded-xl ${
                          log.status === "success" 
                          ? "bg-optimal-green/10 text-optimal-green border border-optimal-green/20" 
                          : "bg-alert-red/10 text-alert-red border border-alert-red/20"
                        }`}>
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
                              <span>{log.location || "Unknown"}</span>
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
                            <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-0.5">Live Rate</p>
                          </div>
                        )}
                        <div className="hidden sm:block">
                           <span className={`text-[10px] font-black uppercase tracking-[0.15em] px-3 py-1 rounded-lg ${
                            log.status === "success" 
                            ? "text-optimal-green bg-optimal-green/5 border border-optimal-green/10" 
                            : "text-alert-red bg-alert-red/5 border border-alert-red/10"
                          }`}>
                            {log.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-6 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
           <p className="text-[10px] text-[var(--text-muted)] font-medium">
             Intelligence data verified via SerpApi • All rates inclusive of standard taxes
           </p>
           <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span className="text-[10px] text-white font-bold uppercase tracking-wider">
                Generated {new Date().toLocaleTimeString()}
              </span>
           </div>
        </div>
      </div>
    </div>
  );
}
