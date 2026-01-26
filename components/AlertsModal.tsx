"use client";

import { useState, useEffect } from "react";
import { X, Bell, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Alert } from "@/types";
import { useI18n } from "@/lib/i18n";

interface AlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onUpdate: () => void;
}

export default function AlertsModal({
  isOpen,
  onClose,
  userId,
  onUpdate,
}: AlertsModalProps) {
  const { t } = useI18n();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      loadAlerts();
    }
  }, [isOpen, userId]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await api.getAlerts(userId);
      setAlerts(data);
    } catch (error) {
      console.error("Failed to load alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (alertId: string) => {
    try {
      await api.markAlertRead(alertId);
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a)),
      );
      onUpdate();
    } catch (error) {
      console.error("Failed to mark alert as read:", error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const unread = alerts.filter((a) => !a.is_read);
      await Promise.all(unread.map((a) => api.markAlertRead(a.id)));
      setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
      onUpdate();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md transition-all duration-300">
      <div className="bg-[var(--deep-ocean-card)] border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--soft-gold)]/10 text-[var(--soft-gold)]">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white leading-tight">
                {t("alerts.title")}
              </h2>
              <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)]">
                {t("alerts.subtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {alerts.some((a) => !a.is_read) && (
              <button
                onClick={handleMarkAllRead}
                className="text-[10px] font-black text-[var(--soft-gold)] uppercase tracking-widest hover:brightness-125 transition-all mr-2"
              >
                {t("alerts.clearAll")}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors"
            >
              <X className="w-5 h-5 text-[var(--text-muted)] hover:text-white" />
            </button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-2 scrollbar-thin">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <div className="w-8 h-8 border-2 border-[var(--soft-gold)] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest">
                {t("alerts.loading")}
              </p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-[var(--optimal-green)]/40" />
              </div>
              <p className="text-white font-black text-sm mb-1 uppercase tracking-wider">
                {t("alerts.emptyTitle")}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {t("alerts.emptyDesc")}
              </p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border transition-all duration-300 ${
                  alert.is_read
                    ? "bg-white/[0.02] border-white/5 opacity-60"
                    : "bg-white/[0.05] border-[var(--soft-gold)]/20 shadow-lg shadow-[var(--soft-gold)]/5"
                }`}
              >
                <div className="flex justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-[0.2em] ${
                          alert.alert_type === "competitor_undercut"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-[var(--soft-gold)]/20 text-[var(--soft-gold)]"
                        }`}
                      >
                        {alert.alert_type === "competitor_undercut"
                          ? t("alerts.undercut")
                          : t("alerts.priceChange")}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] font-bold">
                        {new Date(alert.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-white mb-3">
                      {alert.message}
                    </p>
                    {alert.old_price && alert.new_price && (
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <span className="text-[8px] uppercase font-black text-[var(--text-muted)]">
                            {t("alerts.previous")}
                          </span>
                          <span className="text-xs font-bold text-white/40 line-through">
                            {alert.currency === "TRY"
                              ? "₺"
                              : alert.currency === "EUR"
                                ? "€"
                                : alert.currency === "GBP"
                                  ? "£"
                                  : "$"}
                            {alert.old_price.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-4 h-[1px] bg-white/10 mt-2" />
                        <div className="flex flex-col">
                          <span className="text-[8px] uppercase font-black text-[var(--text-muted)]">
                            {t("alerts.current")}
                          </span>
                          <span className="text-sm font-black text-[var(--soft-gold)]">
                            {alert.currency === "TRY"
                              ? "₺"
                              : alert.currency === "EUR"
                                ? "€"
                                : alert.currency === "GBP"
                                  ? "£"
                                  : "$"}
                            {alert.new_price.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  {!alert.is_read && (
                    <button
                      onClick={() => handleMarkAsRead(alert.id)}
                      className="h-fit p-2 hover:bg-white/10 rounded-lg text-[var(--text-muted)] hover:text-white transition-colors"
                      title={t("alerts.markAsRead")}
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
          <button
            onClick={onClose}
            className="btn-gold px-8 py-3 text-xs font-black uppercase tracking-widest"
          >
            {t("common.dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}
