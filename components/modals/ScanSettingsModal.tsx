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

  // Helper: format a Date to YYYY-MM-DD using local time
  const toDateStr = (d: Date) =>
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0");

  const today = new Date();
  const todayStr = toDateStr(today);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = toDateStr(tomorrow);

  const [checkIn, setCheckIn] = useState(initialValues?.checkIn || todayStr);
  const [checkOut, setCheckOut] = useState(
    initialValues?.checkOut || tomorrowStr,
  );
  const [adults, setAdults] = useState(initialValues?.adults || 2);
  const [currency, setCurrency] = useState("TRY");
  const isEnterprise = userPlan === "enterprise" || userPlan === "trial" || userPlan === "pro";

  useEffect(() => {
    if (!isOpen) return;
    if (initialValues?.checkIn) {
      setCheckIn(initialValues.checkIn);
      // Use provided checkout only if it's strictly after checkin
      const coDate = initialValues.checkOut ? new Date(initialValues.checkOut) : null;
      const ciDate = new Date(initialValues.checkIn);
      if (coDate && coDate > ciDate) {
        setCheckOut(initialValues.checkOut!);
      } else {
        const next = new Date(ciDate);
        next.setDate(next.getDate() + 1);
        setCheckOut(toDateStr(next));
      }
    } else {
      // No defaults provided — always reset to today/tomorrow
      setCheckIn(todayStr);
      setCheckOut(tomorrowStr);
    }
    if (initialValues?.adults) setAdults(initialValues.adults);
  }, [isOpen, initialValues]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance checkout when user picks a check-in >= current checkout
  const handleCheckInChange = (newCheckIn: string) => {
    setCheckIn(newCheckIn);
    if (checkOut <= newCheckIn) {
      const next = new Date(newCheckIn);
      next.setDate(next.getDate() + 1);
      setCheckOut(toDateStr(next));
    }
  };

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="glass-modal w-full max-w-sm shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[var(--glass-border)] flex items-center justify-between shrink-0 bg-[var(--glass-bg-accent)]">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] shadow-inner">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
                {t("scanSettings.title")}
              </h2>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] font-black mt-0.5">
                ON-DEMAND INTELLIGENCE
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

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Global Limit Alerts */}
          {(!isEnterprise || dailyLimitReached) && (
            <div className="p-4 rounded-2xl bg-[var(--soft-gold)]/5 border border-[var(--soft-gold)]/20 animate-in slide-in-from-top-2 duration-300 shadow-sm">
              <div className="flex gap-4">
                <div className="p-2 rounded-xl bg-[var(--soft-gold)]/10 h-fit ring-1 ring-[var(--soft-gold)]/20">
                  {dailyLimitReached ? (
                    <Clock className="w-4 h-4 text-[var(--soft-gold)]" />
                  ) : (
                    <Lock className="w-4 h-4 text-[var(--soft-gold)]" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex flex-col">
                    <h4 className="text-xs font-black text-[var(--soft-gold)] uppercase tracking-widest leading-tight">
                      {dailyLimitReached
                        ? "Scan Limit Reached"
                        : "Premium Feature"}
                    </h4>
                    <span className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-tight">Access Restricted</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] leading-relaxed italic border-l-2 border-[var(--soft-gold)]/30 pl-3">
                    {dailyLimitReached
                      ? "Your daily manual intelligence allowance is exhausted. Upgrade for unlimited scans."
                      : "Deeper market analysis requires an Enterprise subscription tier."}
                  </p>
                  <button
                    onClick={onUpgrade}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[var(--soft-gold)] text-deep-ocean rounded-lg text-[10px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-md shadow-[var(--soft-gold)]/10 group"
                  >
                    Upgrade Now
                    <Play className="w-2 h-2 fill-current transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className={`space-y-6 transition-all duration-500 ${(!isEnterprise || dailyLimitReached) ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="tactical-label ml-1">{t("scanSettings.checkIn")}</label>
                <div className="relative group">
                  <input
                    type="date"
                    min={todayStr}
                    value={checkIn}
                    onChange={(e) => handleCheckInChange(e.target.value)}
                    className="w-full bg-[var(--glass-bg-accent)] border border-[var(--glass-border)] rounded-xl py-3 px-4 text-[var(--text-primary)] focus:outline-none focus:border-[var(--soft-gold)] font-bold text-xs transition-all shadow-sm [color-scheme:dark]"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="tactical-label ml-1">{t("scanSettings.checkOut")}</label>
                <div className="relative group">
                  <input
                    type="date"
                    min={checkIn || todayStr}
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full bg-[var(--glass-bg-accent)] border border-[var(--glass-border)] rounded-xl py-3 px-4 text-[var(--text-primary)] focus:outline-none focus:border-[var(--soft-gold)] font-bold text-xs transition-all shadow-sm [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="tactical-label ml-1">{t("scanSettings.adults")}</label>
                <div className="relative group">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--soft-gold)] transition-colors pointer-events-none" />
                  <select
                    value={adults}
                    onChange={(e) => setAdults(Number(e.target.value))}
                    className="w-full bg-[var(--glass-bg-accent)] border border-[var(--glass-border)] rounded-xl py-3.5 pl-11 pr-4 text-[var(--text-primary)] focus:outline-none focus:border-[var(--soft-gold)] font-bold text-xs transition-all appearance-none cursor-pointer shadow-sm"
                  >
                    {[1, 2, 3, 4].map((num) => (
                      <option key={num} value={num} className="bg-[var(--deep-ocean-lighter)]">
                        {t("scanSettings.adultCount")
                          .replace("{0}", num.toString())
                          .replace("{1}", num > 1 ? "s" : "")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="tactical-label ml-1">Currency</label>
                <div className="relative group">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--soft-gold)] transition-colors pointer-events-none" />
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-[var(--glass-bg-accent)] border border-[var(--glass-border)] rounded-xl py-3.5 pl-11 pr-4 text-[var(--text-primary)] focus:outline-none focus:border-[var(--soft-gold)] font-bold text-xs transition-all appearance-none cursor-pointer shadow-sm"
                  >
                    <option value="USD" className="bg-[var(--deep-ocean-lighter)]">USD ($)</option>
                    <option value="EUR" className="bg-[var(--deep-ocean-lighter)]">EUR (€)</option>
                    <option value="TRY" className="bg-[var(--deep-ocean-lighter)]">TRY (₺)</option>
                    <option value="GBP" className="bg-[var(--deep-ocean-lighter)]">GBP (£)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !isEnterprise || dailyLimitReached}
                className="w-full btn-premium py-4 flex items-center justify-center gap-3 group shadow-[0_15px_40px_rgba(212,175,55,0.15)] active:scale-[0.98]"
              >
                {loading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-3 border-deep-ocean border-t-transparent rounded-full animate-spin" />
                    <span className="uppercase tracking-widest font-black text-xs">Scanning...</span>
                  </div>
                ) : (
                  <>
                    {!isEnterprise || dailyLimitReached ? (
                      <Lock className="w-5 h-5 text-deep-ocean/50" />
                    ) : (
                      <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />
                    )}
                    <span className="text-sm font-black uppercase tracking-[0.2em]">{t("scanSettings.startScan")}</span>
                  </>
                )}
              </button>
              <div className="mt-4 flex flex-col items-center gap-1">
                <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-tight">
                  {t("scanSettings.defaultDatesNote")}
                </p>
                <div className="w-8 h-1 bg-[var(--soft-gold)]/20 rounded-full" />
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
