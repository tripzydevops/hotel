"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Users, Play } from "lucide-react";
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
  const [checkIn, setCheckIn] = useState(initialValues?.checkIn || "");
  const [checkOut, setCheckOut] = useState(initialValues?.checkOut || "");
  const [adults, setAdults] = useState(initialValues?.adults || 2);

  useEffect(() => {
    if (isOpen && initialValues) {
      setCheckIn(initialValues.checkIn || "");
      setCheckOut(initialValues.checkOut || "");
      setAdults(initialValues.adults || 2);
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-gold py-3 flex items-center justify-center gap-2 group hover:scale-[1.02] transition-transform"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-[var(--deep-ocean)] border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
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
