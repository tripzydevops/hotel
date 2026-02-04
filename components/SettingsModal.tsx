"use client";

import { useState } from "react";
import {
  X,
  Settings as SettingsIcon,
  Bell,
  TrendingUp,
  Save,
  Zap,
  Target,
  Rss,
  ChevronDown,
} from "lucide-react";
import { UserSettings } from "@/types";
import { useI18n } from "@/lib/i18n";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings?: UserSettings;
  onSave: (settings: UserSettings) => Promise<void>;
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
}: SettingsModalProps) {
  const { t } = useI18n();
  const [threshold, setThreshold] = useState(
    settings?.threshold_percent || 2.0,
  );
  const [frequency, setFrequency] = useState(
    settings?.check_frequency_minutes ?? 0, // Default Manual Only if not set
  );
  const [email, setEmail] = useState(settings?.notification_email || "");
  const [enabled, setEnabled] = useState(
    settings?.notifications_enabled ?? true,
  );
  const [loading, setLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(
    settings?.push_enabled ?? false,
  );

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, "+")
      .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const togglePushNotifications = async (checked: boolean) => {
    if (!checked) {
      setPushEnabled(false);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");

      // Wait for the service worker to be ready (active)
      let sw =
        registration.installing || registration.waiting || registration.active;
      if (sw) {
        if (sw.state !== "activated") {
          await new Promise<void>((resolve) => {
            sw!.addEventListener("statechange", () => {
              if (sw!.state === "activated") resolve();
            });
          });
        }
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        ),
      });

      // Send to backend
      console.log("Push Subscription:", JSON.stringify(subscription));

      // Save to backend immediately
      await onSave({
        ...settings,
        push_enabled: true,
        // @ts-ignore - The types need to be updated in frontend types.ts too
        push_subscription: subscription.toJSON(),
      } as any);

      setPushEnabled(true);
      // Removed alert, will rely on state and potential toast from parent
    } catch (error) {
      console.error("Error subscribing to push:", error);
      setPushEnabled(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setLoading(true);
    try {
      await onSave({
        ...settings,
        threshold_percent: threshold,
        check_frequency_minutes: frequency,
        notification_email: email,
        notifications_enabled: enabled,
        push_enabled: pushEnabled,
      });
      onClose();
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <div className="premium-card w-full max-w-md p-8 shadow-2xl relative overflow-hidden bg-black/40 border-[var(--gold-primary)]/10">
        {/* Silk Glow Aura */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[var(--gold-glow)] opacity-20 blur-[100px] pointer-events-none" />

        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-3 tracking-tighter uppercase">
              <SettingsIcon className="w-6 h-6 text-[var(--gold-primary)]" />
              {t("settings.title")}
            </h2>
            <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.4em] mt-1 ml-9">
              Neural_Configurations
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-white/5 rounded-xl transition-all group"
          >
            <X className="w-5 h-5 text-[var(--text-muted)] group-hover:text-white transition-colors" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Threshold Section */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] flex items-center gap-2 ml-1">
              <TrendingUp className="w-4 h-4 text-[var(--gold-primary)]" />
              {t("settings.triggerThreshold")}
            </label>
            <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-4">
              <div className="flex items-center gap-6">
                <input
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="flex-1 accent-[var(--gold-primary)] h-1 dark:bg-white/10 rounded-full appearance-none cursor-pointer"
                />
                <span className="text-2xl font-black text-[var(--gold-primary)] min-w-[70px] text-right tracking-tighter">
                  {threshold}%
                </span>
              </div>
              <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest font-black opacity-60 leading-relaxed">
                {t("settings.thresholdDesc").replace(
                  "{0}",
                  threshold.toString(),
                )}
              </p>
            </div>
          </div>

          {/* Scan Frequency */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] flex items-center gap-2 ml-1">
              <Target className="w-4 h-4 text-[var(--gold-primary)]" />
              {t("settings.scanFrequency")}
            </label>
            <div className="relative group">
              <select
                className="w-full bg-black/40 border border-[var(--card-border)] rounded-2xl py-3.5 px-4 text-sm text-white focus:outline-none focus:border-[var(--gold-primary)]/50 transition-all font-semibold appearance-none cursor-pointer"
                value={frequency}
                onChange={(e) => setFrequency(parseInt(e.target.value))}
              >
                <option value="0" className="bg-[var(--bg-deep)]">
                  {t("settings.realtime")}
                </option>
                <option value="60" className="bg-[var(--bg-deep)]">
                  {t("settings.hourly")}
                </option>
                <option value="240" className="bg-[var(--bg-deep)]">
                  {t("settings.every4h")}
                </option>
                <option value="720" className="bg-[var(--bg-deep)]">
                  {t("settings.every12h")}
                </option>
                <option value="1440" className="bg-[var(--bg-deep)]">
                  {t("settings.daily")}
                </option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                <ChevronDown size={16} className="text-white" />
              </div>
            </div>
          </div>

          <div className="h-px bg-white/5" />

          {/* Notifications */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black text-[var(--gold-primary)] uppercase tracking-[0.3em] flex items-center gap-2 ml-1">
              <Bell className="w-4 h-4" />
              {t("settings.notificationChannels")}
            </h3>

            <div className="space-y-3">
              {/* Email Toggle */}
              <div
                className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5 group hover:bg-white/[0.08] transition-all"
                onClick={() => setEnabled(!enabled)}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-white uppercase tracking-tight">
                    Quantum_Mail_Alerts
                  </span>
                  <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest font-semibold opacity-60">
                    {t("settings.emailAlerts")}
                  </span>
                </div>
                <div
                  className={`w-10 h-6 rounded-full p-1 transition-all duration-300 ${enabled ? "bg-[var(--gold-gradient)]" : "bg-white/10"}`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${enabled ? "translate-x-4" : "translate-x-0"}`}
                  />
                </div>
              </div>

              {enabled && (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/40 border border-[var(--gold-primary)]/20 rounded-2xl py-3.5 px-5 text-sm text-white focus:outline-none focus:border-[var(--gold-primary)]/50 transition-all font-semibold animate-in slide-in-from-top-2 duration-300"
                  placeholder="name@company.com"
                />
              )}

              {/* Push Toggle */}
              <div
                className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5 group hover:bg-white/[0.08] transition-all"
                onClick={() => togglePushNotifications(!pushEnabled)}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-white uppercase tracking-tight">
                    Direct_Core_Signals
                  </span>
                  <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest font-semibold opacity-60">
                    {t("settings.pushAlerts")}
                  </span>
                </div>
                <div
                  className={`w-10 h-6 rounded-full p-1 transition-all duration-300 ${pushEnabled ? "bg-[var(--gold-gradient)]" : "bg-white/10"}`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${pushEnabled ? "translate-x-4" : "translate-x-0"}`}
                  />
                </div>
              </div>

              {/* WhatsApp (Coming Soon) */}
              <div
                className="flex items-center justify-between bg-white/[0.02] p-4 rounded-2xl border border-white/5 opacity-40 cursor-not-allowed"
                title={t("settings.comingSoon")}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-white uppercase tracking-tight flex items-center gap-2">
                    {t("settings.whatsappAlerts")}
                    <span className="text-[8px] bg-white/10 px-1.5 py-0.5 rounded text-[var(--text-muted)]">
                      OFL
                    </span>
                  </span>
                  <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest font-semibold">
                    Node_Connection_Pending
                  </span>
                </div>
                <div className="w-10 h-6 bg-white/5 rounded-full" />
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-premium py-4 flex items-center justify-center gap-4 group disabled:opacity-30 transition-all"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/40 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4 text-black group-hover:scale-125 transition-transform" />
                  <span className="font-black uppercase tracking-[0.2em] text-sm">
                    {t("settings.savePreferences")}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
