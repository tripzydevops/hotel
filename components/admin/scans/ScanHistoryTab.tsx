"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { AdminScan } from "@/types";
import { Loader2, AlertCircle, Activity, Cpu, Database, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastContext";
import { normalizeVendor } from "@/lib/utils";

const ScanHistoryTab = () => {
  const { toast } = useToast();
  const router = useRouter();
  const [scans, setScans] = useState<AdminScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [scanDetails, setScanDetails] = useState<any>(null);
  const [scanDetailsLoading, setScanDetailsLoading] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  const loadScans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAdminScans();
      setScans(data);
    } catch (err) {
      console.error("Failed to load scans:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchScanDetails = useCallback(async (id: string) => {
    setScanDetailsLoading(true);
    try {
      const data = await api.getAdminScanDetails(id);
      setScanDetails(data);
    } catch (err: any) {
      toast.error("Error: " + err.message);
      setSelectedScanId(null);
    } finally {
      setScanDetailsLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadScans(); }, [loadScans]);

  useEffect(() => {
    if (selectedScanId) fetchScanDetails(selectedScanId);
    else setScanDetails(null);
  }, [selectedScanId, fetchScanDetails]);

  const handleCleanup = async () => {
    if (!confirm("Are you sure you want to remove all failed and empty scan sessions from the last 7 days?")) return;
    setIsCleaning(true);
    toast.success("Cleaning up empty scans...");
    try {
      const res = await api.cleanupEmptyScans();
      toast.success(res.message || "Cleanup complete!");
      await loadScans();
      router.refresh();
    } catch (err: any) {
      toast.error("Cleanup failed: " + err.message);
    } finally {
      setIsCleaning(false);
    }
  };

  if (loading && scans.length === 0) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--soft-gold)] mx-auto" />
      </div>
    );
  }

  return (
    <>
      {/* Cleanup Action */}
      <div className="flex items-center gap-4 animate-in slide-in-from-left duration-500">
        <button
          onClick={handleCleanup}
          disabled={isCleaning}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCleaning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          {isCleaning ? "Cleaning..." : "Cleanup Empty Scans"}
        </button>
      </div>

      {/* Scan Table */}
      <div className="glass-card border border-[var(--overlay-border)] overflow-hidden shadow-2xl transition-all duration-500 hover:border-[var(--soft-gold)]/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-white/[0.02] text-[var(--text-muted)] font-black text-[10px] uppercase tracking-[0.2em] border-b border-[var(--overlay-border)]">
              <tr>
                <th className="p-5">Scan Date</th>
                <th className="p-5">User</th>
                <th className="p-5">Scan Type</th>
                <th className="p-5">Status</th>
                <th className="p-5 text-right">Hotel Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {scans.map((scan) => (
                <tr
                  key={scan.id}
                  className={`hover:bg-white/[0.04] cursor-pointer transition-all group ${selectedScanId === scan.id ? "bg-white/[0.06] border-l-2 border-l-[var(--soft-gold)]" : ""}`}
                  onClick={() => setSelectedScanId(scan.id)}
                >
                  <td className="p-5 text-[var(--text-muted)] tabular-nums group-hover:text-[var(--overlay-text)] transition-colors">
                    {formatDistanceToNow(new Date(scan.created_at), { addSuffix: true })}
                  </td>
                  <td className="p-5 text-[var(--overlay-text)] font-bold group-hover:text-[var(--soft-gold)] transition-colors">{scan.user_name}</td>
                  <td className="p-5">
                    <span className="bg-white/5 border border-[var(--overlay-border)] px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-[var(--overlay-text)] group-hover:border-[var(--soft-gold)]/30 transition-colors">
                      {scan.session_type}
                    </span>
                  </td>
                  <td className="p-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${scan.status === "completed" ? "bg-[var(--optimal-green)]/10 text-[var(--optimal-green)] border border-[var(--optimal-green)]/20" : scan.status === "running" ? "bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] border border-[var(--soft-gold)]/20 animate-pulse" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                      {scan.status}
                    </span>
                  </td>
                  <td className="p-5 text-right text-[var(--overlay-text)] font-black text-lg group-hover:scale-110 transition-transform tabular-nums">{scan.hotels_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scan Detail Overlay */}
      {selectedScanId && (
        <ScanDetailOverlay
          selectedScanId={selectedScanId}
          scanDetails={scanDetails}
          scanDetailsLoading={scanDetailsLoading}
          scans={scans}
          onClose={() => setSelectedScanId(null)}
          router={router}
        />
      )}
    </>
  );
};

// --- Sub-component for the scan detail overlay ---
interface ScanDetailOverlayProps {
  selectedScanId: string;
  scanDetails: any;
  scanDetailsLoading: boolean;
  scans: AdminScan[];
  onClose: () => void;
  router: ReturnType<typeof useRouter>;
}

const ScanDetailOverlay: React.FC<ScanDetailOverlayProps> = ({
  selectedScanId, scanDetails, scanDetailsLoading, scans, onClose, router,
}) => {
  const { toast } = useToast();

  return (
    <div className="glass-card p-6 border border-[var(--soft-gold)]/30 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-[var(--overlay-text)]">Scan Detail: {selectedScanId.slice(0, 8)}...</h3>
        <div className="flex items-center gap-3">
          {scans.find((s) => s.id === selectedScanId)?.has_payload && (
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  try {
                    toast.success("Preparing CSV export...");
                    await api.exportAdminScanCsv(selectedScanId);
                  } catch (err: any) {
                    toast.error("Export failed: " + err.message);
                  }
                }}
                className="flex items-center gap-2 bg-[var(--deep-ocean)] hover:bg-[var(--deep-ocean)]/80 text-[var(--soft-gold)] text-[10px] font-black px-4 py-2 rounded-lg transition-all border border-[var(--soft-gold)]/30 hover:scale-105 active:scale-95 uppercase tracking-widest shadow-lg shadow-[var(--soft-gold)]/5"
              >
                <Database className="w-3.5 h-3.5" /> Export Data Vault
              </button>
              <button
                onClick={() => router.push(`/admin/scans/${selectedScanId}/results`)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-4 py-2 rounded-lg transition-all shadow-lg shadow-blue-600/20 uppercase tracking-widest hover:scale-105 active:scale-95"
              >
                <Activity className="w-3.5 h-3.5" /> View Extraction Results
              </button>
            </div>
          )}
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--overlay-text)] font-bold transition-colors">✕ Close</button>
        </div>
      </div>

      {scanDetailsLoading ? (
        <div className="py-12 text-center text-[var(--soft-gold)]">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
          <p className="mt-2 text-sm opacity-70">Fetching results...</p>
        </div>
      ) : scanDetails ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-black/20 rounded-lg">
              <p className="text-[10px] uppercase text-[var(--text-muted)] mb-1">Status</p>
              <p className="font-bold text-[var(--overlay-text)] capitalize">{scanDetails.session?.status}</p>
            </div>
            <div className="p-4 bg-black/20 rounded-lg">
              <p className="text-[10px] uppercase text-[var(--text-muted)] mb-1">Date</p>
              <p className="font-bold text-[var(--overlay-text)]">{scanDetails.session?.check_in_date || "N/A"}</p>
            </div>
            <div className="p-4 bg-black/20 rounded-lg">
              <p className="text-[10px] uppercase text-[var(--text-muted)] mb-1">Adults</p>
              <p className="font-bold text-[var(--overlay-text)]">{scanDetails.session?.adults || 2}</p>
            </div>
            <div className="p-4 bg-black/20 rounded-lg">
              <p className="text-[10px] uppercase text-[var(--text-muted)] mb-1">Currency</p>
              <p className="font-bold text-[var(--overlay-text)]">{scanDetails.session?.currency || "TRY"}</p>
            </div>
          </div>

          {/* Provider Task Pipeline */}
          {scanDetails.tasks?.length > 0 && (
            <div className="p-4 bg-[var(--soft-gold)]/5 border border-[var(--soft-gold)]/20 rounded-lg">
              <h4 className="text-xs font-bold text-[var(--soft-gold)] uppercase tracking-wider mb-3 flex items-center gap-2">
                <Cpu className="w-3 h-3" /> Provider Task Pipeline
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex flex-col">
                  <span className="text-[9px] text-[var(--text-muted)] uppercase">Total Targets</span>
                  <span className="text-sm font-bold text-[var(--overlay-text)]">{scanDetails.tasks.length}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-[var(--text-muted)] uppercase">Validated</span>
                  <span className="text-sm font-bold text-green-400">{scanDetails.tasks.filter((t: any) => t.status === 'success').length}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-[var(--text-muted)] uppercase">Failed/Error</span>
                  <span className="text-sm font-bold text-red-400">{scanDetails.tasks.filter((t: any) => ['failed', 'provider_error', 'task_error', 'invalid_response'].includes(t.status)).length}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-[var(--text-muted)] uppercase">Active/Pending</span>
                  <span className="text-sm font-bold text-blue-400">{scanDetails.tasks.filter((t: any) => ['pending', 'processing'].includes(t.status)).length}</span>
                </div>
              </div>
              {scanDetails.tasks.some((t: any) => ['identity_mismatch', 'provider_error', 'task_error'].includes(t.status)) && (
                <div className="mt-3 pt-3 border-t border-[var(--soft-gold)]/10">
                  <p className="text-[9px] text-orange-400 font-bold uppercase mb-1">Critical Issues Detected:</p>
                  <div className="flex flex-wrap gap-1">
                    {scanDetails.tasks.filter((t: any) => ['identity_mismatch', 'provider_error', 'task_error'].includes(t.status)).slice(0, 5).map((t: any, idx: number) => (
                      <span key={idx} className="text-[8px] bg-red-500/10 text-red-300 px-1.5 py-0.5 rounded border border-red-500/20">{t.hotels?.name || 'Unknown'}: {t.status}</span>
                    ))}
                    {scanDetails.tasks.filter((t: any) => ['identity_mismatch', 'provider_error', 'task_error'].includes(t.status)).length > 5 && (
                      <span className="text-[8px] text-[var(--text-muted)]">...and more</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results Table */}
          <div className="overflow-hidden rounded-lg border border-[var(--overlay-border)]">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 text-[var(--text-muted)]">
                <tr>
                  <th className="p-3">Hotel</th>
                  <th className="p-3">Result</th>
                  <th className="p-3">Price</th>
                  <th className="p-3">Vendor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {scanDetails.logs?.map((log: any) => {
                  const s = log.status?.toLowerCase();
                  const statusClass = s === "success" ? "bg-green-500/20 text-green-400" : s === "identity_mismatch" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : (s === "pending" || s === "processing") ? "bg-blue-500/20 text-blue-400" : "bg-red-500/20 text-red-400";
                  return (
                    <tr key={log.id} className="hover:bg-white/5">
                      <td className="p-3 text-[var(--overlay-text)] font-medium">{log.hotel_name || "Unknown Property"}</td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold w-fit ${statusClass}`}>{log.status?.toUpperCase() || "UNKNOWN"}</span>
                          {log.metadata?.is_shallow && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20 w-fit">
                              <AlertCircle className="w-3 h-3" /> SHALLOW
                            </span>
                          )}
                          {log.status_detail && <span className="text-[9px] text-[var(--text-muted)] italic truncate max-w-[150px]">{log.status_detail}</span>}
                        </div>
                      </td>
                      <td className="p-3 text-[var(--overlay-text)]">{log.price ? `${log.price.toLocaleString()} ${log.currency}` : "—"}</td>
                      <td className="p-3 text-[var(--text-muted)]">{normalizeVendor(log.vendor) || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Reasoning Timeline */}
          {scanDetails.session?.reasoning_trace && scanDetails.session.reasoning_trace.length > 0 && (
            <ReasoningTimeline traces={Array.isArray(scanDetails.session.reasoning_trace) ? scanDetails.session.reasoning_trace : [scanDetails.session.reasoning_trace]} />
          )}

          {/* Market Parity Offers */}
          {scanDetails.logs?.some((log: any) => log.parity_offers?.length > 0) && (
            <ParityOffers logs={scanDetails.logs.filter((log: any) => log.parity_offers?.length > 0)} />
          )}
        </div>
      ) : (
        <div className="p-8 text-center text-[var(--text-muted)]">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No details found for this scan.</p>
        </div>
      )}
    </div>
  );
};

// --- Reasoning Timeline sub-component ---
const ReasoningTimeline: React.FC<{ traces: any[] }> = ({ traces }) => (
  <div className="mt-6">
    <h4 className="text-sm font-bold text-[var(--overlay-text)] mb-3 flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-[var(--soft-gold)] animate-pulse" />
      Scan Activity Timeline
    </h4>
    <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
      {traces.map((trace: any, i: number) => {
        if (typeof trace === "string") {
          return (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-white/5 border-[var(--overlay-border)]">
              <span className="text-sm">📝</span>
              <span className="text-xs text-[var(--overlay-text)]/80 font-mono leading-relaxed">{trace}</span>
            </div>
          );
        }
        const { step, level, message, timestamp, metadata } = trace;
        let bgClass = "bg-white/5", borderClass = "border-[var(--overlay-border)]", iconEmoji = "📝", textColor = "text-[var(--overlay-text)]/80";
        switch (level) {
          case "info":
            if (step === "Scraping" || step === "API Call") { bgClass = "bg-blue-500/10"; borderClass = "border-blue-500/30"; iconEmoji = "🌐"; textColor = "text-blue-200"; }
            else if (step === "Date Generation") { bgClass = "bg-purple-500/10"; borderClass = "border-purple-500/30"; iconEmoji = "📅"; textColor = "text-purple-200"; }
            break;
          case "success": bgClass = "bg-[var(--optimal-green)]/10"; borderClass = "border-[var(--optimal-green)]/30"; iconEmoji = "✅"; textColor = "text-[var(--optimal-green)]"; break;
          case "warn": bgClass = "bg-orange-500/10"; borderClass = "border-orange-500/30"; iconEmoji = "⚠️"; textColor = "text-orange-200"; break;
          case "error": bgClass = "bg-[var(--alert-red)]/10"; borderClass = "border-[var(--alert-red)]/30"; iconEmoji = "❌"; textColor = "text-[var(--alert-red)]"; break;
        }
        return (
          <div key={i} className={`flex flex-col gap-1 p-3 rounded-lg border ${bgClass} ${borderClass} transition-all hover:scale-[1.01] hover:shadow-lg`}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--overlay-text)]/60">{iconEmoji} {step}</span>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">{timestamp ? new Date(timestamp * 1000).toLocaleTimeString() : ""}</span>
            </div>
            <span className={`text-sm font-mono leading-relaxed ${textColor}`}>{message}</span>
            {metadata && Object.keys(metadata).length > 0 && (
              <div className="mt-2 text-[10px] font-mono bg-black/20 p-2 rounded text-[var(--text-muted)] w-full overflow-x-auto">{JSON.stringify(metadata)}</div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

// --- Parity Offers sub-component ---
const ParityOffers: React.FC<{ logs: any[] }> = ({ logs }) => (
  <div className="mt-6">
    <h4 className="text-sm font-bold text-[var(--overlay-text)] mb-3 flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-cyan-400" /> Market Parity (OTA Offers)
    </h4>
    <div className="space-y-4">
      {logs.map((log: any) => (
        <div key={log.id} className="bg-black/20 rounded-lg p-4">
          <p className="text-xs font-medium text-[var(--overlay-text)] mb-2">{log.hotel_name}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {log.parity_offers.map((offer: any, idx: number) => {
              const isLowest = log.parity_offers.every((o: any) => offer.price <= o.price);
              const isHighest = log.parity_offers.every((o: any) => offer.price >= o.price);
              return (
                <div key={idx} className={`p-2 rounded border ${isLowest ? "border-green-500/50 bg-green-500/10" : isHighest ? "border-red-500/50 bg-red-500/10" : "border-[var(--overlay-border)] bg-white/5"}`}>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase">{normalizeVendor(offer.vendor || offer.source) || "Unknown"}</p>
                  <p className={`text-sm font-bold ${isLowest ? "text-green-400" : isHighest ? "text-red-400" : "text-[var(--overlay-text)]"}`}>
                    {offer.price?.toLocaleString()} {offer.currency || log.currency}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default ScanHistoryTab;
