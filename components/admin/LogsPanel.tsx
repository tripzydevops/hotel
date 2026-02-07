"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { AdminLog } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Terminal, AlertCircle, Shield, FileText } from "lucide-react";

const LogsPanel = () => {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminLogs();
      setLogs(data);
    } catch (err) {
      console.error("Failed to load logs:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-[var(--soft-gold)]" />
          </div>
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-widest">
              System Audit Logs
            </h3>
            <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-tighter opacity-50">
              Immutable Execution Journal
            </p>
          </div>
        </div>
        <button
          onClick={loadLogs}
          className="text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-[var(--soft-gold)]/10 px-4 py-2 rounded-lg flex items-center gap-2 text-[var(--soft-gold)] border border-white/5 transition-all active:scale-95"
        >
          Refresh Stream
        </button>
      </div>

      <div className="glass-card border border-white/5 overflow-hidden shadow-2xl transition-all duration-500 hover:border-[var(--soft-gold)]/10">
        {loading && logs.length === 0 ? (
          <div className="p-24 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-[var(--soft-gold)] mx-auto opacity-50" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-white/[0.02] text-[var(--text-muted)] font-black text-[10px] uppercase tracking-[0.2em] border-b border-white/5">
                <tr>
                  <th className="p-5">Temporal Stamp</th>
                  <th className="p-5">Security Level</th>
                  <th className="p-5">Action Descriptor</th>
                  <th className="p-5">Matrix Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="p-5 text-[var(--text-muted)] whitespace-nowrap font-mono text-[11px] opacity-70 group-hover:opacity-100 group-hover:text-white transition-all">
                      {formatDistanceToNow(new Date(log.timestamp), {
                        addSuffix: true,
                      })}
                    </td>
                    <td className="p-5">
                      <span
                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                          log.level === "ERROR"
                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                            : log.level === "SUCCESS"
                              ? "bg-[var(--optimal-green)]/10 text-[var(--optimal-green)] border-[var(--optimal-green)]/20"
                              : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        }`}
                      >
                        {log.level}
                      </span>
                    </td>
                    <td className="p-5">
                      <span className="text-white font-bold tracking-tight text-sm flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-[var(--soft-gold)] opacity-40 group-hover:opacity-100 transition-opacity" />
                        {log.action}
                      </span>
                    </td>
                    <td className="p-5">
                      <div className="text-[var(--text-muted)] text-[11px] font-mono bg-black/20 p-2.5 rounded-lg border border-white/5 opacity-60 group-hover:opacity-100 group-hover:border-[var(--soft-gold)]/20 transition-all max-w-md truncate">
                        {log.details}
                      </div>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-20 text-center text-[var(--text-muted)] font-mono text-xs uppercase tracking-widest opacity-40"
                    >
                      <Terminal className="w-10 h-10 mx-auto mb-4 opacity-20" />
                      Journal Empty
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogsPanel;
