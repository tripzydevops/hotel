"use client";

import React, { useState, useEffect } from "react";
import {
  Key,
  RefreshCw,
  AlertCircle,
  Loader2,
  CheckCircle2,
  RotateCcw,
  Activity,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { KeyStatus } from "@/types";

const ApiKeysPanel = () => {
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadKeyStatus();
  }, []);

  const loadKeyStatus = async () => {
    setLoading(true);
    try {
      const [kData, pData] = await Promise.all([
        api.getAdminKeyStatus(),
        api.getAdminProviders(),
      ]);
      setKeyStatus(kData);
      setProviders(pData);
    } catch (err: any) {
      console.error("Failed to load key status:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRotate = async () => {
    if (!confirm("Force rotate to next API key?")) return;
    setActionLoading(true);
    try {
      const data = await api.rotateAdminKey();
      setKeyStatus(data.current_status);
      alert(data.message);
    } catch (err: any) {
      alert("Failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReload = async () => {
    setActionLoading(true);
    try {
      const data = await api.reloadAdminKeys();
      setKeyStatus((curr) =>
        curr ? { ...curr, total_keys: data.total_keys } : null,
      );
      loadKeyStatus();
      alert("Successfully reloaded keys from environment.");
    } catch (err: any) {
      alert("Reload Failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset all keys to active? (Use at new billing period)"))
      return;
    setActionLoading(true);
    try {
      const data = await api.resetAdminKeys();
      setKeyStatus(data.current_status);
      alert(data.message);
    } catch (err: any) {
      alert("Failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-8 border border-white/10 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--soft-gold)] mx-auto" />
        <p className="text-[var(--text-muted)] mt-4">Loading key status...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Header Info */}
      <div className="flex items-center justify-between p-6 bg-gradient-to-r from-blue-500/10 to-indigo-500/5 border border-blue-500/20 rounded-2xl shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12">
          <Key className="w-20 h-20 text-blue-400" />
        </div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <span className="text-white text-base font-bold tracking-tight">
              API Gateway Control
            </span>
            <p className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-widest mt-0.5">
              Automated key rotation and quota management
            </p>
          </div>
        </div>
        <div className="flex gap-4 z-10">
          <button
            onClick={handleReload}
            disabled={actionLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-white/5"
          >
            {actionLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            Sync Registry
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="glass-card p-6 border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Activity className="w-12 h-12 text-[var(--soft-gold)]" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-1">
            Global Throughput
          </p>
          <p className="text-3xl font-black text-white tabular-nums">
            {keyStatus?.monthly_usage || 0}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--soft-gold)] shadow-[0_0_10px_rgba(212,175,55,0.5)] transition-all duration-1000"
                style={{
                  width: `${Math.min(100, ((keyStatus?.monthly_usage || 0) / ((keyStatus?.total_keys || 1) * (keyStatus?.quota_per_key || 2500))) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="glass-card p-6 border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <CheckCircle2 className="w-12 h-12 text-[var(--optimal-green)]" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-1">
            Operational Keys
          </p>
          <p className="text-3xl font-black text-[var(--optimal-green)] tabular-nums">
            {keyStatus?.active_keys || 0}
          </p>
          <p className="text-[10px] font-bold text-[var(--text-muted)] mt-2 italic uppercase">
            System healthy and ready
          </p>
        </div>

        <div className="glass-card p-6 border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <AlertCircle className="w-12 h-12 text-red-400" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-1">
            Exhausted Nodes
          </p>
          <p className="text-3xl font-black text-red-500 tabular-nums">
            {(keyStatus?.total_keys || 0) - (keyStatus?.active_keys || 0)}
          </p>
          <p className="text-[10px] font-bold text-[var(--text-muted)] mt-2 italic uppercase">
            Requiring rotation soon
          </p>
        </div>
      </div>

      {/* Network Providers */}
      <div className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-white px-1">
          Network Providers
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {providers?.map((p) => (
            <div
              key={p.name}
              className="glass-card p-4 border border-white/5 hover:border-white/10 transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-white uppercase tracking-tighter">
                  {p.name}
                </span>
                <div
                  className={`w-2 h-2 rounded-full ${p.enabled ? "bg-[var(--optimal-green)] shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500"}`}
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-lg font-black text-white tracking-tighter tabular-nums">
                  {p.priority}
                </span>
                <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                  Priority Ranking
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Keys Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black uppercase tracking-widest text-white">
            Active Key Clusters
          </h3>
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-white/10"
            >
              Reset Quotas
            </button>
            <button
              onClick={handleRotate}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--soft-gold)]/10 hover:bg-[var(--soft-gold)]/20 text-[var(--soft-gold)] rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-[var(--soft-gold)]/20"
            >
              {actionLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RotateCcw className="w-3 h-3" />
              )}
              Force Manual Rotation
            </button>
          </div>
        </div>

        <div className="glass-card border border-white/5 overflow-hidden shadow-2xl transition-all duration-500 hover:border-blue-500/10">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-white/[0.02] text-[var(--text-muted)] font-black text-[10px] uppercase tracking-[0.2em] border-b border-white/5">
              <tr>
                <th className="p-5">Cluster Node</th>
                <th className="p-5">Credential Fragment</th>
                <th className="p-5">Health Status</th>
                <th className="p-5 text-right">Temporal Usage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {keyStatus?.keys_status?.map((key) => (
                <tr
                  key={key.index}
                  className={`hover:bg-white/[0.02] transition-colors group ${key.is_current ? "bg-[var(--soft-gold)]/5" : ""}`}
                >
                  <td className="p-5 text-white font-black tabular-nums">
                    NODE_{String(key.index).padStart(2, "0")}
                    {key.is_current && (
                      <span className="ml-2 text-[8px] bg-[var(--soft-gold)] text-[var(--deep-ocean)] px-1 rounded">
                        ACTIVE
                      </span>
                    )}
                  </td>
                  <td className="p-5">
                    <code className="text-[10px] font-mono bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 group-hover:text-[var(--soft-gold)] transition-colors">
                      {key.key_suffix}
                    </code>
                  </td>
                  <td className="p-5">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        !key.is_exhausted
                          ? "bg-[var(--optimal-green)]/10 text-[var(--optimal-green)] border border-[var(--optimal-green)]/20"
                          : "bg-red-500/10 text-red-500 border border-red-500/20"
                      }`}
                    >
                      {key.is_exhausted ? "Exhausted" : "Active"}
                    </span>
                  </td>
                  <td className="p-5 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-black tabular-nums">
                          {key.usage || 0}
                        </span>
                        <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-tight">
                          Requests
                        </span>
                      </div>
                      <div className="text-[8px] font-bold text-[var(--text-muted)] tracking-widest uppercase opacity-50 italic">
                        Limit: {keyStatus?.quota_per_key || 2500} / mo
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ApiKeysPanel;
