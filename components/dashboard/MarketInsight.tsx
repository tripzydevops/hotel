"use client";

import { motion } from "framer-motion";
import { Sparkles, Info } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface MarketInsightProps {
  insight?: string;
  loading?: boolean;
}

/**
 * MarketInsight Component
 * Displays AI-generated market intelligence insights with a premium aesthetic.
 */
export function MarketInsight({ insight, loading }: MarketInsightProps) {
  const { t } = useI18n();

  if (!insight && !loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6 rounded-[2.5rem] relative overflow-hidden group border border-[var(--soft-gold)]/20"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--soft-gold)]/5 to-transparent pointer-events-none" />
      
      <div className="relative flex items-start gap-4">
        <div className="p-3 rounded-2xl bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 text-[var(--soft-gold)]">
          <Sparkles className="w-6 h-6 animate-pulse" />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black text-[var(--soft-gold)] uppercase tracking-[0.2em]">
              {t("dashboard.aiInsight")}
            </h3>
            <div className="flex items-center gap-1 text-[var(--text-muted)]">
              <Info className="w-3 h-3" />
              <span className="text-[10px] font-medium uppercase tracking-tighter">
                {t("dashboard.liveAnalysis")}
              </span>
            </div>
          </div>
          
          {loading ? (
            <div className="space-y-2">
              <div className="h-4 bg-[var(--glass-border)] rounded-full w-full animate-pulse" />
              <div className="h-4 bg-[var(--glass-border)] rounded-full w-3/4 animate-pulse" />
            </div>
          ) : (
            <p className="text-[var(--text-primary)] text-sm leading-relaxed font-medium">
              {insight}
            </p>
          )}
        </div>
      </div>

      <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-[var(--soft-gold)]/5 rounded-full blur-3xl group-hover:bg-[var(--soft-gold)]/10 transition-colors duration-700" />
    </motion.div>
  );
}
