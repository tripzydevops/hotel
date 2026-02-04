"use client";

import { useState, useEffect } from "react";
import {
  X,
  Calendar,
  Users,
  Play,
  Lock,
  Globe,
  DollarSign,
  Clock,
} from "lucide-react";
import { ScanOptions } from "@/types";
import { useI18n } from "@/lib/i18n";

interface ScanSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (options: ScanOptions) => Promise<void>;
  onUpgrade?: () => void;
  userPlan?: string; // "starter" | "pro" | "enterprise"
  dailyLimitReached?: boolean;
  initialValues?: {
    checkIn?: string;
    checkOut?: string;
    adults?: number;
  };
}

export default function ScanSettingsModal({
  isOpen,
  onClose,
  onScan,
  onUpgrade,
  userPlan = "starter",
  dailyLimitReached = false,
  initialValues,
}: ScanSettingsModalProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const [checkIn, setCheckIn] = useState(initialValues?.checkIn || todayStr);
  const [checkOut, setCheckOut] = useState(
    initialValues?.checkOut || tomorrowStr,
  );
  const [adults, setAdults] = useState(initialValues?.adults || 2);
  const [currency, setCurrency] = useState("USD");
  const isEnterprise = userPlan === "enterprise";

  useEffect(() => {
    if (isOpen && initialValues) {
      if (initialValues.checkIn) setCheckIn(initialValues.checkIn);
      if (initialValues.checkOut) setCheckOut(initialValues.checkOut);
      if (initialValues.adults) setAdults(initialValues.adults);
    }
  }, [isOpen, initialValues]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEnterprise || dailyLimitReached) return;
    setLoading(true);
    try {
      const options: ScanOptions = {
        check_in: checkIn || undefined,
        check_out: checkOut || undefined,
        adults: adults,
        currency: currency,
      };
      await onScan(options);
      onClose();
    } catch (error) {
      console.error("Scan failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--deep-ocean-card)] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[var(--soft-gold)]" />
            {t("scanSettings.title")}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-[var(--text-muted)] hover:text-white" />
          </button>
        </div>

        {/* Global Limit Alerts */}
        {(!isEnterprise || dailyLimitReached) && (
          <div className="mb-6 p-4 rounded-xl bg-[var(--soft-gold)]/5 border border-[var(--soft-gold)]/20 animate-in slide-in-from-top-2 duration-300">
            <div className="flex gap-3">
              <div className="p-2 rounded-lg bg-[var(--soft-gold)]/10 h-fit">
                {dailyLimitReached ? (
                  <Clock className="w-4 h-4 text-[var(--soft-gold)]" />
                ) : (
                  <Lock className="w-4 h-4 text-[var(--soft-gold)]" />
                )}
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-[var(--soft-gold)] uppercase tracking-widest mb-1">
                  {dailyLimitReached
                    ? "Daily Limit Reached"
                    : "Upgrade Required"}
                </h4>
                <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                  {dailyLimitReached
                    ? "You've used your manual scan for today. Upgrade to increase your limit."
                    : "Manual scans are restricted to Enterprise plans for deep market analysis."}
                </p>
                <button
                  onClick={onUpgrade}
                  className="mt-3 text-[10px] font-black text-[var(--soft-gold)] uppercase tracking-tighter hover:brightness-125 transition-all flex items-center gap-1 group"
                >
                  Explore Enterprise Plans
                  <Play className="w-2 h-2 fill-current transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-4 opacity-100 transition-opacity"
        >
          <div
            className={
              !isEnterprise || dailyLimitReached
                ? "opacity-40 pointer-events-none grayscale-[0.5]"
                : ""
            }
          >
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 uppercase tracking-wider">
                  {t("scanSettings.checkIn")}
                </label>
                <input
                  type="date"
                  min={today}
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 text-sm [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 uppercase tracking-wider">
                  {t("scanSettings.checkOut")}
                </label>
                <input
                  type="date"
                  min={checkIn || today}
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 text-sm [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 uppercase tracking-wider">
                  {t("scanSettings.adults")}
                </label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <select
                    value={adults}
                    onChange={(e) => setAdults(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 text-sm [&>option]:bg-[var(--deep-ocean-card)] appearance-none"
                  >
                    {[1, 2, 3, 4].map((num) => (
                      <option key={num} value={num}>
                        {t("scanSettings.adultCount")
                          .replace("{0}", num.toString())
                          .replace("{1}", num > 1 ? "s" : "")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 uppercase tracking-wider">
                  Currency
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 text-sm [&>option]:bg-[var(--deep-ocean-card)] appearance-none"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="TRY">TRY (₺)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading || !isEnterprise || dailyLimitReached}
              className={`w-full py-3 flex items-center justify-center gap-2 group transition-all rounded-xl font-bold uppercase tracking-widest text-xs
                ${
                  !isEnterprise || dailyLimitReached
                    ? "bg-white/5 text-white/20 cursor-not-allowed border border-white/5"
                    : "btn-gold hover:scale-[1.02] active:scale-95 shadow-lg shadow-[var(--soft-gold)]/20"
                }
              `}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-[var(--deep-ocean)] border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {!isEnterprise || dailyLimitReached ? (
                    <Lock className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                  <span>{t("scanSettings.startScan")}</span>
                </>
              )}
            </button>
            <p className="text-center text-[10px] text-[var(--text-muted)] mt-2">
              {t("scanSettings.defaultDatesNote")}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
