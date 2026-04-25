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

  const [currency, setCurrency] = useState(settings?.currency || "USD");
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

  // Sync state with props when settings load
  React.useEffect(() => {
    if (settings) {
      setThreshold(settings.threshold_percent || 2.0);
      setCurrency(settings.currency || "USD");
      setEmail(settings.notification_email || "");
      setEnabled(settings.notifications_enabled ?? true);
      setPushEnabled(settings.push_enabled ?? false);
      setDynamicEnabled(settings.dynamic_threshold_enabled ?? false);
      setSensitivity(settings.dynamic_threshold_sensitivity ?? 1.0);
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
        currency,
        notification_email: email,
        notifications_enabled: enabled,
        push_enabled: pushEnabled,
        dynamic_threshold_enabled: dynamicEnabled,
        dynamic_threshold_sensitivity: sensitivity,
      });
      onClose();
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md transition-all duration-300">
      <div className="bg-[var(--deep-ocean-card)] border border-[var(--overlay-border)] rounded-2xl w-full max-w-2xl p-0 shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--overlay-border)] bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] shadow-inner">
              <SettingsIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--overlay-text)] leading-none mb-1">
                {t("settings.title")}
              </h2>
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold">
                Configure your strategic monitoring
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--overlay-text)] transition-all ring-1 ring-white/10 hover:ring-white/20"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Left Column: Monitoring */}
              <div className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-[var(--soft-gold)] uppercase tracking-[0.2em] flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Monitoring Logic
                  </h3>
                  
                  <div className="space-y-6">
                    {/* Threshold */}
                    <div className="space-y-4 p-5 rounded-2xl bg-white/5 border border-[var(--overlay-border)] shadow-inner">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-[var(--overlay-text)]/90 flex items-center gap-2">
                          {t("settings.triggerThreshold")}
                        </label>
                        <span className="text-lg font-black text-[var(--soft-gold)] tabular-nums">
                          {threshold}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="10"
                        step="0.1"
                        value={threshold}
                        onChange={(e) => setThreshold(parseFloat(e.target.value))}
                        className="w-full accent-[var(--soft-gold)] h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer hover:bg-white/20 transition-all"
                      />
                      <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                        {t("settings.thresholdDesc").replace("{0}", threshold.toString())}
                      </p>
                    </div>

                    {/* Currency Selection */}
                    <div className="space-y-4 p-5 rounded-2xl bg-white/5 border border-[var(--overlay-border)] shadow-inner">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-[var(--overlay-text)]/90 flex items-center gap-2">
                          <Globe className="w-4 h-4 text-[var(--soft-gold)]" />
                          Display Currency
                        </label>
                        <span className="text-xs font-black text-[var(--soft-gold)] uppercase">
                          {currency}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-2">
                        {["USD", "EUR", "TRY", "GBP"].map((curr) => (
                          <button
                            key={curr}
                            type="button"
                            onClick={() => setCurrency(curr)}
                            className={`py-2 px-1 rounded-xl text-[10px] font-black transition-all border ${
                              currency === curr
                                ? "bg-[var(--soft-gold)]/20 border-[var(--soft-gold)] text-[var(--soft-gold)] shadow-[0_0_15px_rgba(234,179,8,0.1)]"
                                : "bg-white/5 border-white/5 text-[var(--text-muted)] hover:bg-white/10"
                            }`}
                          >
                            {curr}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] leading-relaxed italic">
                        Real-time exchange rates are applied to all market intelligence and pricing analytics.
                      </p>
                    </div>
                  </div>
                </div>

                {/* AI Smarts */}
                <div className="space-y-4 p-5 rounded-2xl bg-[var(--soft-gold)]/5 border border-[var(--soft-gold)]/20 animate-in fade-in duration-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-[var(--overlay-text)] flex items-center gap-2">
                         AI Smart Thresholds
                      </h4>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold mt-1">
                        Dynamic Volatility Filter
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dynamicEnabled}
                        onChange={(e) => setDynamicEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--soft-gold)]"></div>
                    </label>
                  </div>

                  {dynamicEnabled && (
                    <div className="space-y-4 pt-2 animate-in slide-in-from-top-2">
                      <div className="h-px bg-white/10" />
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-[var(--overlay-text)]/60">
                        <span>Analysis Sensitivity</span>
                        <span className="text-[var(--soft-gold)]">{sensitivity}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={sensitivity}
                        onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                        className="w-full accent-[var(--soft-gold)] h-1"
                      />
                      <p className="text-[9px] text-[var(--text-muted)] leading-relaxed italic border-l-2 border-[var(--soft-gold)]/30 pl-3">
                        Higher sensitivity auto-suppresses alerts during "Market Noise" periods (holidays, city-wide events) to prevent fatigue.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Notifications */}
              <div className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-[var(--soft-gold)] uppercase tracking-[0.2em] flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5" />
                    Alert Protocols
                  </h3>

                  <div className="space-y-4">
                    {/* Email Alerts */}
                    <div className="p-5 rounded-2xl bg-white/5 border border-[var(--overlay-border)] space-y-4 hover:border-[var(--overlay-border)] transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-[var(--overlay-text)]/90">
                          {t("settings.emailAlerts")}
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) => setEnabled(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--soft-gold)]"></div>
                        </label>
                      </div>
                      {enabled && (
                        <div className="animate-in fade-in slide-in-from-top-1">
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-black/20 border border-[var(--overlay-border)] rounded-xl py-3 px-4 text-[var(--overlay-text)] placeholder:text-[var(--overlay-text)]/20 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 text-sm"
                            placeholder="alerts@yourhotel.com"
                          />
                        </div>
                      )}
                    </div>

                    {/* Push Alerts */}
                    <div className="p-5 rounded-2xl bg-white/5 border border-[var(--overlay-border)] flex items-center justify-between hover:border-[var(--overlay-border)] transition-colors">
                      <div>
                        <span className="text-sm font-semibold text-[var(--overlay-text)]/90">
                          {t("settings.pushAlerts")}
                        </span>
                        <p className="text-[10px] text-[var(--text-muted)] mt-1">Direct OS notifications</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pushEnabled}
                          onChange={(e) => togglePushNotifications(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--soft-gold)]"></div>
                      </label>
                    </div>

                    {/* WhatsApp Alerts (Coming Soon) */}
                    <div className="p-5 rounded-2xl bg-white/5 border border-[var(--overlay-border)] flex items-center justify-between opacity-50 grayscale select-none">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-[var(--overlay-text)]/90">{t("settings.whatsappAlerts")}</span>
                        <span className="text-[10px] font-black text-[var(--soft-gold)] uppercase tracking-tighter mt-1">
                           Enterprise Only
                        </span>
                      </div>
                      <div className="w-11 h-6 bg-white/5 rounded-full border border-[var(--overlay-border)]"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-[var(--overlay-border)] bg-black/20 flex gap-4 mt-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3.5 rounded-xl border border-[var(--overlay-border)] text-[var(--overlay-text)] text-sm font-bold hover:bg-white/5 transition-all"
            >
              Discard Changes
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] btn-gold py-3.5 flex items-center justify-center gap-3 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-x-full group-hover:translate-x-0 transition-transform duration-500 skew-x-12" />
              {loading ? (
                <div className="w-5 h-5 border-2 border-[var(--deep-ocean)] border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4 shadow-sm" />
                  <span className="relative z-10">{t("settings.savePreferences")}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
