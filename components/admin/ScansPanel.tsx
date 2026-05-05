"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { AdminScan } from "@/types";
import {
  Clock,
  Loader2,
  AlertCircle,
  Search,
  Activity,
  History,
  List,
  Calendar,
  Info,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Plus,
  Zap,
  Cpu,
  Database,
} from "lucide-react";
import { useToast } from "@/components/ui/ToastContext";

const ScansPanel = () => {
  const { toast } = useToast();
  // router is used to force a server-side refresh of the page data, 
  // bypassing any client-side cache and ensuring UI consistency after mutations.
  const router = useRouter();
  /* New Queue State */
  const [queue, setQueue] = useState<any[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"history" | "queue" | "batches">("history");

  /* History State */
  const [scans, setScans] = useState<AdminScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [scanDetails, setScanDetails] = useState<any>(null);
  const [scanDetailsLoading, setScanDetailsLoading] = useState(false);
  
  /* Batch State */
  const [batches, setBatches] = useState<any[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [batchDetails, setBatchDetails] = useState<any>(null);
  const [batchDetailsLoading, setBatchDetailsLoading] = useState(false);
  // isCleaning tracks the progress of the automated scan history cleanup operation.
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

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const data = await api.getSchedulerQueue();
      setQueue(data);
    } catch (err) {
      console.error("Failed to load queue:", err);
    } finally {
      setQueueLoading(false);
    }
  }, []);

  const loadBatches = useCallback(async () => {
    setBatchLoading(true);
    try {
      const data = await api.getAdminBatches();
      setBatches(data);
    } catch (err) {
      console.error("Failed to load batches:", err);
    } finally {
      setBatchLoading(false);
    }
  }, []);

  /**
   * handleCleanup manages the removal of empty or failed scan sessions from the database.
   * It includes a confirmation check, visual loading states, and explicit data re-fetching
   * to ensure the UI reflects the changes immediately, even if the WebSocket is flaky.
   */
  const handleCleanup = async () => {
    if (!confirm("Are you sure you want to remove all failed and empty scan sessions from the last 7 days?")) return;
    
    // Set loading state to provide visual feedback and prevent redundant clicks.
    setIsCleaning(true);
    toast.success("Cleaning up empty scans...");
    try {
      const res = await api.cleanupEmptyScans();
      toast.success(res.message || "Cleanup complete!");
      
      // EXPLANATION: Explicit Re-fetch & Refresh
      // 1. loadScans() manually triggers a fresh API call for the local 'scans' state.
      // 2. router.refresh() signals Next.js to invalidate its route cache and fetch fresh data.
      // This combination guarantees that the dashboard stays synchronized with the server state.
      await loadScans();
      router.refresh();
    } catch (err: any) {
      toast.error("Cleanup failed: " + err.message);
    } finally {
      setIsCleaning(false);
    }
  };

  const handleTriggerNow = async (userId: string) => {
    toast.success("Triggering scan...");
    try {
      await api.checkScheduledScan(true);
      toast.success("Scan triggered! Check history.");
      // Refresh queue
      await loadQueue();
      router.refresh();
    } catch (err: any) {
      toast.error("Failed to trigger: " + err.message);
    }
  };

  const fetchScanDetails = useCallback(
    async (id: string) => {
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
    },
    [toast],
  );

  const fetchBatchDetails = useCallback(
    async (id: string) => {
      setBatchDetailsLoading(true);
      try {
        const data = await api.getAdminBatchDetails(id);
        setBatchDetails(data);
      } catch (err: any) {
        toast.error("Error: " + err.message);
        setSelectedBatchId(null);
      } finally {
        setBatchDetailsLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (activeTab === "history") loadScans();
    if (activeTab === "queue") loadQueue();
    if (activeTab === "batches") loadBatches();
  }, [activeTab, loadScans, loadQueue, loadBatches]);

  useEffect(() => {
    if (selectedBatchId) {
      fetchBatchDetails(selectedBatchId);
    } else {
      setBatchDetails(null);
    }
  }, [selectedBatchId, fetchBatchDetails]);

  const handleRescanTask = async (taskId: string) => {
    try {
      await api.rescanBatchTask(taskId);
      toast.success("Rescan triggered for task!");
      if (selectedBatchId) await fetchBatchDetails(selectedBatchId);
      router.refresh();
    } catch (err: any) {
      toast.error("Rescan failed: " + err.message);
    }
  };

  /* Loading State */
  if (loading && scans.length === 0 && activeTab === "history") {
    return (
      <div className="p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--soft-gold)] mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Tab Controls - Sub-dock */}
      <div className="flex bg-[var(--deep-ocean-card)]/30 p-1.5 rounded-xl border border-[var(--overlay-border)] w-fit shadow-lg">
        <button
          onClick={() => setActiveTab("history")}
          className={`px-6 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === "history"
            ? "bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] border border-[var(--soft-gold)]/20 shadow-inner"
            : "text-[var(--text-muted)] hover:text-[var(--overlay-text)]"
            }`}
        >
          Scan History
        </button>
        <button
          onClick={() => setActiveTab("queue")}
          className={`px-6 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === "queue"
            ? "bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] border border-[var(--soft-gold)]/20 shadow-inner"
            : "text-[var(--text-muted)] hover:text-[var(--overlay-text)]"
            }`}
        >
          Upcoming Queue
        </button>
        <button
          onClick={() => setActiveTab("batches")}
          className={`px-6 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === "batches"
            ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-inner"
            : "text-[var(--text-muted)] hover:text-[var(--overlay-text)]"
            }`}
        >
          Live Batches
        </button>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-4 animate-in slide-in-from-left duration-500">
        {activeTab === "queue" && queue.some(item => item.status === "overdue") && (
          <button
            onClick={async () => {
              toast.success("Initiating global trigger...");
              try {
                await api.triggerAllOverdue();
                toast.success("All overdue scans triggered!");
                await loadQueue();
                router.refresh();
              } catch (err: any) {
                toast.error("Failed: " + err.message);
              }
            }}
            className="group relative flex items-center gap-3 px-6 py-3 bg-[var(--soft-gold)] text-[var(--deep-ocean)] rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] transition-all hover:-translate-y-0.5"
          >
            <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700" />
            Trigger All Overdue
          </button>
        )}

        {activeTab === "history" && (
          /* Cleanup Action: Integrated with isCleaning state for robust visual feedback and debouncing */
          <button
            onClick={handleCleanup}
            disabled={isCleaning}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCleaning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            {isCleaning ? "Cleaning..." : "Cleanup Empty Scans"}
          </button>
        )}

        {activeTab === "queue" && queue.some(item => item.status === "overdue") && (
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest bg-white/5 px-4 py-2 rounded-lg border border-[var(--overlay-border)]">
            <Info className="w-3.5 h-3.5 text-[var(--soft-gold)]" />
            System has {queue.filter(i => i.status === 'overdue').length} overdue tasks
          </div>
        )}
      </div>

      {activeTab === "queue" && (
        <div className="glass-card border border-[var(--overlay-border)] overflow-hidden shadow-2xl transition-all duration-500 hover:border-[var(--soft-gold)]/10">
          {queueLoading ? (
            <div className="p-20 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-[var(--soft-gold)] mx-auto opacity-50" />
            </div>
          ) : queue.length === 0 ? (
            <div className="p-16 text-center text-[var(--text-muted)] group">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Clock className="w-8 h-8 opacity-20" />
              </div>
              <p className="font-medium">No scheduled scans found.</p>
              <p className="text-xs opacity-50 mt-1">
                Configure users to enable automated market snapshots.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-white/[0.02] text-[var(--text-muted)] font-black text-[10px] uppercase tracking-[0.2em] border-b border-[var(--overlay-border)]">
                  <tr>
                    <th className="p-5">User Profile</th>
                    <th className="p-5">Frequency</th>
                    <th className="p-5">System Priority</th>
                    <th className="p-5 text-right">Monitored Assets</th>
                    <th className="p-5 text-right">Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {queue.map((item, idx) => {
                    const isOverdue = item.status === "overdue";
                    return (
                      <tr
                        key={idx}
                        className="hover:bg-white/[0.02] transition-colors group"
                      >
                        <td className="p-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[var(--soft-gold)]/5 border border-[var(--soft-gold)]/10 flex items-center justify-center font-bold text-[var(--soft-gold)] group-hover:bg-[var(--soft-gold)]/10 transition-colors">
                              {item.user_name?.[0] || "U"}
                            </div>
                            <span className="font-bold text-[var(--overlay-text)] tracking-tight">
                              {item.user_name}
                            </span>
                          </div>
                        </td>
                        <td className="p-5">
                          <span className="text-[var(--soft-gold)] font-black text-[10px] bg-[var(--soft-gold)]/5 px-2 py-1 rounded border border-[var(--soft-gold)]/10 flex items-center gap-1.5 w-fit">
                            <RefreshCw className="w-3 h-3 animate-[spin_4s_linear_infinite]" />
                            4H Pulse
                          </span>
                        </td>
                        <td className="p-5">
                          <span
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${isOverdue
                              ? "bg-red-500/10 text-red-400 border border-red-500/20"
                              : "bg-[var(--optimal-green)]/10 text-[var(--optimal-green)] border border-[var(--optimal-green)]/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                              }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="p-5 text-right text-[var(--overlay-text)]">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="font-black text-lg tabular-nums group-hover:text-[var(--soft-gold)] transition-colors">
                              {item.hotel_count}
                            </span>
                            <span className="text-[10px] font-medium text-[var(--text-muted)] max-w-[180px] truncate uppercase tracking-tighter">
                              {item.hotels.join(", ")}
                            </span>
                          </div>
                        </td>
                        <td className="p-5 text-right">
                          <button
                            onClick={() => handleTriggerNow(item.user_id)}
                            className="bg-white/5 hover:bg-[var(--soft-gold)] hover:text-[var(--deep-ocean)] text-[var(--overlay-text)] text-[10px] font-black px-4 py-2 rounded-lg transition-all border border-[var(--overlay-border)] hover:scale-105 active:scale-95 uppercase tracking-widest"
                          >
                            Trigger Now
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <>
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
                        {formatDistanceToNow(new Date(scan.created_at), {
                          addSuffix: true,
                        })}
                      </td>
                      <td className="p-5 text-[var(--overlay-text)] font-bold group-hover:text-[var(--soft-gold)] transition-colors">
                        {scan.user_name}
                      </td>
                      <td className="p-5">
                        <span className="bg-white/5 border border-[var(--overlay-border)] px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-[var(--overlay-text)] group-hover:border-[var(--soft-gold)]/30 transition-colors">
                          {scan.session_type}
                        </span>
                      </td>
                      <td className="p-5">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${scan.status === "completed"
                            ? "bg-[var(--optimal-green)]/10 text-[var(--optimal-green)] border border-[var(--optimal-green)]/20"
                            : scan.status === "running"
                              ? "bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] border border-[var(--soft-gold)]/20 animate-pulse"
                              : "bg-red-500/10 text-red-400 border border-red-500/20"
                            }`}
                        >
                          {scan.status}
                        </span>
                      </td>
                      <td className="p-5 text-right text-[var(--overlay-text)] font-black text-lg group-hover:scale-110 transition-transform tabular-nums">
                        {scan.hotels_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selectedScanId && (
            <div className="glass-card p-6 border border-[var(--soft-gold)]/30 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-[var(--overlay-text)]">
                  Scan Detail: {selectedScanId.slice(0, 8)}...
                </h3>
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
                        <Database className="w-3.5 h-3.5" />
                        Export Data Vault
                      </button>

                      <button
                        onClick={() => router.push(`/admin/scans/${selectedScanId}/results`)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-4 py-2 rounded-lg transition-all shadow-lg shadow-blue-600/20 uppercase tracking-widest hover:scale-105 active:scale-95"
                      >
                        <Activity className="w-3.5 h-3.5" />
                        View Extraction Results
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => setSelectedScanId(null)}
                    className="text-[var(--text-muted)] hover:text-[var(--overlay-text)] font-bold transition-colors"
                  >
                    ✕ Close
                  </button>
                </div>
              </div>

              {scanDetailsLoading ? (
                <div className="py-12 text-center text-[var(--soft-gold)]">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                  <p className="mt-2 text-sm opacity-70">Fetching results...</p>
                </div>
              ) : scanDetails ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-black/20 rounded-lg">
                      <p className="text-[10px] uppercase text-[var(--text-muted)] mb-1">
                        Status
                      </p>
                      <p className="font-bold text-[var(--overlay-text)] capitalize">
                        {scanDetails.session?.status}
                      </p>
                    </div>
                    <div className="p-4 bg-black/20 rounded-lg">
                      <p className="text-[10px] uppercase text-[var(--text-muted)] mb-1">
                        Date
                      </p>
                      <p className="font-bold text-[var(--overlay-text)]">
                        {scanDetails.session?.check_in_date || "N/A"}
                      </p>
                    </div>
                    <div className="p-4 bg-black/20 rounded-lg">
                      <p className="text-[10px] uppercase text-[var(--text-muted)] mb-1">
                        Adults
                      </p>
                      <p className="font-bold text-[var(--overlay-text)]">
                        {scanDetails.session?.adults || 2}
                      </p>
                    </div>
                    <div className="p-4 bg-black/20 rounded-lg">
                      <p className="text-[10px] uppercase text-[var(--text-muted)] mb-1">
                        Currency
                      </p>
                      <p className="font-bold text-[var(--overlay-text)]">
                        {scanDetails.session?.currency || "TRY"}
                      </p>
                    </div>
                  </div>

                  {/* KAİZEN 2026: Provider Task Pipeline Overview */}
                  {scanDetails.tasks?.length > 0 && (
                    <div className="p-4 bg-[var(--soft-gold)]/5 border border-[var(--soft-gold)]/20 rounded-lg">
                      <h4 className="text-xs font-bold text-[var(--soft-gold)] uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Cpu className="w-3 h-3" />
                        Provider Task Pipeline
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-[var(--text-muted)] uppercase">Total Targets</span>
                          <span className="text-sm font-bold text-[var(--overlay-text)]">{scanDetails.tasks.length}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-[var(--text-muted)] uppercase">Validated</span>
                          <span className="text-sm font-bold text-green-400">
                            {scanDetails.tasks.filter((t: any) => t.status === 'success').length}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-[var(--text-muted)] uppercase">Failed/Error</span>
                          <span className="text-sm font-bold text-red-400">
                            {scanDetails.tasks.filter((t: any) => ['failed', 'provider_error', 'task_error', 'invalid_response'].includes(t.status)).length}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-[var(--text-muted)] uppercase">Active/Pending</span>
                          <span className="text-sm font-bold text-blue-400">
                            {scanDetails.tasks.filter((t: any) => ['pending', 'processing'].includes(t.status)).length}
                          </span>
                        </div>
                      </div>
                      
                      {/* Show failing hotels if any */}
                      {scanDetails.tasks.some((t: any) => ['identity_mismatch', 'provider_error', 'task_error'].includes(t.status)) && (
                        <div className="mt-3 pt-3 border-t border-[var(--soft-gold)]/10">
                          <p className="text-[9px] text-orange-400 font-bold uppercase mb-1">Critical Issues Detected:</p>
                          <div className="flex flex-wrap gap-1">
                            {scanDetails.tasks
                              .filter((t: any) => ['identity_mismatch', 'provider_error', 'task_error'].includes(t.status))
                              .slice(0, 5)
                              .map((t: any, idx: number) => (
                                <span key={idx} className="text-[8px] bg-red-500/10 text-red-300 px-1.5 py-0.5 rounded border border-red-500/20">
                                  {t.hotels?.name || 'Unknown'}: {t.status}
                                </span>
                              ))}
                            {scanDetails.tasks.filter((t: any) => ['identity_mismatch', 'provider_error', 'task_error'].includes(t.status)).length > 5 && (
                              <span className="text-[8px] text-[var(--text-muted)]">...and more</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

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
                          const statusClass = 
                            s === "success" ? "bg-green-500/20 text-green-400" :
                            s === "identity_mismatch" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" :
                            (s === "pending" || s === "processing") ? "bg-blue-500/20 text-blue-400" :
                            "bg-red-500/20 text-red-400";

                          return (
                            <tr key={log.id} className="hover:bg-white/5">
                              <td className="p-3 text-[var(--overlay-text)] font-medium">
                                {log.hotel_name || "Unknown Property"}
                              </td>
                              <td className="p-3">
                                <div className="flex flex-col gap-1">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold w-fit ${statusClass}`}>
                                    {log.status?.toUpperCase() || "UNKNOWN"}
                                  </span>
                                  {log.metadata?.is_shallow && (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20 w-fit">
                                      <AlertCircle className="w-3 h-3" />
                                      SHALLOW
                                    </span>
                                  )}
                                  {log.status_detail && (
                                    <span className="text-[9px] text-[var(--text-muted)] italic truncate max-w-[150px]">
                                      {log.status_detail}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-[var(--overlay-text)]">
                                {log.price
                                  ? `${log.price.toLocaleString()} ${log.currency}`
                                  : "—"}
                              </td>
                              <td className="p-3 text-[var(--text-muted)]">
                                {log.vendor || "—"}
                              </td>
                            </tr>
                          );
                        })}

                      </tbody>
                    </table>
                  </div>

                  {/* Reasoning Timeline */}
                  {scanDetails.session?.reasoning_trace &&
                    scanDetails.session.reasoning_trace.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-sm font-bold text-[var(--overlay-text)] mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[var(--soft-gold)] animate-pulse" />
                          Scan Activity Timeline
                        </h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                          {(Array.isArray(scanDetails.session.reasoning_trace) 
                            ? scanDetails.session.reasoning_trace 
                            : (scanDetails.session.reasoning_trace ? [scanDetails.session.reasoning_trace] : [])
                          ).map(

                            (trace: any, i: number) => {
                              // Handle Legacy String Traces
                              if (typeof trace === "string") {
                                const isNormalization =
                                  trace.includes("[Normalization]");
                                const isAlert = trace.includes("[Alert]");
                                const isError = trace.includes("[ERROR]");

                                const bgClass = "bg-white/5";
                                const borderClass = "border-[var(--overlay-border)]";
                                return (
                                  <div
                                    key={i}
                                    className={`flex items-start gap-3 p-3 rounded-lg border ${bgClass} ${borderClass}`}
                                  >
                                    <span className="text-sm">📝</span>
                                    <span className="text-xs text-[var(--overlay-text)]/80 font-mono leading-relaxed">
                                      {trace}
                                    </span>
                                  </div>
                                );
                              }

                              // Handle New Structured ReasoningLog
                              const {
                                step,
                                level,
                                message,
                                timestamp,
                                metadata,
                              } = trace;

                              let bgClass = "bg-white/5";
                              let borderClass = "border-[var(--overlay-border)]";
                              let iconEmoji = "📝";
                              let textColor = "text-[var(--overlay-text)]/80";

                              switch (level) {
                                case "info":
                                  if (
                                    step === "Scraping" ||
                                    step === "API Call"
                                  ) {
                                    bgClass = "bg-blue-500/10";
                                    borderClass = "border-blue-500/30";
                                    iconEmoji = "🌐";
                                    textColor = "text-blue-200";
                                  } else if (step === "Date Generation") {
                                    bgClass = "bg-purple-500/10";
                                    borderClass = "border-purple-500/30";
                                    iconEmoji = "📅";
                                    textColor = "text-purple-200";
                                  }
                                  break;
                                case "success":
                                  bgClass = "bg-[var(--optimal-green)]/10";
                                  borderClass =
                                    "border-[var(--optimal-green)]/30";
                                  iconEmoji = "✅";
                                  textColor = "text-[var(--optimal-green)]";
                                  break;
                                case "warn":
                                  bgClass = "bg-orange-500/10";
                                  borderClass = "border-orange-500/30";
                                  iconEmoji = "⚠️";
                                  textColor = "text-orange-200";
                                  break;
                                case "error":
                                  bgClass = "bg-[var(--alert-red)]/10";
                                  borderClass = "border-[var(--alert-red)]/30";
                                  iconEmoji = "❌";
                                  textColor = "text-[var(--alert-red)]";
                                  break;
                              }

                              return (
                                <div
                                  key={i}
                                  className={`flex flex-col gap-1 p-3 rounded-lg border ${bgClass} ${borderClass} transition-all hover:scale-[1.01] hover:shadow-lg`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--overlay-text)]/60">
                                      {iconEmoji} {step}
                                    </span>
                                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                                      {timestamp
                                        ? new Date(
                                          timestamp * 1000,
                                        ).toLocaleTimeString()
                                        : ""}
                                    </span>
                                  </div>
                                  <span
                                    className={`text-sm font-mono leading-relaxed ${textColor}`}
                                  >
                                    {message}
                                  </span>
                                  {metadata &&
                                    Object.keys(metadata).length > 0 && (
                                      <div className="mt-2 text-[10px] font-mono bg-black/20 p-2 rounded text-[var(--text-muted)] w-full overflow-x-auto">
                                        {JSON.stringify(metadata)}
                                      </div>
                                    )}
                                </div>
                              );
                            },
                          )}
                        </div>
                      </div>
                    )}

                  {/* Market Parity Offers */}
                  {scanDetails.logs?.some(
                    (log: any) => log.parity_offers?.length > 0,
                  ) && (
                      <div className="mt-6">
                        <h4 className="text-sm font-bold text-[var(--overlay-text)] mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-cyan-400" />
                          Market Parity (OTA Offers)
                        </h4>
                        <div className="space-y-4">
                          {scanDetails.logs
                            .filter((log: any) => log.parity_offers?.length > 0)
                            .map((log: any) => (
                              <div
                                key={log.id}
                                className="bg-black/20 rounded-lg p-4"
                              >
                                <p className="text-xs font-medium text-[var(--overlay-text)] mb-2">
                                  {log.hotel_name}
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  {log.parity_offers.map(
                                    (offer: any, idx: number) => {
                                      const isLowest = log.parity_offers.every(
                                        (o: any) => offer.price <= o.price,
                                      );
                                      const isHighest = log.parity_offers.every(
                                        (o: any) => offer.price >= o.price,
                                      );

                                      return (
                                        <div
                                          key={idx}
                                          className={`p-2 rounded border ${isLowest
                                            ? "border-green-500/50 bg-green-500/10"
                                            : isHighest
                                              ? "border-red-500/50 bg-red-500/10"
                                              : "border-[var(--overlay-border)] bg-white/5"
                                            }`}
                                        >
                                          <p className="text-[10px] text-[var(--text-muted)] uppercase">
                                            {offer.vendor ||
                                              offer.source ||
                                              "Unknown"}
                                          </p>
                                          <p
                                            className={`text-sm font-bold ${isLowest
                                              ? "text-green-400"
                                              : isHighest
                                                ? "text-red-400"
                                                : "text-[var(--overlay-text)]"
                                              }`}
                                          >
                                            {offer.price?.toLocaleString()}{" "}
                                            {offer.currency || log.currency}
                                          </p>
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                </div>
              ) : (
                <div className="p-8 text-center text-[var(--text-muted)]">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>No details found for this scan.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
      {activeTab === "batches" && (
        <>
          <div className="glass-card border border-[var(--overlay-border)] overflow-hidden shadow-2xl transition-all duration-500 hover:border-cyan-500/10">
            {batchLoading ? (
              <div className="p-20 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-cyan-400 mx-auto opacity-50" />
              </div>
            ) : batches.length === 0 ? (
              <div className="p-16 text-center text-[var(--text-muted)] group">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Zap className="w-8 h-8 opacity-20" />
                </div>
                <p className="font-medium">No live batches found.</p>
                <p className="text-xs opacity-50 mt-1">
                  Batches appear here while the Stitch strategy is executing.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-white/[0.02] text-[var(--text-muted)] font-black text-[10px] uppercase tracking-[0.2em] border-b border-[var(--overlay-border)]">
                    <tr>
                      <th className="p-5">Batch ID</th>
                      <th className="p-5">Started</th>
                      <th className="p-5">Progress</th>
                      <th className="p-5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {batches.map((batch) => (
                      <tr
                        key={batch.id}
                        className={`hover:bg-white/[0.04] cursor-pointer transition-all group ${selectedBatchId === batch.id ? "bg-white/[0.06] border-l-2 border-l-cyan-500" : ""}`}
                        onClick={() => setSelectedBatchId(batch.id)}
                      >
                        <td className="p-5 font-mono text-cyan-400 font-bold">
                          {batch.id.slice(0, 8)}...
                        </td>
                        <td className="p-5 text-[var(--text-muted)] text-xs">
                          {formatDistanceToNow(new Date(batch.created_at), { addSuffix: true })}
                        </td>
                        <td className="p-5">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden w-24">
                              <div
                                className="h-full bg-cyan-500 transition-all duration-500"
                                style={{ width: `${(batch.completed_count / batch.total_count) * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-[var(--overlay-text)]">
                              {batch.completed_count} / {batch.total_count}
                            </span>
                          </div>
                        </td>
                        <td className="p-5">
                          <span
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${batch.status === "completed"
                              ? "bg-[var(--optimal-green)]/10 text-[var(--optimal-green)] border border-[var(--optimal-green)]/20"
                              : batch.status === "running"
                                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse"
                                : "bg-red-500/10 text-red-400 border border-red-500/20"
                              }`}
                          >
                            {batch.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {selectedBatchId && (
            <div className="glass-card p-6 border border-cyan-500/30 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-[var(--overlay-text)] flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-cyan-400" />
                  Batch Tasks: {selectedBatchId.slice(0, 8)}...
                </h3>
                <button
                  onClick={() => setSelectedBatchId(null)}
                  className="text-[var(--text-muted)] hover:text-[var(--overlay-text)] font-bold"
                >
                  ✕ Close
                </button>
              </div>

              {batchDetailsLoading ? (
                <div className="py-12 text-center text-cyan-400">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                  <p className="mt-2 text-sm opacity-70">Fetching tasks...</p>
                </div>
              ) : batchDetails ? (
                <div className="overflow-hidden rounded-lg border border-[var(--overlay-border)]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 text-[var(--text-muted)]">
                      <tr>
                        <th className="p-3">Resource</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Last Error</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {batchDetails.tasks?.map((task: any) => (
                        <tr key={task.id} className="hover:bg-white/5">
                          <td className="p-3 text-[var(--overlay-text)] font-medium">
                            {task.metadata?.hotel_name || task.id.slice(0, 8)}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold w-fit ${task.status === "completed"
                                ? "bg-green-500/20 text-green-400"
                                : task.status === "failed"
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-cyan-500/20 text-cyan-400"
                                }`}
                            >
                              {task.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 text-red-400/70 max-w-[200px] truncate">
                            {task.last_error || "—"}
                          </td>
                          <td className="p-3 text-right">
                            {(task.status === "failed" || task.status === "pending") && (
                              <button
                                onClick={() => handleRescanTask(task.id)}
                                className="px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/20 transition-all font-bold text-[10px] uppercase"
                              >
                                Rescan
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ScansPanel;
