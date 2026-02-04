"use client";

import { useState, useEffect } from "react";
import { X, Bell, CheckCircle, Zap, ShieldAlert, Target } from "lucide-react";
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl transition-all duration-500">
      <div className="premium-card w-full max-w-lg p-8 shadow-2xl relative overflow-hidden bg-black/40 border-[var(--gold-primary)]/10">
        {/* Silk Glow Aura */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[var(--gold-glow)] opacity-20 blur-[100px] pointer-events-none" />

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-[var(--gold-primary)]/20 blur-lg rounded-full animate-pulse" />
              <div className="relative p-2.5 rounded-xl bg-black/40 border border-[var(--gold-primary)]/20 text-[var(--gold-primary)]">
                <Bell className="w-6 h-6" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tighter uppercase leading-none">
                {t("alerts.title")}
              </h2>
              <p className="text-[9px] font-black text-[var(--gold-primary)] uppercase tracking-[0.4em] mt-2 opacity-60">
                System_Neural_Notifications
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {alerts.some((a) => !a.is_read) && (
              <button
                onClick={handleMarkAllRead}
                className="text-[10px] font-black text-[var(--gold-primary)] uppercase tracking-[0.2em] hover:text-white transition-all underline underline-offset-4"
              >
                {t("alerts.clearAll")}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2.5 hover:bg-white/5 rounded-xl transition-all group"
            >
              <X className="w-5 h-5 text-[var(--text-muted)] group-hover:text-white transition-colors" />
            </button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-3 custom-scrollbar">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-2 border-[var(--gold-primary)]/20 border-t-[var(--gold-primary)] rounded-full animate-spin" />
              <p className="text-[8px] font-black text-[var(--gold-primary)] uppercase tracking-widest">
                Async_Synchronizing...
              </p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-emerald-500/10 blur-2xl rounded-full" />
                <div className="relative w-20 h-20 rounded-full bg-black/40 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-emerald-500/40" />
                </div>
              </div>
              <p className="text-white font-black text-lg mb-2 uppercase tracking-tighter">
                {t("alerts.emptyTitle")}
              </p>
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold opacity-60">
                {t("alerts.emptyDesc")}
              </p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`group relative p-5 rounded-2xl border transition-all duration-500 ${
                  alert.is_read
                    ? "bg-black/20 border-white/5 opacity-40 hover:opacity-80"
                    : "bg-white/[0.03] border-[var(--gold-primary)]/20 shadow-[0_0_20px_rgba(212,175,55,0.05)]"
                }`}
              >
                <div className="flex justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className={`text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-[0.2em] border ${
                          alert.alert_type === "competitor_undercut"
                            ? "bg-red-500/10 text-red-500 border-red-500/20"
                            : "bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] border-[var(--gold-primary)]/20"
                        }`}
                      >
                        {alert.alert_type === "competitor_undercut"
                          ? "Critical_Undercut"
                          : "Yield_Signal"}
                      </span>
                      <span className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest opacity-40">
                        {new Date(alert.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <p className="text-sm font-bold text-white mb-4 leading-snug group-hover:text-[var(--gold-primary)] transition-colors">
                      {alert.message}
                    </p>

                    {alert.old_price && alert.new_price && (
                      <div className="flex items-center gap-4 bg-black/40 p-3 rounded-xl border border-white/5">
                        <div className="flex flex-col">
                          <span className="text-[8px] uppercase font-black text-[var(--text-muted)] tracking-widest opacity-40 mb-1">
                            Baseline
                          </span>
                          <span className="text-xs font-bold text-white/40 line-through">
                            {api.formatCurrency(
                              alert.old_price,
                              alert.currency,
                            )}
                          </span>
                        </div>
                        <Target className="w-4 h-4 text-white/10" />
                        <div className="flex flex-col">
                          <span className="text-[8px] uppercase font-black text-[var(--gold-primary)] tracking-widest mb-1">
                            New_Target
                          </span>
                          <span className="text-sm font-black text-[var(--gold-primary)] tracking-tighter">
                            {api.formatCurrency(
                              alert.new_price,
                              alert.currency,
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  {!alert.is_read && (
                    <button
                      onClick={() => handleMarkAsRead(alert.id)}
                      className="h-fit p-2.5 bg-white/5 hover:bg-[var(--gold-primary)] hover:text-black rounded-xl transition-all shadow-xl group/btn"
                      title={t("alerts.markAsRead")}
                    >
                      <Zap className="w-4 h-4 group-hover/btn:scale-125 transition-transform" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-white/5 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="btn-premium px-10 py-4 text-xs font-black uppercase tracking-[0.2em]"
          >
            {t("common.dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}
