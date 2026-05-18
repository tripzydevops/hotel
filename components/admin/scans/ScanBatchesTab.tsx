"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Zap, Cpu } from "lucide-react";
import { useToast } from "@/components/ui/ToastContext";

const ScanBatchesTab = () => {
  const { toast } = useToast();
  const router = useRouter();
  const [batches, setBatches] = useState<any[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [batchDetails, setBatchDetails] = useState<any>(null);
  const [batchDetailsLoading, setBatchDetailsLoading] = useState(false);

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

  const fetchBatchDetails = useCallback(async (id: string) => {
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
  }, [toast]);

  useEffect(() => { loadBatches(); }, [loadBatches]);

  useEffect(() => {
    if (selectedBatchId) fetchBatchDetails(selectedBatchId);
    else setBatchDetails(null);
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

  return (
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
            <p className="text-xs opacity-50 mt-1">Batches appear here while the Stitch strategy is executing.</p>
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
                  <tr key={batch.id} className={`hover:bg-white/[0.04] cursor-pointer transition-all group ${selectedBatchId === batch.id ? "bg-white/[0.06] border-l-2 border-l-cyan-500" : ""}`} onClick={() => setSelectedBatchId(batch.id)}>
                    <td className="p-5 font-mono text-cyan-400 font-bold">{batch.id.slice(0, 8)}...</td>
                    <td className="p-5 text-[var(--text-muted)] text-xs">{formatDistanceToNow(new Date(batch.created_at), { addSuffix: true })}</td>
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden w-24">
                          <div className="h-full bg-cyan-500 transition-all duration-500" style={{ width: `${(batch.completed_count / batch.total_count) * 100}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-[var(--overlay-text)]">{batch.completed_count} / {batch.total_count}</span>
                      </div>
                    </td>
                    <td className="p-5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${batch.status === "completed" ? "bg-[var(--optimal-green)]/10 text-[var(--optimal-green)] border border-[var(--optimal-green)]/20" : batch.status === "running" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
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
            <button onClick={() => setSelectedBatchId(null)} className="text-[var(--text-muted)] hover:text-[var(--overlay-text)] font-bold">✕ Close</button>
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
                  <tr><th className="p-3">Resource</th><th className="p-3">Status</th><th className="p-3">Last Error</th><th className="p-3 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {batchDetails.tasks?.map((task: any) => (
                    <tr key={task.id} className="hover:bg-white/5">
                      <td className="p-3 text-[var(--overlay-text)] font-medium">{task.metadata?.hotel_name || task.id.slice(0, 8)}</td>
                      <td className="p-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold w-fit ${task.status === "completed" ? "bg-green-500/20 text-green-400" : task.status === "failed" ? "bg-red-500/20 text-red-400" : "bg-cyan-500/20 text-cyan-400"}`}>
                          {task.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 text-red-400/70 max-w-[200px] truncate">{task.last_error || "—"}</td>
                      <td className="p-3 text-right">
                        {(task.status === "failed" || task.status === "pending") && (
                          <button onClick={() => handleRescanTask(task.id)} className="px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/20 transition-all font-bold text-[10px] uppercase">Rescan</button>
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
  );
};

export default ScanBatchesTab;
