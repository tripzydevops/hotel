"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { api } from "@/lib/api";
import { UserSettings } from "@/types";
import { useI18n } from "@/lib/i18n";
import CommandLayout from "@/components/layout/CommandLayout";
import {
  Settings as SettingsIcon,
  Bell,
  TrendingUp,
  Save,
  Target,
  ChevronDown,
  Globe,
  Mail,
  Smartphone,
} from "lucide-react";
import { useToast } from "@/components/ui/ToastContext";

export default function SettingsPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
        const [userProfile, userSettings] = await Promise.all([
          api.getProfile(session.user.id),
          api.getSettings(session.user.id),
        ]);
        setProfile(userProfile);
        setSettings(userSettings);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !settings) return;
    setSaving(true);
    try {
      await api.updateSettings(userId, settings);
      toast.success(
        t("settings.saveSuccess") || "Settings saved successfully.",
      );
    } catch (error) {
      console.error("Save error:", error);
      toast.error(t("settings.saveError") || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--gold-primary)]"></div>
      </div>
    );
  }

  return (
    <CommandLayout userProfile={profile} activeRoute="settings">
      <div className="max-w-4xl">
        <div className="flex flex-col mb-12">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-2xl bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] border border-[var(--gold-primary)]/20 shadow-2xl">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--gold-primary)] opacity-80 mb-1">
                System_Configuration
              </span>
              <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">
                SETTINGS
              </h1>
            </div>
          </div>
          <p className="text-[var(--text-muted)] text-sm font-bold uppercase tracking-tight opacity-60 border-l-2 border-[var(--gold-primary)]/20 pl-6">
            Configure your data thresholds, frequency, and alert distribution
            nodes.
          </p>
        </div>

        <form
          onSubmit={handleSave}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8"
        >
          {/* Rate Alerts Configuration */}
          <div className="premium-card p-10 bg-black/40 border border-white/5 relative overflow-hidden group">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-[var(--gold-primary)]">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black text-white italic tracking-tight uppercase">
                Rate Alerts
              </h3>
            </div>

            <div className="space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em]">
                  Trigger Threshold
                </label>
                <div className="bg-black/20 p-6 rounded-2xl border border-white/5 space-y-4">
                  <input
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={settings?.threshold_percent || 2}
                    onChange={(e) =>
                      setSettings((s) =>
                        s
                          ? {
                              ...s,
                              threshold_percent: parseFloat(e.target.value),
                            }
                          : null,
                      )
                    }
                    className="w-full accent-[var(--gold-primary)] h-1 rounded-full appearance-none cursor-pointer bg-white/10"
                  />
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest opacity-60">
                      Sensitivity Level
                    </span>
                    <span className="text-2xl font-black text-[var(--gold-primary)] tracking-tighter">
                      {settings?.threshold_percent || 2}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em]">
                  Scan Frequency
                </label>
                <div className="relative group/select">
                  <select
                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-sm text-white font-black uppercase tracking-tight appearance-none cursor-pointer focus:border-[var(--gold-primary)]/40 outline-none transition-all"
                    value={settings?.check_frequency_minutes || 0}
                    onChange={(e) =>
                      setSettings((s) =>
                        s
                          ? {
                              ...s,
                              check_frequency_minutes: parseInt(e.target.value),
                            }
                          : null,
                      )
                    }
                  >
                    <option value="0">Real-Time (Manual)</option>
                    <option value="60">Hourly Sync</option>
                    <option value="240">Every 4 Hours</option>
                    <option value="1440">Daily Audit</option>
                  </select>
                  <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--gold-primary)] pointer-events-none group-hover/select:translate-y-[-40%] transition-transform" />
                </div>
              </div>
            </div>
          </div>

          {/* Alert Distribution Configuration */}
          <div className="premium-card p-10 bg-black/40 border border-white/5 relative overflow-hidden group">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-[var(--gold-primary)]">
                <Bell className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black text-white italic tracking-tight uppercase">
                Distributions
              </h3>
            </div>

            <div className="space-y-6">
              {/* Email Alerts */}
              <div
                className={`p-6 rounded-3xl border transition-all cursor-pointer flex items-center justify-between ${settings?.notifications_enabled ? "bg-[var(--gold-primary)]/5 border-[var(--gold-primary)]/20 shadow-lg" : "bg-white/5 border-white/5 opacity-60"}`}
                onClick={() =>
                  setSettings((s) =>
                    s
                      ? {
                          ...s,
                          notifications_enabled: !s.notifications_enabled,
                        }
                      : null,
                  )
                }
              >
                <div className="flex items-center gap-4">
                  <Mail
                    className={`w-5 h-5 ${settings?.notifications_enabled ? "text-[var(--gold-primary)]" : "text-[var(--text-muted)]"}`}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-white uppercase tracking-tight italic">
                      Email Updates
                    </span>
                    <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-1">
                      Direct to Inbox
                    </span>
                  </div>
                </div>
                <div
                  className={`w-10 h-6 rounded-full p-1 transition-all ${settings?.notifications_enabled ? "bg-[var(--gold-gradient)]" : "bg-white/10"}`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transform transition-transform ${settings?.notifications_enabled ? "translate-x-4" : "translate-x-0"}`}
                  />
                </div>
              </div>

              {settings?.notifications_enabled && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <input
                    type="email"
                    value={settings?.notification_email || ""}
                    onChange={(e) =>
                      setSettings((s) =>
                        s ? { ...s, notification_email: e.target.value } : null,
                      )
                    }
                    placeholder="Enter alert email..."
                    className="w-full bg-black/60 border border-[var(--gold-primary)]/20 rounded-2xl py-4 px-6 text-sm text-white font-bold outline-none focus:border-[var(--gold-primary)]/50 transition-all"
                  />
                </div>
              )}

              {/* Push Alerts */}
              <div
                className={`p-6 rounded-3xl border transition-all cursor-pointer flex items-center justify-between ${settings?.push_enabled ? "bg-[var(--gold-primary)]/5 border-[var(--gold-primary)]/20 shadow-lg" : "bg-white/5 border-white/5 opacity-60"}`}
                onClick={() =>
                  setSettings((s) =>
                    s ? { ...s, push_enabled: !s.push_enabled } : null,
                  )
                }
              >
                <div className="flex items-center gap-4">
                  <Smartphone
                    className={`w-5 h-5 ${settings?.push_enabled ? "text-[var(--gold-primary)]" : "text-[var(--text-muted)]"}`}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-white uppercase tracking-tight italic">
                      Push Signals
                    </span>
                    <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-1">
                      Browser Notifications
                    </span>
                  </div>
                </div>
                <div
                  className={`w-10 h-6 rounded-full p-1 transition-all ${settings?.push_enabled ? "bg-[var(--gold-gradient)]" : "bg-white/10"}`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transform transition-transform ${settings?.push_enabled ? "translate-x-4" : "translate-x-0"}`}
                  />
                </div>
              </div>

              {/* Currency */}
              <div className="space-y-4 pt-4">
                <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[var(--gold-primary)]" />
                  Primary Currency
                </label>
                <div className="relative group/select">
                  <select
                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-sm text-white font-black uppercase tracking-tight appearance-none cursor-pointer focus:border-[var(--gold-primary)]/40 outline-none transition-all"
                    value={settings?.currency || "TRY"}
                    onChange={(e) =>
                      setSettings((s) =>
                        s ? { ...s, currency: e.target.value } : null,
                      )
                    }
                  >
                    <option value="TRY">Turkish Lira (TRY)</option>
                    <option value="USD">US Dollar (USD)</option>
                    <option value="EUR">Euro (EUR)</option>
                    <option value="GBP">British Pound (GBP)</option>
                  </select>
                  <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--gold-primary)] pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 pt-8">
            <button
              type="submit"
              disabled={saving}
              className="btn-premium w-full py-6 flex items-center justify-center gap-4 group disabled:opacity-30 active:scale-95 transition-all shadow-2xl"
            >
              {saving ? (
                <div className="w-6 h-6 border-2 border-black/40 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5 text-black group-hover:scale-125 transition-transform" />
                  <span className="text-sm font-black uppercase tracking-[0.4em] text-black">
                    COMMIT_PREFERENCES
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </CommandLayout>
  );
}
