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
 */
export function DashboardHeader({ lastUpdate, onAddHotel, loading }: DashboardHeaderProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4 mb-8">
      <div className="flex items-center gap-3">
        {/* Market Data Status */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden md:flex items-center gap-3 bg-[var(--deep-ocean)]/40 px-4 py-2 rounded-2xl border border-[var(--glass-border)] backdrop-blur-md"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--optimal-green)] shadow-[0_0_10px_var(--optimal-green)]" />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black text-[var(--optimal-green)] uppercase tracking-[0.1em] leading-tight">
                {t("dashboard.marketSynchronized")}
              </span>
              <CheckCircle2 className="w-3 h-3 text-[var(--optimal-green)]" />
            </div>
            {lastUpdate && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                <span className="text-[9px] text-[var(--text-muted)] font-medium">
                  {t("dashboard.dataUpdated")}: {lastUpdate}
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Add Hotel Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onAddHotel}
          className="
            group relative overflow-hidden rounded-xl bg-gradient-to-br from-[var(--soft-gold)] to-[#D4AF37] p-[1px] shadow-xl transition-all
          "
        >
          <div className="relative flex items-center gap-2 bg-[var(--soft-gold)] px-5 py-2.5 rounded-[11px] transition-colors">
            <Plus className="w-4 h-4 text-[var(--deep-ocean)] stroke-[3px]" />
            <span className="font-bold text-[var(--deep-ocean)] text-sm uppercase tracking-widest">
              {t("common.addHotel")}
            </span>
          </div>
        </motion.button>
      </div>
    </div>
  );
}
