"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { AdminLog } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";

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

  if (loading && logs.length === 0) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--soft-gold)] mx-auto" />
      </div>
    );
  }

  return (
    <div className="glass-card border border-white/10 overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-[var(--text-muted)] font-medium">
          <tr>
            <th className="p-4">Time</th>
            <th className="p-4">Level</th>
            <th className="p-4">Action</th>
            <th className="p-4">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-white/5">
              <td className="p-4 text-[var(--text-muted)] whitespace-nowrap">
                {formatDistanceToNow(new Date(log.timestamp), {
                  addSuffix: true,
                })}
              </td>
              <td className="p-4">
                <span
                  className={`px-2 py-1 rounded text-xs font-bold ${
                    log.level === "ERROR"
                      ? "bg-red-500/20 text-red-400"
                      : log.level === "SUCCESS"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-blue-500/20 text-blue-400"
                  }`}
                >
                  {log.level}
                </span>
              </td>
              <td className="p-4 text-white">{log.action}</td>
              <td className="p-4 text-[var(--text-muted)] text-xs font-mono">
                {log.details}
              </td>
            </tr>
          ))}
          {logs.length === 0 && !loading && (
            <tr>
              <td
                colSpan={4}
                className="p-8 text-center text-[var(--text-muted)]"
              >
                No logs found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default LogsPanel;
