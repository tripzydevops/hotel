"use client";

import { QueryLog } from "@/types";
import { RefreshCw, CheckCircle2, AlertCircle, Clock, Trash2 } from "lucide-react";

interface ScanHistoryProps {
  scans: QueryLog[];
  onDelete: (id: string) => void;
}

export default function ScanHistory({ scans, onDelete }: ScanHistoryProps) {
  if (scans.length === 0) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <RefreshCw className="w-5 h-5 text-[var(--soft-gold)]" />
        <h2 className="text-xl font-bold text-white">System Logs</h2>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="divide-y divide-white/5">
          {scans.map((scan) => (
            <div 
              key={scan.id} 
              className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${
                  scan.status === "success" 
                  ? "bg-optimal-green/10 text-optimal-green" 
                  : "bg-alert-red/10 text-alert-red"
                }`}>
                  {scan.status === "success" ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-white capitalize">
                    {scan.action_type} Pulse
                  </p>
                  <div className="flex items-center gap-2 text-[var(--text-muted)] text-[10px] mt-0.5">
                    <Clock className="w-2 h-2" />
                    <span>{formatDate(scan.created_at)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right hidden sm:block">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                    scan.status === "success" 
                    ? "text-optimal-green bg-optimal-green/5" 
                    : "text-alert-red bg-alert-red/5"
                  }`}>
                    {scan.status}
                  </span>
                </div>
                
                <button
                  onClick={() => onDelete(scan.id)}
                  className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all sm:opacity-0 sm:group-hover:opacity-100"
                  title="Remove log"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
