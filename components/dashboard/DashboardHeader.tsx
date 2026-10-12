"use client";

import { motion } from "framer-motion";
import { Plus, CheckCircle2, Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface DashboardHeaderProps {
  lastUpdate?: string;
  onAddHotel: () => void;
  loading?: boolean;
}

/**
 * DashboardHeader Component
 * Manages the top-level actions and market synchronization status.
 * Responsive mobile-first design.
 */
export function DashboardHeader({ lastUpdate, onAddHotel, loading }: DashboardHeaderProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 sm:mb-8">
      {/* Market Data Status (Visible on both mobile and desktop) */}
      <motion.div 
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2.5 bg-[var(--deep-ocean)]/40 px-3.5 py-2 rounded-2xl border border-[var(--glass-border)] backdrop-blur-md self-start sm:self-auto"
      >
        <div className="w-2.5 h-2.5 rounded-full bg-[var(--optimal-green)] shadow-[0_0_10px_var(--optimal-green)] shrink-0 animate-pulse" />
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black text-[var(--optimal-green)] uppercase tracking-[0.1em] leading-tight">
              {t("dashboard.marketSynchronized")}
            </span>
            <CheckCircle2 className="w-3 h-3 text-[var(--optimal-green)] shrink-0" />
          </div>
          {lastUpdate && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Clock className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
              <span className="text-[9px] text-[var(--text-muted)] font-medium">
                {t("dashboard.dataUpdated")}: {lastUpdate}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Add Hotel Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onAddHotel}
        className="
          group relative overflow-hidden rounded-xl bg-gradient-to-br from-[var(--soft-gold)] to-[#D4AF37] p-[1px] shadow-xl transition-all w-full sm:w-auto
        "
      >
        <div className="relative flex items-center justify-center gap-2 bg-[var(--soft-gold)] px-4 sm:px-5 py-2.5 rounded-[11px] transition-colors">
          <Plus className="w-4 h-4 text-[var(--deep-ocean)] stroke-[3px]" />
          <span className="font-bold text-[var(--deep-ocean)] text-xs sm:text-sm uppercase tracking-widest">
            {t("common.addHotel")}
          </span>
        </div>
      </motion.button>
    </div>
  );
}
