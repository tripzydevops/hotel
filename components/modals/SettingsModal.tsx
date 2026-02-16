"use client";

import React, { useState } from "react";
import {
  X,
  Settings as SettingsIcon,
  Bell,
  TrendingUp,
  Save,
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

  // Sync state with props when settings load
  React.useEffect(() => {
    if (settings) {
      setThreshold(settings.threshold_percent || 2.0);
      setFrequency(settings.check_frequency_minutes ?? 0);
      setEmail(settings.notification_email || "");
      setEnabled(settings.notifications_enabled ?? true);
      setPushEnabled(settings.push_enabled ?? false);
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
      });
      onClose();
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--deep-ocean-card)] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--soft-gold)]/10 text-[var(--soft-gold)]">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white">
              {t("settings.title")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 text-[var(--text-muted)] hover:bg-white/10 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--soft-gold)]" />
              {t("settings.triggerThreshold")}
            </label>
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="flex-1 accent-[var(--soft-gold)]"
              />
              <span className="text-lg font-black text-white w-14 text-right">
                {threshold}%
              </span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">
              {t("settings.thresholdDesc").replace("{0}", threshold.toString())}
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-white flex items-center gap-2">
              <SettingsIcon className="w-4 h-4 text-[var(--soft-gold)]" />
              {t("settings.scanFrequency")}
            </label>
            <select
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 text-sm [&>option]:bg-[var(--deep-ocean-card)]"
              value={frequency}
              onChange={(e) => setFrequency(parseInt(e.target.value))}
            >
              <option value="0">{t("settings.realtime")}</option>
              <option value="60">{t("settings.hourly")}</option>
              <option value="240">{t("settings.every4h")}</option>
              <option value="720">{t("settings.every12h")}</option>
              <option value="1440">{t("settings.daily")}</option>
            </select>
          </div>

          <div className="h-px bg-white/10" />

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-[var(--soft-gold)]" />
              {t("settings.notificationChannels")}
            </h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5">
                <span className="text-sm text-[var(--text-secondary)]">
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
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 text-sm"
                  placeholder="name@company.com"
                />
              )}
            </div>

            <div
              className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5 opacity-75 cursor-not-allowed"
              title={t("settings.comingSoon")}
            >
              <span className="text-sm text-[var(--text-secondary)] flex flex-col">
                <span>{t("settings.whatsappAlerts")}</span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {t("settings.comingSoon")}
                </span>
              </span>
              <div className="w-11 h-6 bg-white/10 rounded-full"></div>
            </div>

            <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5">
              <span className="text-sm text-[var(--text-secondary)]">
                {t("settings.pushAlerts")}
              </span>
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
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-gold py-3 flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-[var(--deep-ocean)] border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{t("settings.savePreferences")}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
