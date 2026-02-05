"use client";

import React, { useState, useEffect } from "react";
import {
  Key,
  RefreshCw,
  AlertCircle,
  Loader2,
  CheckCircle2,
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

      const debugMsg = [
        `Reloaded! Found ${data.total_keys} keys.`,
        `Keys: ${data.keys_found?.join(", ")}`,
        `Env Check: ${JSON.stringify(data.env_debug, null, 2)}`,
      ].join("\n");

      alert(debugMsg);
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
    <div className="space-y-6">
      <div className="glass-card p-6 border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Key className="w-6 h-6 text-[var(--soft-gold)]" />
            <h3 className="text-xl font-bold text-white">
              SerpApi Key Management
            </h3>
          </div>
          <button
            onClick={loadKeyStatus}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-sm rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Providers Status */}
        <div className="mb-8">
          <h4 className="text-sm font-bold text-white mb-3 uppercase tracking-wider text-[var(--text-muted)]">
            Active Data Providers
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {providers.map((p) => (
              <div
                key={p.name}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${p.enabled ? "bg-[var(--optimal-green)] shadow-[0_0_8px_var(--optimal-green)]" : "bg-red-500/50"}`}
                  />
                  <div>
                    <div className="text-sm font-bold text-white">{p.name}</div>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                      {p.type}
                    </div>
                    {p.limit && (
                      <div className="text-[10px] text-[var(--soft-gold)] mt-0.5 opacity-80">
                        Limit: {p.limit} • Reset: {p.refresh}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-xs font-mono text-[var(--soft-gold)] opacity-70">
                  P{p.priority}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-black/20 p-4 rounded-lg">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Total Keys
            </div>
            <div className="text-2xl font-bold text-white">
              {keyStatus?.total_keys || 0}
            </div>
          </div>
          <div className="bg-black/20 p-4 rounded-lg">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Active Keys
            </div>
            <div className="text-2xl font-bold text-[var(--optimal-green)]">
              {keyStatus?.active_keys || 0}
            </div>
          </div>
          <div className="bg-black/20 p-4 rounded-lg">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Monthly Usage
            </div>
            <div className="text-2xl font-bold text-[var(--soft-gold)]">
              {keyStatus?.monthly_usage || 0}
              <span className="text-xs text-[var(--text-muted)] ml-2 font-normal">
                /{" "}
                {Math.max(
                  0,
                  (keyStatus?.quota_per_key || 250) -
                    (keyStatus?.monthly_usage || 0),
                )}{" "}
                left
              </span>
            </div>
          </div>
          <div className="bg-black/20 p-4 rounded-lg">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Current Key
            </div>
            <div className="text-2xl font-bold text-white">
              #{keyStatus?.current_key_index || 1}
            </div>
          </div>
          <div className="bg-black/20 p-4 rounded-lg">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Quota/Key
            </div>
            <div className="text-2xl font-bold text-white">
              {keyStatus?.quota_per_key || 250}/mo
            </div>
          </div>
        </div>

        {/* Keys List */}
        <div className="space-y-3">
          {keyStatus?.keys_status?.map((key) => (
            <div
              key={key.index}
              className={`flex items-center justify-between p-4 rounded-lg border ${
                key.is_current
                  ? "bg-[var(--soft-gold)]/10 border-[var(--soft-gold)]/30"
                  : key.is_exhausted
                    ? "bg-red-500/10 border-red-500/30"
                    : "bg-white/5 border-white/10"
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                    key.is_current
                      ? "bg-[var(--soft-gold)] text-black"
                      : "bg-white/10 text-white"
                  }`}
                >
                  {key.index}
                </div>
                <div>
                  <div className="text-white font-mono text-sm">
                    {key.key_suffix}
                  </div>
                  {key.exhausted_at && (
                    <div className="text-red-400 text-xs">
                      Exhausted: {new Date(key.exhausted_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {key.is_current && (
                  <span className="px-2 py-1 bg-[var(--soft-gold)]/20 text-[var(--soft-gold)] text-xs rounded font-medium">
                    ACTIVE
                  </span>
                )}
                {key.is_exhausted && !key.is_current && (
                  <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded font-medium">
                    EXHAUSTED
                  </span>
                )}
                {!key.is_exhausted && !key.is_current && (
                  <span className="px-2 py-1 bg-white/10 text-[var(--text-muted)] text-xs rounded">
                    Standby
                  </span>
                )}
              </div>
            </div>
          ))}

          {(!keyStatus?.keys_status || keyStatus.keys_status.length === 0) && (
            <div className="p-6 text-center text-[var(--text-muted)] bg-white/5 rounded-lg">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No API keys configured.</p>
              <p className="text-xs mt-1">
                Add SERPAPI_API_KEY to environment variables.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={handleRotate}
          disabled={actionLoading || (keyStatus?.total_keys || 0) <= 1}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {actionLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Force Rotate to Next Key
        </button>
        <button
          onClick={handleReload}
          disabled={actionLoading}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[var(--soft-gold)]/20 text-[var(--soft-gold)] font-bold rounded-lg hover:bg-[var(--soft-gold)]/30 disabled:opacity-50"
        >
          {actionLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Reload from Env
        </button>
        <button
          onClick={handleReset}
          disabled={actionLoading}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[var(--soft-gold)] text-black font-bold rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {actionLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          Reset All Keys (New Month)
        </button>
      </div>
    </div>
  );
};

export default ApiKeysPanel;
