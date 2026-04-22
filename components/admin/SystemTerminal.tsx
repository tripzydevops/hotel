"use client";

import React, { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { SystemLogEntry } from "@/types";
import { Loader2, Terminal, RefreshCw } from "lucide-react";

const SystemTerminal = () => {
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchLogs();
    
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchLogs, 5000); // Poll every 5s
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const fetchLogs = async () => {
    try {
      const response = await api.getSystemLogs(100);
      setLogs(response.logs);
    } catch (err) {
      console.error("Failed to fetch system logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "ERROR": return "text-red-400";
      case "WARN": return "text-amber-400";
      case "SUCCESS": return "text-emerald-400";
      default: return "text-blue-400";
    }
  };

  return (
    <div className="flex flex-col gap-4 mt-8">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Terminal className="w-5 h-5 text-[var(--soft-gold)]" />
          </div>
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-widest">
              Live Background Worker Logs
            </h3>
            <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-tighter opacity-50 flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-white/20'}`} />
              Real-time scheduler monitoring
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg flex items-center gap-2 border transition-all active:scale-95 ${
                autoRefresh 
                ? "bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] border-[var(--soft-gold)]/20" 
                : "bg-white/5 text-[var(--text-muted)] border-white/10 hover:border-white/20"
            }`}
          >
            <RefreshCw className={`w-3 h-3 ${autoRefresh ? 'animate-spin-slow' : ''}`} />
            {autoRefresh ? "Live: ON" : "Live: OFF"}
          </button>
          
          <button
            onClick={fetchLogs}
            className="text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg flex items-center gap-2 text-white border border-white/5 transition-all active:scale-95"
          >
            Force Refresh
          </button>
        </div>
      </div>

      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--soft-gold)]/20 to-transparent rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
        <div className="relative bg-[#0a0a0b] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          {/* Terminal Header */}
          <div className="bg-white/5 border-b border-white/10 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
              <span className="ml-2 text-[10px] font-mono text-white/40 uppercase tracking-widest">
                scheduler.log — terminal
              </span>
            </div>
            <div className="flex items-center gap-4">
               <span className="text-[10px] font-mono text-white/30 uppercase tracking-tighter">
                80x24
              </span>
            </div>
          </div>

          {/* Terminal Body */}
          <div 
            ref={scrollRef}
            className="p-6 h-[400px] overflow-y-auto font-mono text-[12px] leading-relaxed scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
          >
            {loading && logs.length === 0 ? (
              <div className="h-full flex items-center justify-center opacity-30 italic">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Initializing terminal session...
              </div>
            ) : (
              <div className="space-y-0.5">
                {logs.map((log, i) => (
                  <div key={log.line_num ?? i} className="group/line flex gap-4 hover:bg-white/5 -mx-2 px-2 rounded transition-colors">
                    <span className="text-white/20 select-none min-w-[3ch] text-right">
                      {(log.line_num ?? i) + 1}
                    </span>
                    <div className="flex-1 break-all">
                      <span className={`font-bold mr-2 ${getLevelColor(log.level)}`}>
                        [{log.level}]
                      </span>
                      <span className="text-white/80 group-hover/line:text-white transition-colors">
                        {log.line}
                      </span>
                    </div>
                  </div>
                ))}
                
                <div className="pt-2 animate-pulse flex items-center gap-2">
                  <span className="text-[var(--soft-gold)]">$</span>
                  <div className="w-2 h-4 bg-[var(--soft-gold)]/50" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemTerminal;
