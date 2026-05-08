"use client";

import { motion } from "framer-motion";
import { Plus, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface DashboardHeaderProps {
  lastUpdate?: string;
  onAddHotel: () => void;
  onRefresh?: () => void;
  loading?: boolean;
}

/**
 * DashboardHeader Component
 * Manages the top-level actions and market synchronization status.
 */
export function DashboardHeader({ lastUpdate, onAddHotel, onRefresh, loading }: DashboardHeaderProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4 mb-8">
      <div className="flex items-center gap-3">
        {/* Market Data Status */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden md:flex items-center gap-3 bg-[var(--deep-ocean)]/40 px-4 py-2 rounded-[2.5rem] border border-[var(--glass-border)] backdrop-blur-md"
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

        {/* Actions */}
        <button 
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--deep-ocean)] text-[var(--text-main)] rounded-full text-xs font-bold tracking-widest uppercase border border-[var(--glass-border)] transition-all duration-300"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{t("common.refresh")}</span>
        </button>

        <button 
          onClick={onAddHotel}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[var(--soft-gold)] to-[#D4AF37] text-[var(--deep-ocean)] rounded-full text-xs font-black tracking-widest uppercase shadow-[0_10px_20px_-5px_rgba(212,175,55,0.3)] transition-all duration-300"
        >
          <Plus className="w-4 h-4" />
          <span>{t("dashboard.addHotel")}</span>
        </button>
      </div>
    </div>
  );
}
