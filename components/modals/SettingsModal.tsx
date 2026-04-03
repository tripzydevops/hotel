"use client";

import React, { useState } from "react";
import {
  X,
  Settings as SettingsIcon,
  Bell,
  TrendingUp,
  Save,
  Globe,
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
    settings?.check_frequency_minutes ?? 0,
  );
  const [email, setEmail] = useState(settings?.notification_email || "");
  const [enabled, setEnabled] = useState(
    settings?.notifications_enabled ?? true,
  );
  const [loading, setLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(
    settings?.push_enabled ?? false,
  );
  const [dynamicEnabled, setDynamicEnabled] = useState(
    settings?.dynamic_threshold_enabled ?? false,
  );
  const [sensitivity, setSensitivity] = useState(
    settings?.dynamic_threshold_sensitivity ?? 1.0,
  );
  const [currency, setCurrency] = useState(settings?.currency || "TRY");

  // Sync state with props when settings load
  React.useEffect(() => {
    if (settings) {
      setThreshold(settings.threshold_percent || 2.0);
      setFrequency(settings.check_frequency_minutes ?? 0);
      setEmail(settings.notification_email || "");
      setEnabled(settings.notifications_enabled ?? true);
      setPushEnabled(settings.push_enabled ?? false);
      setDynamicEnabled(settings.dynamic_threshold_enabled ?? false);
      setSensitivity(settings.dynamic_threshold_sensitivity ?? 1.0);
      setCurrency(settings.currency || "TRY");
    }
  }, [settings]);

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
      const sw =
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
      alert(t("settings.pushEnabled"));
    } catch (error) {
      console.error("Error subscribing to push:", error);
      alert("Failed to enable push. " + error);
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
        dynamic_threshold_enabled: dynamicEnabled,
        dynamic_threshold_sensitivity: sensitivity,
        currency: currency,
      });
      onClose();
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="glass-modal w-full max-w-md max-h-[min(90vh,750px)] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[var(--glass-border)] flex items-center justify-between shrink-0 bg-[var(--glass-bg-accent)]">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] shadow-inner">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
                {t("settings.title")}
              </h2>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] font-black mt-0.5">
                SYSTEM PREFERENCES & ALERTS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--glass-bg-accent)] rounded-lg transition-all hover:rotate-90 group"
          >
            <X className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          <form className="space-y-8">
            {/* Threshold Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--soft-gold)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  {t("settings.triggerThreshold")}
                </h3>
              </div>
              <div className="bg-[var(--glass-bg-accent)] p-5 rounded-2xl border border-[var(--glass-border)] space-y-4">
                <div className="flex items-end justify-between">
                  <div className="space-y-1">
                    <span className="text-3xl font-black text-[var(--soft-gold)]">
                      {threshold}%
                    </span>
                    <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest font-black">
                      CURRENT SENSITIVITY
                    </p>
                  </div>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[var(--soft-gold)]"
                />
                <p className="text-[10px] text-[var(--text-muted)] leading-relaxed italic">
                  {t("settings.thresholdDesc").replace("{0}", threshold.toString())}
                </p>
              </div>
            </div>

            {/* AI Smart Thresholds */}
            <div className="p-5 rounded-2xl bg-[var(--glass-bg-accent)] border border-[var(--glass-border)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-[var(--text-primary)]">AI Smart Thresholds</span>
                  <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-tight">Market Noise Cancellation</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dynamicEnabled}
                    onChange={(e) => setDynamicEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-transparent after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--soft-gold)] shadow-inner"></div>
                </label>
              </div>

              {dynamicEnabled && (
                <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between">
                    <label className="tactical-label">SENSITIVITY MULTIPLIER</label>
                    <span className="text-xs font-black text-[var(--soft-gold)] px-2 py-0.5 bg-[var(--soft-gold)]/10 rounded-full">{sensitivity}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={sensitivity}
                    onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[var(--soft-gold)]"
                  />
                  <p className="text-[10px] text-[var(--text-muted)] leading-relaxed bg-black/20 p-3 rounded-lg border border-white/5">
                    Advanced algorithms will filter out minor rate fluctuations caused by OTA caching or currency rounding.
                  </p>
                </div>
              )}
            </div>

            {/* Scan Frequency */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <SettingsIcon className="w-4 h-4 text-[var(--soft-gold)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  {t("settings.scanFrequency")}
                </h3>
              </div>
              <div className="relative group">
                <select
                  className="w-full bg-[var(--glass-bg-accent)] border border-[var(--glass-border)] rounded-xl py-4 px-5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--soft-gold)] font-bold transition-all appearance-none cursor-pointer shadow-sm"
                  value={frequency}
                  onChange={(e) => setFrequency(parseInt(e.target.value))}
                >
                  <option value="0" className="bg-[var(--deep-ocean-lighter)] font-medium p-4">{t("settings.realtime")}</option>
                  <option value="60" className="bg-[var(--deep-ocean-lighter)] font-medium p-4">{t("settings.hourly")}</option>
                  <option value="240" className="bg-[var(--deep-ocean-lighter)] font-medium p-4">{t("settings.every4h")}</option>
                  <option value="720" className="bg-[var(--deep-ocean-lighter)] font-medium p-4">{t("settings.every12h")}</option>
                  <option value="1440" className="bg-[var(--deep-ocean-lighter)] font-medium p-4">{t("settings.daily")}</option>
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)] group-hover:text-[var(--soft-gold)] transition-colors">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                </div>
              </div>
            </div>

            {/* Notifications Section */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[var(--soft-gold)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  {t("settings.notificationChannels")}
                </h3>
              </div>

              <div className="space-y-3">
                {/* Email Toggle */}
                <div className="flex items-center justify-between bg-[var(--glass-bg-accent)] p-4 rounded-xl border border-[var(--glass-border)]">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-[var(--text-primary)]">{t("settings.emailAlerts")}</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-tight">Primary Channel</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-transparent after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--soft-gold)] shadow-inner"></div>
                  </label>
                </div>
                {enabled && (
                  <div className="relative animate-in slide-in-from-top-1 duration-200">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[var(--glass-bg-accent)] border border-[var(--glass-border)] rounded-xl py-3.5 px-4 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/30 focus:outline-none focus:border-[var(--soft-gold)] font-medium text-sm transition-all shadow-sm"
                      placeholder="name@company.com"
                    />
                  </div>
                )}

                {/* Push Toggle */}
                <div className="flex items-center justify-between bg-[var(--glass-bg-accent)] p-4 rounded-xl border border-[var(--glass-border)]">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-[var(--text-primary)]">{t("settings.pushAlerts")}</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-tight">Browser Notifications</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pushEnabled}
                      onChange={(e) => togglePushNotifications(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-transparent after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--soft-gold)] shadow-inner"></div>
                  </label>
                </div>

                {/* WhatsApp Disabled */}
                <div className="flex items-center justify-between bg-black/20 p-4 rounded-xl border border-white/5 opacity-40 grayscale-[0.5] cursor-not-allowed">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-[var(--text-primary)]">{t("settings.whatsappAlerts")}</span>
                    <span className="text-[10px] text-[var(--soft-gold)] font-black uppercase tracking-wider">{t("settings.comingSoon")}</span>
                  </div>
                  <div className="w-11 h-6 bg-white/5 rounded-full ring-1 ring-white/5"></div>
                </div>
              </div>
            </div>

            {/* Regional Section */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[var(--soft-gold)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  {t("settings.regionalDisplay")}
                </h3>
              </div>
              <div className="bg-[var(--glass-bg-accent)] p-5 rounded-2xl border border-[var(--glass-border)] space-y-4">
                <div className="space-y-2">
                  <label className="tactical-label ml-1">{t("settings.preferredCurrency")}</label>
                  <div className="relative group">
                    <select
                      className="w-full bg-black/20 border border-[var(--glass-border)] rounded-xl py-3.5 px-4 text-[var(--text-primary)] focus:outline-none focus:border-[var(--soft-gold)] font-bold transition-all appearance-none cursor-pointer"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                    >
                      <option value="TRY" className="bg-[var(--deep-ocean-lighter)] font-medium">TRY (₺)</option>
                      <option value="USD" className="bg-[var(--deep-ocean-lighter)] font-medium">USD ($)</option>
                      <option value="EUR" className="bg-[var(--deep-ocean-lighter)] font-medium">EUR (€)</option>
                      <option value="GBP" className="bg-[var(--deep-ocean-lighter)] font-medium">GBP (£)</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)] group-hover:text-[var(--soft-gold)] transition-colors">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-[var(--text-muted)] leading-relaxed italic bg-white/5 p-3 rounded-lg border border-white/5">
                  {t("settings.currencyDesc")}
                </p>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[var(--glass-border)] bg-[var(--glass-bg-accent)] shrink-0">
          <button
            onClick={(e) => handleSubmit(e as any)}
            disabled={loading}
            className="w-full btn-premium py-4 flex items-center justify-center gap-3 group shadow-[0_15px_40px_rgba(212,175,55,0.15)] active:scale-[0.98]"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-3 border-deep-ocean border-t-transparent rounded-full animate-spin" />
                <span className="uppercase tracking-widest font-black text-xs">Processing...</span>
              </div>
            ) : (
              <>
                <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-black uppercase tracking-[0.2em]">{t("settings.savePreferences")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
