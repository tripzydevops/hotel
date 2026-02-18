"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Settings, Save, Loader2, Info, AlertTriangle, Cloud, ToggleLeft, ToggleRight, DollarSign } from "lucide-react";

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
        default_check_frequency: 144 // Hardcoded for now if backend doesn't support it fully
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
    <div className="max-w-4xl mx-auto py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-[var(--soft-gold)]/20 flex items-center justify-center">
          <Settings className="w-6 h-6 text-[var(--soft-gold)]" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Global Settings</h1>
          <p className="text-[var(--text-muted)] mt-1">Configure system-wide parameters and behavior</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* System Status Card */}
        <div className="glass-card p-6 border border-white/10 md:col-span-2">
            <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
                <Cloud className="w-5 h-5 text-[var(--soft-gold)]" />
                <h2 className="text-lg font-bold text-white">System Status</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5">
                    <div>
                        <div className="font-bold text-white mb-1">Maintenance Mode</div>
                        <div className="text-xs text-[var(--text-muted)]">Disable user access for updates</div>
                    </div>
                    <button 
                        onClick={() => setSettings({...settings, maintenance_mode: !settings.maintenance_mode})}
                        className={`transition-colors ${settings.maintenance_mode ? 'text-[var(--soft-gold)]' : 'text-[var(--text-muted)]'}`}
                    >
                        {settings.maintenance_mode ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                    </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5">
                    <div>
                        <div className="font-bold text-white mb-1">New User Signup</div>
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
        <div className="glass-card p-6 border border-white/10">
            <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
                <DollarSign className="w-5 h-5 text-[var(--soft-gold)]" />
                <h2 className="text-lg font-bold text-white">Market Defaults</h2>
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
                                    : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
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
        <div className="glass-card p-6 border border-white/10">
            <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-bold text-white">System Alert Banner</h2>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-xs uppercase font-bold text-[var(--text-muted)] mb-2">Global Message (Optional)</label>
                    <textarea 
                        className="w-full h-32 bg-white/5 border border-white/10 rounded-lg p-4 text-white text-sm focus:outline-none focus:border-[var(--soft-gold)]"
                        placeholder="Enter a message to display on all user dashboards (e.g. 'Scheduled Maintenance at 02:00 UTC'). Leave empty to disable."
                        value={settings.system_alert_message || ""}
                        onChange={(e) => setSettings({...settings, system_alert_message: e.target.value})}
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
            className="btn-gold flex items-center gap-2 px-8 py-3 rounded-xl shadow-lg shadow-[var(--soft-gold)]/20 hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100"
        >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
        </button>
      </div>
    </div>
  );
}
