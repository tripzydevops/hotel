"use client";

import React, { useState, useEffect, useRef } from "react";
import { Terminal, Zap, Activity, Clock } from "lucide-react";
import { api } from "@/lib/api";

interface FeedItem {
  id: string;
  hotel_name: string;
  action_type: string;
  status: string;
  created_at: string;
  price?: number;
  currency?: string;
}

const NeuralFeed = () => {
  const [logs, setLogs] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Ref to track visibility for performance (Zero-Lag)
  const feedRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  // Poll for new data
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const fetchLogs = async () => {
      // Only fetch if tab is visible and component is in view
      if (!isVisible || document.hidden) return;

      try {
        const data = await api.getAdminFeed(50);
        if (data && Array.isArray(data)) {
          // Simple diff check could happen here, but React handles diffing well
          setLogs(data);
          setLastUpdate(new Date());
        }
      } catch (err) {
        console.error("Feed poll error", err);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchLogs();

    // Poll every 5s
    interval = setInterval(fetchLogs, 5000);

    return () => clearInterval(interval);
  }, [isVisible]);

  // Visibility Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 },
    );

    if (feedRef.current) observer.observe(feedRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={feedRef}
      className="glass-card border border-[var(--soft-gold)]/20 overflow-hidden flex flex-col h-[400px]"
    >
      {/* Header */}
      <div className="p-4 bg-black/40 border-b border-white/5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[var(--soft-gold)]/10 rounded-lg">
            <Terminal className="w-5 h-5 text-[var(--soft-gold)]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              AGENT NEURAL FEED
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--optimal-green)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--optimal-green)]"></span>
              </span>
            </h3>
            <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-wider">
              LIVE CONNECTION • {logs.length} EVENTS BUFFERED
            </p>
          </div>
        </div>
        <div className="text-[10px] text-[var(--text-muted)] font-mono flex items-center gap-2">
          <Activity className="w-3 h-3 text-[var(--soft-gold)] animate-pulse" />
          POLLING (5s)
        </div>
      </div>

      {/* Terminal Output */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-3 bg-black/20 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {loading && logs.length === 0 ? (
          <div className="text-[var(--text-muted)] animate-pulse">
            Initializing neural link...
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="flex gap-3 group hover:bg-white/5 p-1 rounded transition-colors"
            >
              <div className="text-[var(--text-muted)] w-16 shrink-0 opacity-50">
                {new Date(log.created_at).toLocaleTimeString([], {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </div>
              <div className="flex-1 break-all">
                <span
                  className={`font-bold mr-2 uppercase tracking-tight
                            ${
                              log.status === "success"
                                ? "text-[var(--optimal-green)]"
                                : log.status === "error"
                                  ? "text-red-400"
                                  : "text-[var(--soft-gold)]"
                            }`}
                >
                  [{log.action_type || "SYSTEM"}]
                </span>
                <span className="text-white/80">
                  {log.hotel_name || "System Process"}
                </span>
                {log.price && (
                  <span className="text-[var(--soft-gold)] ml-2">
                    found {log.price} {log.currency}
                  </span>
                )}
                <span
                  className={`ml-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity uppercase border px-1 rounded
                            ${log.status === "success" ? "border-[var(--optimal-green)]/30 text-[var(--optimal-green)]" : "border-red-500/30 text-red-400"}`}
                >
                  {log.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Status */}
      <div className="px-4 py-2 bg-black/40 border-t border-white/5 text-[10px] text-[var(--text-muted)] font-mono flex justify-between">
        <span>
          MEM:{" "}
          {Math.round(process.memoryUsage?.()?.heapUsed / 1024 / 1024 || 0)}MB
          (Simulated)
        </span>
        <span>LAST SYNC: {lastUpdate.toLocaleTimeString()}</span>
      </div>
    </div>
  );
};

export default NeuralFeed;
