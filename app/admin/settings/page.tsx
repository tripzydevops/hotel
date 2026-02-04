"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import {
  Settings,
  Save,
  Loader2,
  Info,
  AlertTriangle,
  Cloud,
  ToggleLeft,
  ToggleRight,
  DollarSign,
  Activity,
} from "lucide-react";
import CommandLayout from "@/components/layout/CommandLayout";

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  // Available currencies
  const CURRENCIES = ["USD", "EUR", "GBP", "TRY"];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminSettings();
      setSettings(data);
    } catch (err) {
      console.error("Failed to load settings", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const updated = await api.updateAdminSettings({
        maintenance_mode: settings.maintenance_mode,
        signup_enabled: settings.signup_enabled,
        default_currency: settings.default_currency,
        system_alert_message: settings.system_alert_message || null,
        default_check_frequency: 144, // Hardcoded for now if backend doesn't support it fully
      });
      setSettings(updated);
      alert("Settings saved successfully.");
    } catch (err: any) {
      alert("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--soft-gold)]" />
      </div>
    );
  }

  return (
    <CommandLayout userProfile={{}} activeRoute="admin">
      {/* Header */}
      <div className="flex flex-col mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Activity className="w-4 h-4 text-[var(--soft-gold)]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--soft-gold)]">
            Neural Infrastructure Config
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Global Settings</h1>
            <p className="text-[var(--text-secondary)] mt-1 text-sm font-medium">
              Configure system-wide parameters and operational behavior.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* System Status Card */}
        <div className="panel p-6 border-[var(--panel-border)] md:col-span-2 bg-[#0d2547]">
          <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
            <Cloud className="w-4 h-4 text-[var(--soft-gold)]" />
            <h2 className="text-xs font-bold text-white uppercase tracking-widest">
              Platform State
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-center justify-between p-4 bg-black/20 rounded-sm border border-white/5">
              <div>
                <div className="font-bold text-white text-xs uppercase tracking-widest mb-1">
                  Maintenance Mode
                </div>
                <div className="text-[10px] text-[var(--text-muted)] font-mono">
                  LOCK_USER_ACCESS_FOR_UPDATES
                </div>
              </div>
              <button
                onClick={() =>
                  setSettings({
                    ...settings,
                    maintenance_mode: !settings.maintenance_mode,
                  })
                }
                className={`transition-colors ${settings.maintenance_mode ? "text-[var(--soft-gold)]" : "text-[var(--text-muted)]"}`}
              >
                {settings.maintenance_mode ? (
                  <ToggleRight className="w-8 h-8" />
                ) : (
                  <ToggleLeft className="w-8 h-8" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-black/20 rounded-sm border border-white/5">
              <div>
                <div className="font-bold text-white text-xs uppercase tracking-widest mb-1">
                  New User Signup
                </div>
                <div className="text-[10px] text-[var(--text-muted)] font-mono">
                  ALLOW_PUBLIC_NODE_REGISTRATION
                </div>
              </div>
              <button
                onClick={() =>
                  setSettings({
                    ...settings,
                    signup_enabled: !settings.signup_enabled,
                  })
                }
                className={`transition-colors ${settings.signup_enabled ? "text-[var(--success)]" : "text-[var(--text-muted)]"}`}
              >
                {settings.signup_enabled ? (
                  <ToggleRight className="w-8 h-8" />
                ) : (
                  <ToggleLeft className="w-8 h-8" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Defaults Card */}
        <div className="panel p-6 border-[var(--panel-border)] bg-[#0d2547]">
          <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
            <DollarSign className="w-4 h-4 text-[var(--soft-gold)]" />
            <h2 className="text-xs font-bold text-white uppercase tracking-widest">
              Market Defaults
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[9px] uppercase font-bold text-[var(--text-muted)] mb-2 tracking-[0.2em]">
                Primary Base Currency
              </label>
              <div className="grid grid-cols-4 gap-2">
                {CURRENCIES.map((c) => (
                  <button
                    key={c}
                    onClick={() =>
                      setSettings({ ...settings, default_currency: c })
                    }
                    className={`px-4 py-2 rounded-sm text-[10px] font-black border transition-all ${
                      settings.default_currency === c
                        ? "bg-[var(--soft-gold)] text-black border-[var(--soft-gold)] shadow-[0_0_10px_rgba(212,175,55,0.2)]"
                        : "bg-black/20 text-white border-white/10 hover:border-white/20"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-sm flex gap-3 text-[10px] text-blue-300 font-medium">
              <Info className="w-3.5 h-3.5 shrink-0" />
              Global currency overrides only affect new neural nodes. Existing
              user identities retain their localized parameters.
            </div>
          </div>
        </div>

        {/* System Alert Banner */}
        <div className="panel p-6 border-[var(--panel-border)] bg-[#0d2547]">
          <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="text-xs font-bold text-white uppercase tracking-widest">
              Global Broadcast
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[9px] uppercase font-bold text-[var(--text-muted)] mb-2 tracking-[0.2em]">
                Banner Message (Optional)
              </label>
              <textarea
                className="w-full h-32 bg-black/40 border border-white/10 rounded-sm p-4 text-white text-xs font-mono focus:border-[var(--soft-gold)] transition-colors"
                placeholder="MESSAGE_CONTENT"
                value={settings.system_alert_message || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    system_alert_message: e.target.value,
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-8 py-3 bg-[var(--soft-gold)] text-black font-black text-xs uppercase tracking-[0.2em] rounded-sm hover:opacity-90 transition-all disabled:opacity-50 shadow-[0_4px_20px_rgba(212,175,55,0.15)]"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          COMMIT_CHANGES
        </button>
      </div>
    </CommandLayout>
  );
}
