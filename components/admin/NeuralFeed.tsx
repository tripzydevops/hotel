import React, { useState, useEffect, useRef } from "react";
import {
  Terminal,
  Zap,
  Activity,
  Cpu,
  Shield,
  Globe,
  Loader2,
  Lock,
} from "lucide-react";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { AdminStats } from "@/types";

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
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [logs, setLogs] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const feedRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  const fetchLogs = React.useCallback(async () => {
    if (!isVisible) return;
    try {
      const [logData, statData] = await Promise.all([
        api.getAdminFeed(),
        api.getAdminStats()
      ]);
      setLogs(logData);
      setStats(statData);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Neural Feed Error", err);
    } finally {
      setLoading(false);
    }
  }, [isVisible]);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [isVisible]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 },
    );
    if (feedRef.current) observer.observe(feedRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={feedRef}
      className="command-card flex flex-col h-[600px] relative group"
    >
      {/* Immersive Scanning Line Overlay */}
      <div className="absolute inset-x-0 h-[2px] bg-[var(--soft-gold)]/10 animate-[scan_4s_linear_infinite] pointer-events-none z-20" />

      {/* Header Overlay */}
      <div className="p-6 bg-black/40 border-b border-white/5 flex justify-between items-center relative z-10 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[var(--soft-gold)]/5 border border-[var(--soft-gold)]/20 flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.05)]">
            <Terminal className="w-6 h-6 text-[var(--soft-gold)]" />
          </div>
          <div>
            <h3 className="text-[10px] font-black text-white flex items-center gap-3 uppercase tracking-[0.3em]">
              Primary Signal Stream
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--optimal-green)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--optimal-green)]"></span>
              </span>
            </h3>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[9px] text-[var(--text-muted)] font-mono uppercase tracking-widest flex items-center gap-2">
                <Globe className="w-3 h-3 text-blue-400/50" /> Network Sync:
                ACTIVE
              </span>
              <span className="w-1 h-1 rounded-full bg-white/10" />
              <span className="text-[9px] text-[var(--text-muted)] font-mono uppercase tracking-widest">
                Nodes: [03/09] Online
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden lg:flex flex-col items-end">
            <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">
              Load Matrix
            </span>
            <div className="flex gap-1">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1 h-4 rounded-full ${i < 6 ? "bg-[var(--soft-gold)]/40" : "bg-white/5"}`}
                />
              ))}
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-[var(--soft-gold)] font-mono text-[10px] flex items-center gap-2">
            <Lock className="w-3.5 h-3.5" /> Encrypted Channel
          </div>
        </div>
      </div>

      {/* Terminal Output */}
      <div className="flex-1 overflow-y-auto p-8 font-mono text-[11px] space-y-5 bg-black/20 scrollbar-thin scrollbar-thumb-white/5">
        <AnimatePresence mode="popLayout">
          {loading && logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-40">
              <Loader2 className="w-10 h-10 animate-spin text-[var(--soft-gold)]" />
              <span className="text-[9px] uppercase tracking-[0.4em]">
                Establishing Neural Gate...
              </span>
            </div>
          ) : (
            logs.map((log, idx) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className="group flex gap-6 hover:bg-white/[0.03] -mx-4 px-4 py-2 rounded-xl transition-all border border-transparent hover:border-white/5"
              >
                <div className="text-[var(--text-muted)] w-24 shrink-0 flex flex-col pt-1">
                  <span className="font-black text-[9px] opacity-40 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    [
                    {new Date(log.created_at).toLocaleTimeString([], {
                      hour12: false,
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                    ]
                  </span>
                </div>

                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center flex-wrap gap-3">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest
                      ${
                        log.status === "success"
                          ? "bg-[var(--optimal-green)]/10 text-[var(--optimal-green)] border border-[var(--optimal-green)]/20"
                          : log.status === "error"
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : "bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] border border-[var(--soft-gold)]/20 shadow-[0_0_10px_rgba(212,175,55,0.05)]"
                      }`}
                    >
                      {log.action_type || "SIGNAL"}
                    </span>
                    <span className="text-white font-bold tracking-tight text-sm">
                      {log.hotel_name || "SYSTEM_KERNEL"}
                    </span>
                    {log.price && (
                      <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-lg border border-white/5 ml-auto">
                        <Zap className="w-3 h-3 text-[var(--soft-gold)]" />
                        <span className="text-[var(--soft-gold)] font-black tabular-nums">
                          {log.price?.toLocaleString()} {log.currency}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-[9px] font-bold text-[var(--text-muted)] opacity-50 group-hover:opacity-100 transition-opacity uppercase tracking-widest">
                    <span className="flex items-center gap-1.5">
                      <Cpu className="w-3 h-3" /> Core_Link_{idx % 4}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-3 h-3" /> Integrity_Verified
                    </span>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Footer System Status */}
      <div className="px-8 py-4 bg-black/40 border-t border-white/5 flex justify-between items-center text-[9px] font-mono text-[var(--text-muted)]">
        <div className="flex gap-10">
          <div className="flex items-center gap-2.5">
            <div className={`w-2 h-2 rounded-full shadow-[0_0_10px_currentColor] ${
              (stats?.avg_latency_ms || 0) < 2000 ? "text-[var(--soft-gold)]" : "text-orange-500"
            } bg-current`} />
            <span className="uppercase tracking-[0.2em]">LATENCY: {stats?.avg_latency_ms || 0}ms</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-[var(--optimal-green)] shadow-[0_0_10px_rgba(16,185,129,0.4)]" />
            <span className="uppercase tracking-[0.2em]">
              GATE_UPTIME: {stats?.scraper_health || 100}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="opacity-40 uppercase">Last Sync:</span>
          <span className="text-white font-black">
            {lastUpdate.toLocaleTimeString()}
          </span>
        </div>
      </div>

      <style jsx>{`
        @keyframes scan {
          0% {
            top: 0%;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            top: 100%;
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default NeuralFeed;
