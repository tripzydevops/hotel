"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  Clock,
  Loader2,
  Info,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/components/ui/ToastContext";

const ScanQueueTab = () => {
  const { toast } = useToast();
  const router = useRouter();
  const [queue, setQueue] = useState<any[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);

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

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleTriggerNow = async (userId: string) => {
    toast.success("Triggering scan...");
    try {
      await api.checkScheduledScan(true);
      toast.success("Scan triggered! Check history.");
      await loadQueue();
      router.refresh();
    } catch (err: any) {
      toast.error("Failed to trigger: " + err.message);
    }
  };

  return (
    <>
      {/* Quick Actions */}
      <div className="flex items-center gap-4 animate-in slide-in-from-left duration-500">
        {queue.some(item => item.status === "overdue") && (
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

        {queue.some(item => item.status === "overdue") && (
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest bg-white/5 px-4 py-2 rounded-lg border border-[var(--overlay-border)]">
            <Info className="w-3.5 h-3.5 text-[var(--soft-gold)]" />
            System has {queue.filter(i => i.status === 'overdue').length} overdue tasks
          </div>
        )}
      </div>

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
    </>
  );
};

export default ScanQueueTab;
