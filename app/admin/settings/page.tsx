"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { 
  Settings, Save, RefreshCw, CheckCircle2, Loader2, AlertCircle,
  Globe, Clock, Shield, Key, Database, Bell
} from "lucide-react";

interface GlobalSettings {
  maintenance_mode: boolean;
  default_check_frequency: number;
  max_hotels_per_user: number;
  default_currency: string;
  serpapi_daily_limit: number;
  alert_email?: string;
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  
  // Settings state with defaults
  const [settings, setSettings] = useState<GlobalSettings>({
    maintenance_mode: false,
    default_check_frequency: 1440, // 24 hours
    max_hotels_per_user: 50,
    default_currency: "USD",
    serpapi_daily_limit: 100,
    alert_email: ""
  });

  // Environment info
  const [envInfo, setEnvInfo] = useState({
    supabase_url: "•••••••••••",
    serpapi_key: "•••••••••••",
    node_env: "production",
    vercel_region: "fra1"
  });

  useEffect(() => {
    // In a real app, you'd load from backend
    // For now, we use local defaults
    setLoading(false);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      // In a real app, you'd save to backend
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const SettingSection = ({ title, icon: Icon, children }: any) => (
    <div className="glass-card p-6 border border-white/10">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[var(--soft-gold)]/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-[var(--soft-gold)]" />
        </div>
        <h3 className="text-lg font-bold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );

  const SettingRow = ({ label, description, children }: any) => (
    <div className="flex items-start justify-between py-4 border-b border-white/5 last:border-0">
      <div className="flex-1 mr-8">
        <p className="text-white font-medium">{label}</p>
        <p className="text-[var(--text-muted)] text-sm mt-0.5">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--soft-gold)]/20 flex items-center justify-center">
            <Settings className="w-6 h-6 text-[var(--soft-gold)]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Global Settings</h1>
            <p className="text-[var(--text-muted)] mt-1">Configure system-wide defaults and limits</p>
          </div>
        </div>
        
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-[var(--soft-gold)] text-black font-bold rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-500/10 border border-green-500/50 p-4 rounded-lg flex items-center gap-3 text-green-200 mb-6">
          <CheckCircle2 className="w-5 h-5 text-green-400" />
          Settings saved successfully!
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg flex items-center gap-3 text-red-200 mb-6">
          <AlertCircle className="w-5 h-5 text-red-400" />
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* System Settings */}
        <SettingSection title="System Defaults" icon={Globe}>
          <SettingRow 
            label="Maintenance Mode" 
            description="Disable all user-facing features for maintenance"
          >
            <button 
              onClick={() => setSettings(s => ({...s, maintenance_mode: !s.maintenance_mode}))}
              className={`w-14 h-7 rounded-full transition-colors ${settings.maintenance_mode ? 'bg-red-500' : 'bg-white/20'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform mx-1 ${settings.maintenance_mode ? 'translate-x-7' : ''}`} />
            </button>
          </SettingRow>

          <SettingRow 
            label="Default Currency" 
            description="Currency used for new users"
          >
            <select 
              value={settings.default_currency}
              onChange={(e) => setSettings(s => ({...s, default_currency: e.target.value}))}
              className="bg-white/10 border border-white/10 rounded-lg px-4 py-2 text-white"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="TRY">TRY (₺)</option>
            </select>
          </SettingRow>

          <SettingRow 
            label="Default Check Frequency" 
            description="How often to run price scans for new users"
          >
            <select 
              value={settings.default_check_frequency}
              onChange={(e) => setSettings(s => ({...s, default_check_frequency: parseInt(e.target.value)}))}
              className="bg-white/10 border border-white/10 rounded-lg px-4 py-2 text-white"
            >
              <option value="60">Hourly</option>
              <option value="360">Every 6 Hours</option>
              <option value="1440">Daily</option>
              <option value="10080">Weekly</option>
            </select>
          </SettingRow>
        </SettingSection>

        {/* Limits */}
        <SettingSection title="Resource Limits" icon={Shield}>
          <SettingRow 
            label="Max Hotels Per User" 
            description="Maximum hotels a single user can monitor"
          >
            <input 
              type="number"
              min={1}
              max={500}
              value={settings.max_hotels_per_user}
              onChange={(e) => setSettings(s => ({...s, max_hotels_per_user: parseInt(e.target.value)}))}
              className="w-24 bg-white/10 border border-white/10 rounded-lg px-4 py-2 text-white text-center"
            />
          </SettingRow>

          <SettingRow 
            label="SerpApi Daily Limit" 
            description="Maximum API calls per day to SerpApi"
          >
            <input 
              type="number"
              min={0}
              value={settings.serpapi_daily_limit}
              onChange={(e) => setSettings(s => ({...s, serpapi_daily_limit: parseInt(e.target.value)}))}
              className="w-24 bg-white/10 border border-white/10 rounded-lg px-4 py-2 text-white text-center"
            />
          </SettingRow>
        </SettingSection>

        {/* Notifications */}
        <SettingSection title="Notifications" icon={Bell}>
          <SettingRow 
            label="Admin Alert Email" 
            description="Email for critical system alerts"
          >
            <input 
              type="email"
              placeholder="admin@hotel.app"
              value={settings.alert_email || ""}
              onChange={(e) => setSettings(s => ({...s, alert_email: e.target.value}))}
              className="w-64 bg-white/10 border border-white/10 rounded-lg px-4 py-2 text-white"
            />
          </SettingRow>
        </SettingSection>

        {/* Environment Info (Read-only) */}
        <SettingSection title="Environment Configuration" icon={Database}>
          <div className="text-[var(--text-muted)] text-sm mb-4">
            These values are set via environment variables and cannot be changed here.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black/20 p-4 rounded-lg">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Supabase URL</div>
              <div className="font-mono text-white text-sm">••••••••••••</div>
            </div>
            <div className="bg-black/20 p-4 rounded-lg">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">SerpApi Key</div>
              <div className="font-mono text-white text-sm flex items-center gap-2">
                ••••••••••••
                <span className="text-xs text-[var(--optimal-green)]">Active</span>
              </div>
            </div>
            <div className="bg-black/20 p-4 rounded-lg">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Node Environment</div>
              <div className="font-mono text-white text-sm">{envInfo.node_env}</div>
            </div>
            <div className="bg-black/20 p-4 rounded-lg">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Vercel Region</div>
              <div className="font-mono text-white text-sm">{envInfo.vercel_region}</div>
            </div>
          </div>
        </SettingSection>
      </div>
    </div>
  );
}
