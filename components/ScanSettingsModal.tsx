"use client";

import { useState, useEffect } from "react";
import {
  X,
  Calendar,
  Users,
  Play,
  Zap,
  Clock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { ScanOptions } from "@/types";
import { useI18n } from "@/lib/i18n";

interface ScanSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (options: ScanOptions) => Promise<void>;
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
    setLoading(true);
    try {
      const options: ScanOptions = {
        check_in: checkIn || undefined,
        check_out: checkOut || undefined,
        adults: adults,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl transition-all duration-500">
      <div className="premium-card w-full max-w-md p-8 shadow-2xl relative animate-in fade-in zoom-in duration-500 bg-black/40 border-[var(--gold-primary)]/10">
        {/* Silk Glow Aura */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[var(--gold-glow)] opacity-10 blur-[80px] pointer-events-none" />

        <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] border border-[var(--gold-primary)]/10">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tighter uppercase italic leading-none">
                {t("scanSettings.title")}
              </h2>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-widest">
                  Awaiting_Neural_Parameters
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-white/5 rounded-2xl transition-all border border-white/5 text-[var(--text-muted)] hover:text-white"
          >
            <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-[var(--gold-primary)] uppercase tracking-[0.3em] ml-1 opacity-80">
                {t("scanSettings.checkIn")}
              </label>
              <div className="relative group">
                <input
                  type="date"
                  min={today}
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl py-3.5 px-4 text-white font-bold text-xs focus:outline-none focus:border-[var(--gold-primary)]/40 transition-all [color-scheme:dark] shadow-inner"
                />
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-[var(--gold-primary)] uppercase tracking-[0.3em] ml-1 opacity-80">
                {t("scanSettings.checkOut")}
              </label>
              <div className="relative group">
                <input
                  type="date"
                  min={checkIn || today}
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl py-3.5 px-4 text-white font-bold text-xs focus:outline-none focus:border-[var(--gold-primary)]/40 transition-all [color-scheme:dark] shadow-inner"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-[var(--gold-primary)] uppercase tracking-[0.3em] ml-1 opacity-80">
              {t("scanSettings.adults")}
            </label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-white/5 border border-white/10 group-hover:bg-[var(--gold-primary)]/10 transition-colors">
                <Users className="w-4 h-4 text-[var(--gold-primary)]" />
              </div>
              <select
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-16 pr-6 text-white font-bold text-xs focus:outline-none focus:border-[var(--gold-primary)]/40 appearance-none cursor-pointer transition-all shadow-inner"
              >
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <option key={num} value={num} className="bg-[var(--bg-deep)]">
                    {t("scanSettings.adultCount")
                      .replace("{0}", num.toString())
                      .replace("{1}", num > 1 ? "s" : "")}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity">
                <Zap className="w-3 h-3 text-[var(--gold-primary)]" />
              </div>
            </div>
          </div>

          <div className="pt-6 space-y-4">
            <button
              type="submit"
              disabled={loading}
              className="btn-premium w-full py-5 flex items-center justify-center gap-4 group/btn relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
              {loading ? (
                <div className="w-6 h-6 border-4 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Play className="w-5 h-5 text-black relative z-10 animate-pulse fill-current" />
                  <span className="font-black uppercase tracking-[0.3em] text-black relative z-10">
                    {t("scanSettings.startScan")}
                  </span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-3 animate-pulse opacity-40">
              <ShieldCheck className="w-3 h-3 text-[var(--gold-primary)]" />
              <p className="text-[8px] font-black text-white uppercase tracking-[0.3em]">
                Secure_Scanning Protocol_Active
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
