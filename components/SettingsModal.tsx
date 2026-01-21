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
  const [threshold, setThreshold] = useState(
    settings?.threshold_percent || 2.0,
  );
  const [email, setEmail] = useState(settings?.notification_email || "");
  const [enabled, setEnabled] = useState(
    settings?.notifications_enabled ?? true,
  );
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        threshold_percent: threshold,
        check_frequency_minutes: 144, // Default (approx every 2.4 hours)
        notification_email: email,
        notifications_enabled: enabled,
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
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-[var(--soft-gold)]" />
            Alert Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-[var(--text-muted)] hover:text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Threshold Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--soft-gold)]" />
                Price Change Threshold
              </label>
              <span className="text-[var(--soft-gold)] font-bold">
                {threshold}%
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="20"
              step="0.5"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[var(--soft-gold)]"
            />
            <p className="text-xs text-[var(--text-muted)]">
              Notify me when a hotel's price changes by {threshold}% or more.
            </p>
          </div>

          <div className="h-px bg-white/10" />

            {/* Search Frequency */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-white flex items-center gap-2">
                <SettingsIcon className="w-4 h-4 text-[var(--soft-gold)]" />
                Scan Frequency
              </label>
              <select
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 text-sm [&>option]:bg-[var(--deep-ocean-card)]"
                defaultValue="144"
              >
                <option value="0">Real-time (Manual Only)</option>
                <option value="60">Every hour</option>
                <option value="240">Every 4 hours (Recommended)</option>
                <option value="1440">Daily</option>
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
                  <span className="text-sm text-[var(--text-secondary)]">Email Alerts</span>
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
                    placeholder="admin@tripzy.travel"
                  />
                )}
              </div>

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

              {/* Push Toggle (Placeholder) */}
              <div
                className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5 opacity-75 cursor-not-allowed"
                title="Coming Soon"
              >
                <span className="text-sm text-[var(--text-secondary)] flex flex-col">
                  <span>Device Push Notifications</span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    Coming Soon
                  </span>
                </span>
                <div className="w-11 h-6 bg-white/10 rounded-full"></div>
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
