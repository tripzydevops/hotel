"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Settings, Save, Loader2, Info, AlertTriangle, Cloud, ToggleLeft, ToggleRight, DollarSign, Activity, Clock } from "lucide-react";
import { AdminSettings } from "@/types";

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  
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
    if (!settings) return;
    try {
      setSaving(true);
      const updated = await api.updateAdminSettings({
        maintenance_mode: settings.maintenance_mode,
        signup_enabled: settings.signup_enabled,
        default_currency: settings.default_currency,
        system_alert_message: settings.system_alert_message || undefined,
        scan_interval_hours: settings.scan_interval_hours
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

  if (!settings) {
      return (
          <div className="flex items-center justify-center h-96 text-[var(--text-muted)]">
              Failed to load settings.
          </div>
      );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-[var(--soft-gold)]/20 flex items-center justify-center">
          <Settings className="w-6 h-6 text-[var(--soft-gold)]" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--overlay-text)]">Global Settings</h1>
          <p className="text-[var(--text-muted)] mt-1">Configure system-wide parameters and behavior</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* System Status Card */}
        <div className="glass-card p-6 border border-[var(--overlay-border)] md:col-span-2">
            <div className="flex items-center gap-2 mb-6 border-b border-[var(--overlay-border)] pb-4">
                <Cloud className="w-5 h-5 text-[var(--soft-gold)]" />
                <h2 className="text-lg font-bold text-[var(--overlay-text)]">System Status</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-[var(--overlay-border)]">
                    <div>
                        <div className="font-bold text-[var(--overlay-text)] mb-1">Maintenance Mode</div>
                        <div className="text-xs text-[var(--text-muted)]">Disable user access for updates</div>
                    </div>
                    <button 
                        onClick={() => setSettings({...settings, maintenance_mode: !settings.maintenance_mode})}
                        className={`transition-colors ${settings.maintenance_mode ? 'text-[var(--soft-gold)]' : 'text-[var(--text-muted)]'}`}
                    >
                        {settings.maintenance_mode ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                    </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-[var(--overlay-border)]">
                    <div>
                        <div className="font-bold text-[var(--overlay-text)] mb-1">New User Signup</div>
                        <div className="text-xs text-[var(--text-muted)]">Allow new users to register</div>
                    </div>
                    <button 
                        onClick={() => setSettings({...settings, signup_enabled: !settings.signup_enabled})}
                        className={`transition-colors ${settings.signup_enabled ? 'text-[var(--optimal-green)]' : 'text-[var(--text-muted)]'}`}
                    >
                        {settings.signup_enabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                    </button>
                </div>
            </div>
        </div>

        {/* Defaults Card */}
        <div className="glass-card p-6 border border-[var(--overlay-border)]">
            <div className="flex items-center gap-2 mb-6 border-b border-[var(--overlay-border)] pb-4">
                <DollarSign className="w-5 h-5 text-[var(--soft-gold)]" />
                <h2 className="text-lg font-bold text-[var(--overlay-text)]">Market Defaults</h2>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-xs uppercase font-bold text-[var(--text-muted)] mb-2">Default Base Currency</label>
                    <div className="grid grid-cols-4 gap-2">
                        {CURRENCIES.map(c => (
                            <button
                                key={c}
                                onClick={() => setSettings({...settings, default_currency: c})}
                                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${
                                    settings.default_currency === c 
                                    ? 'bg-[var(--soft-gold)] text-black border-[var(--soft-gold)]' 
                                    : 'bg-white/5 text-[var(--overlay-text)] border-[var(--overlay-border)] hover:bg-white/10'
                                }`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex gap-3 text-xs text-blue-200 mt-4">
                    <Info className="w-4 h-4 shrink-0" />
                    Changing default currency will strictly affect new users. Existing users retain their settings.
                </div>
            </div>
        </div>

        {/* System Alert Banner */}
        <div className="glass-card p-6 border border-[var(--overlay-border)]">
            <div className="flex items-center gap-2 mb-6 border-b border-[var(--overlay-border)] pb-4">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-bold text-[var(--overlay-text)]">System Alert Banner</h2>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-xs uppercase font-bold text-[var(--text-muted)] mb-2">Global Message (Optional)</label>
                    <textarea 
                        className="w-full h-32 bg-white/5 border border-[var(--overlay-border)] rounded-lg p-4 text-[var(--overlay-text)] text-sm focus:outline-none focus:border-[var(--soft-gold)]"
                        placeholder="Enter a message to display on all user dashboards (e.g. 'Scheduled Maintenance at 02:00 UTC'). Leave empty to disable."
                        value={settings.system_alert_message || ""}
                        onChange={(e) => setSettings({...settings, system_alert_message: e.target.value} as AdminSettings)}
                    />
                </div>
            </div>
        </div>

        {/* Scan Heartbeat (New) */}
        <div className="glass-card p-6 border border-[var(--overlay-border)] md:col-span-2">
            <div className="flex items-center gap-2 mb-6 border-b border-[var(--overlay-border)] pb-4">
                <Activity className="w-5 h-5 text-[var(--soft-gold)]" />
                <h2 className="text-lg font-bold text-[var(--overlay-text)]">Scanning Heartbeat</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                    <label className="block text-xs uppercase font-bold text-[var(--text-muted)] mb-2">Global Scan Interval (Hours)</label>
                    <div className="relative">
                        <input 
                            type="number"
                            min="1"
                            max="720"
                            className="w-full bg-white/5 border border-[var(--overlay-border)] rounded-lg p-3 text-[var(--overlay-text)] focus:outline-none focus:border-[var(--soft-gold)]"
                            value={settings.scan_interval_hours}
                            onChange={(e) => setSettings({...settings, scan_interval_hours: parseInt(e.target.value) || 24} as AdminSettings)}
                        />
                        <Clock className="absolute right-3 top-3 w-4 h-4 text-[var(--text-muted)]" />
                    </div>
                </div>

                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-lg border border-[var(--overlay-border)]">
                        <div className="text-[var(--text-muted)] text-[10px] uppercase font-bold mb-1">Last Global Scan</div>
                        <div className="text-sm font-mono text-[var(--overlay-text)]">
                            {settings.last_global_scan_at ? new Date(settings.last_global_scan_at).toLocaleString() : "Never"}
                        </div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-lg border border-[var(--overlay-border)]">
                        <div className="text-[var(--text-muted)] text-[10px] uppercase font-bold mb-1">Next Global Scan</div>
                        <div className="text-sm font-mono text-optimal-green">
                            {settings.next_global_scan_at ? new Date(settings.next_global_scan_at).toLocaleString() : "TBD"}
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-3 text-xs text-amber-200">
                <Info className="w-4 h-4 shrink-0" />
                Heartbeat scanner runs on a shared pool. It collects unique hotels across all users and executes a batch update to minimize API costs.
            </div>
        </div>

      </div>

      {/* Action Bar */}
      <div className="mt-8 flex justify-end">
        <button
            onClick={handleSave}
            disabled={saving}
            className="btn-gold flex items-center gap-2 px-8 py-3 rounded-xl shadow-lg shadow-[var(--soft-gold)]/20 hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100"
        >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
        </button>
      </div>
    </div>
  );
}
