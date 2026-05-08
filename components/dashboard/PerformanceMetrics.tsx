"use client";

import { motion } from "framer-motion";
import { Smile, ArrowLeftRight, Zap, Activity, Star } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface PerformanceMetricsProps {
  avgRating?: number;
  rateParityScore?: number;
  loading?: boolean;
}

/**
 * PerformanceMetrics Component
 * Displays key performance indicators with a premium aesthetic.
 */
export function PerformanceMetrics({ avgRating = 0, rateParityScore = 0, loading }: PerformanceMetricsProps) {
  const { t } = useI18n();

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
      {/* Sentiment Score Tile */}
      <motion.div
        variants={itemVariants}
        initial="hidden"
        animate="show"
        className="glass-card p-6 flex flex-col justify-between shadow-xl relative overflow-hidden group border border-[var(--soft-gold)]/10"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--soft-gold)]/5 to-transparent pointer-events-none" />
        
        <div className="relative flex items-center gap-4 mb-4">
          <div className="p-3 rounded-2xl bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 text-[var(--soft-gold)]">
            <Smile className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-[var(--soft-gold)] uppercase tracking-[0.2em] mb-1">
              {t("dashboard.sentimentScore")}
            </p>
            <p className="text-3xl font-black text-[var(--text-primary)] tracking-tighter">
              {loading ? "..." : avgRating.toFixed(1)}
            </p>
          </div>
        </div>

        <div className="relative pt-4 border-t border-[var(--glass-border)] flex items-center justify-between">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star 
                key={s} 
                className={`w-3 h-3 ${s <= Math.round(avgRating) ? 'text-[var(--soft-gold)] fill-[var(--soft-gold)]' : 'text-[var(--text-muted)]'}`} 
              />
            ))}
          </div>
          <span className="text-[10px] text-[var(--text-muted)] uppercase font-black tracking-widest">
            {t("dashboard.verifiedReviews")}
          </span>
        </div>
      </motion.div>

      {/* Rate Parity Tile */}
      <motion.div
        variants={itemVariants}
        initial="hidden"
        animate="show"
        className="glass-card p-6 flex flex-col justify-between shadow-xl relative overflow-hidden group border border-[var(--optimal-green)]/10"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--optimal-green)]/5 to-transparent pointer-events-none" />
        
        <div className="relative flex items-center gap-4 mb-4">
          <div className="p-3 rounded-2xl bg-[var(--optimal-green)]/10 border border-[var(--optimal-green)]/20 text-[var(--optimal-green)]">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-[var(--optimal-green)] uppercase tracking-[0.2em] mb-1">
              {t("dashboard.parityScore")}
            </p>
            <p className="text-3xl font-black text-[var(--text-primary)] tracking-tighter">
              {loading ? "..." : `${rateParityScore}%`}
            </p>
          </div>
        </div>

        <div className="relative pt-4 border-t border-[var(--glass-border)]">
          <div className="w-full bg-[var(--deep-ocean)]/40 h-1.5 rounded-full overflow-hidden border border-[var(--glass-border)]">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: loading ? 0 : `${rateParityScore}%` }}
              className="h-full bg-gradient-to-r from-[var(--optimal-green)] to-emerald-400"
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-widest">0%</span>
            <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-widest">100%</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
