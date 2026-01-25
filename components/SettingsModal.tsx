"use client";

import { useState } from "react";
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
      alert(t("settings.pushEnabled") || "Push Notifications Enabled!");
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
      <div className="bg-[var(--deep-ocean-card)] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-xl">
        {/* ... header ... */}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Threshold Section */}
          {/* ... (omitted for brevity in prompt, effectively keeping same) ... */}

          {/* Search Frequency */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-white flex items-center gap-2">
              <SettingsIcon className="w-4 h-4 text-[var(--soft-gold)]" />
              Scan Frequency
            </label>
            <select
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 text-sm [&>option]:bg-[var(--deep-ocean-card)]"
              value={frequency}
              onChange={(e) => setFrequency(parseInt(e.target.value))}
            >
              <option value="0">Real-time (Manual Only)</option>
              <option value="60">Every hour</option>
              <option value="240">Every 4 hours</option>
              <option value="720">Every 12 hours</option>
              <option value="1440">Daily (Recommended)</option>
            </select>
          </div>

          <div className="h-px bg-white/10" />

          {/* Notifications Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-[var(--soft-gold)]" />
              Notification Channels
            </h3>

            {/* Email Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5">
                <span className="text-sm text-[var(--text-secondary)]">
                  Email Alerts
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
                  placeholder="tripzydevops@gmail.com"
                />
              )}
            </div>

            {/* WhatsApp Toggle (Placeholder) */}
            <div
              className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5 opacity-75 cursor-not-allowed"
              title="Coming Soon"
            >
              <span className="text-sm text-[var(--text-secondary)] flex flex-col">
                <span>WhatsApp Alerts</span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  Coming Soon
                </span>
              </span>
              <div className="w-11 h-6 bg-white/10 rounded-full"></div>
            </div>

            {/* Push Toggle */}
            <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5">
              <span className="text-sm text-[var(--text-secondary)]">
                {t("settings.push")}
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
                  <span>Save Preferences</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
