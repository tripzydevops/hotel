"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Terminal,
  Zap,
  Activity,
  Cpu,
  Shield,
  Globe,
  Loader2,
} from "lucide-react";
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
      className="glass-card border border-white/5 overflow-hidden flex flex-col h-[520px] shadow-2xl relative group"
    >
      {/* Dynamic Glow Effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />

      {/* Header */}
      <div className="p-5 bg-black/40 border-b border-white/5 flex justify-between items-center relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-[var(--soft-gold)]/30 transition-all duration-500">
            <Terminal className="w-5 h-5 text-[var(--soft-gold)]" />
          </div>
          <div>
            <h3 className="text-xs font-black text-white flex items-center gap-2 uppercase tracking-widest">
              Neural Signal Stream
              <span className="flex h-1.5 w-1.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--optimal-green)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--optimal-green)]"></span>
              </span>
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] text-[var(--text-muted)] font-mono uppercase tracking-tighter flex items-center gap-1">
                <Globe className="w-2.5 h-2.5" /> Global Sync Active
              </span>
              <span className="text-[9px] text-[var(--soft-gold)] font-mono opacity-50">
                •
              </span>
              <span className="text-[9px] text-[var(--text-muted)] font-mono uppercase tracking-tighter">
                {logs.length} Vectors Buffered
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end mr-4">
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1 h-3 rounded-full ${i < 4 ? "bg-[var(--optimal-green)]/40" : "bg-white/10"} animate-pulse`}
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
            <span className="text-[7px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-1">
              System Health
            </span>
          </div>
          <div className="text-[10px] bg-white/5 border border-white/5 px-3 py-1.5 rounded-lg text-[var(--text-muted)] font-mono flex items-center gap-2">
            <Activity className="w-3 h-3 text-[var(--soft-gold)] animate-pulse" />
            LIVE_FEED.CAP
          </div>
        </div>
      </div>

      {/* Terminal Output */}
      <div className="flex-1 overflow-y-auto p-6 font-mono text-[11px] leading-relaxed space-y-4 bg-black/30 relative z-10 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
        {loading && logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-3 opacity-40">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--soft-gold)]" />
            <span className="text-[10px] font-mono tracking-widest uppercase">
              Initializing neural link...
            </span>
          </div>
        ) : (
          logs.map((log, idx) => (
            <div
              key={log.id}
              className="group flex gap-4 hover:bg-white/[0.02] -mx-2 px-2 py-1.5 rounded-lg transition-all duration-300 animate-in fade-in slide-in-from-left-2"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="text-[var(--text-muted)] w-20 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity flex flex-col pt-0.5">
                <span className="font-bold border-l border-white/10 pl-2">
                  {new Date(log.created_at).toLocaleTimeString([], {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center flex-wrap gap-x-2">
                  <span
                    className={`font-black text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded
                              ${
                                log.status === "success"
                                  ? "bg-[var(--optimal-green)]/10 text-[var(--optimal-green)]"
                                  : log.status === "error"
                                    ? "bg-red-500/10 text-red-400"
                                    : "bg-[var(--soft-gold)]/10 text-[var(--soft-gold)]"
                              }`}
                  >
                    {log.action_type || "TASK"}
                  </span>
                  <span className="text-white/90 font-medium group-hover:text-white transition-colors">
                    {log.hotel_name || "KERNEL_PROCESS"}
                  </span>
                  {log.price && (
                    <div className="flex items-center gap-1 ml-auto md:ml-0 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                      <Zap className="w-2.5 h-2.5 text-[var(--soft-gold)]" />
                      <span className="text-[var(--soft-gold)] font-bold tabular-nums">
                        {log.price.toLocaleString()} {log.currency}
                      </span>
                    </div>
                  )}
                </div>
                {/* Secondary Detail Line */}
                <div className="mt-1 flex items-center gap-3 text-[9px] font-medium text-[var(--text-muted)] opacity-60 group-hover:opacity-100 transition-opacity">
                  <span className="uppercase flex items-center gap-1">
                    <Cpu className="w-2.5 h-2.5" /> Node 0{idx % 9}
                  </span>
                  <span className="text-white/10">/</span>
                  <span className="uppercase flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5" /> Status_{log.status}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Status */}
      <div className="px-5 py-3 bg-black/40 border-t border-white/5 text-[9px] text-[var(--text-muted)] font-mono flex justify-between items-center relative z-10">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--soft-gold)] shadow-[0_0_5px_rgba(212,175,55,0.5)]" />
            <span className="uppercase tracking-widest">Latency: 42ms</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--optimal-green)] shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
            <span className="uppercase tracking-widest">Uptime: 99.9%</span>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full border border-white/5">
          <span className="uppercase opacity-50">Sync_Clock:</span>
          <span className="text-white font-bold">
            {lastUpdate.toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default NeuralFeed;
