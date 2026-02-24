"use client";

import { useState, useEffect } from "react";
import BentoGrid, { BentoTile } from "@/components/ui/BentoGrid";
import { AlertCircle, CheckCircle2, ShieldAlert, Activity, Database, Server } from "lucide-react";
import LoadingState from "@/components/ui/LoadingState";
import ErrorState from "@/components/ui/ErrorState";

interface SystemReport {
  timestamp: string;
  environment: {
    NEXT_PUBLIC_SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    VERCEL: string;
    PYTHON_VERSION: string;
    PYTHONPATH: string;
  };
  database: {
    status?: string;
    [key: string]: any;
  };
  process: {
    memory_usage_mb: number;
    pid: number;
  };
}

export default function DebugPage() {
  const [report, setReport] = useState<SystemReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch("/api/debug/system-report");
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        const data = await res.json();
        setReport(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={`Diagnostic Failure: ${error}`} onRetry={() => window.location.reload()} />;
  if (!report) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Diagnostic Hub</h1>
        <p className="text-muted-foreground text-sm flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500" />
          System health report generated at {new Date(report.timestamp).toLocaleString()}
        </p>
      </header>

      <BentoGrid>
        {/* Environment Status */}
        <BentoTile size="large" className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-indigo-500/20">
              <ShieldAlert className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Environment</h2>
              <p className="text-xs text-indigo-300">Variables & Platform Config</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {Object.entries(report.environment).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-xs font-mono text-indigo-200">{key}</span>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                  value === "PRESENT" || value === "1" 
                    ? "bg-emerald-500/20 text-emerald-400" 
                    : value === "MISSING" 
                      ? "bg-rose-500/20 text-rose-400" 
                      : "bg-white/10 text-white/60"
                }`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </BentoTile>

        {/* Database Tables */}
        <BentoTile size="large" className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-cyan-500/20">
              <Database className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Database Index</h2>
              <p className="text-xs text-cyan-300">Table Connectivity & Health</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {Object.entries(report.database).map(([table, details]: [string, any]) => (
              table !== "status" && (
                <div key={table} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-colors">
                  <div className="flex items-center gap-3">
                    {details.status === "OK" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                    )}
                    <span className="text-sm font-medium text-white capitalize">{table.replace("_", " ")}</span>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <span className={`text-[10px] uppercase font-black ${details.status === "OK" ? "text-emerald-400" : "text-rose-400"}`}>
                      {details.status}
                    </span>
                    {details.status === "OK" && (
                      <span className="text-[9px] text-white/40">Ping Success (n={details.count_hint})</span>
                    )}
                  </div>
                </div>
              )
            ))}
            {report.database.status && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30">
                <p className="text-xs text-rose-400 font-bold">{report.database.status}</p>
              </div>
            )}
          </div>
        </BentoTile>

        {/* System & Process */}
        <BentoTile size="medium" className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
          <div className="flex items-center gap-3 mb-4">
            <Server className="w-5 h-5 text-amber-400" />
            <h2 className="font-semibold text-white">Process</h2>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-[10px] uppercase text-amber-300 font-bold">Memory usage</p>
              <p className="text-2xl font-black text-white">{Math.round(report.process.memory_usage_mb)} MB</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase text-amber-300 font-bold">Process PID</p>
              <p className="text-sm font-mono text-white/70">{report.process.pid}</p>
            </div>
          </div>
        </BentoTile>
      </BentoGrid>

      <div className="p-6 rounded-[2.5rem] bg-white/5 border border-white/10 flex items-start gap-4">
        <div className="p-3 rounded-2xl bg-blue-500/20">
          <Activity className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h3 className="font-semibold text-white mb-1">Diagnostic Mode Explained</h3>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            This page performs real-time queries against the backend's cloud environment. 
            If "PRESENT" variables are missing in Vercel, auth will fail. If database tables 
            show "FAILED", RLS policies or schema mismatches are likely blocking the request.
          </p>
        </div>
      </div>
    </div>
  );
}
