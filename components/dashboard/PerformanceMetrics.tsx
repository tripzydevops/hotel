"use client";

import { motion } from "framer-motion";
import { Smile, ArrowLeftRight, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface PerformanceMetricsProps {
  avgRating?: number;
  rateParityScore?: number;
  loading?: boolean;
}

/**
 * PerformanceMetrics Component
 * Displays key performance indicators like Sentiment Score and Rate Parity.
 * Responsive mobile-first layout.
 */
export function PerformanceMetrics({ avgRating = 0, rateParityScore = 0, loading }: PerformanceMetricsProps) {
  const { t } = useI18n();

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    show: { opacity: 1, scale: 1 }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full"
    >
      {/* Sentiment Score Tile */}
      <motion.div variants={itemVariants} className="h-full">
        <div className="h-full rounded-2xl sm:rounded-[2.5rem] bg-[var(--deep-ocean)]/40 border border-[#D4AF37]/20 p-4 sm:p-6 flex flex-col justify-between shadow-lg relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--soft-gold)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative flex items-center gap-3.5 sm:gap-4">
            <div className="p-2.5 sm:p-3 rounded-2xl bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 shrink-0">
              <Smile className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--soft-gold)]" />
            </div>
            <div>
              <p className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] mb-0.5 sm:mb-1">
                {t("dashboard.sentimentScore")}
              </p>
              <p className="text-2xl sm:text-3xl font-black text-[var(--overlay-text)] tracking-tighter">
                {loading ? "..." : (avgRating || 0).toFixed(1)}
              </p>
            </div>
          </div>
          <div className="relative mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-[var(--overlay-border)] flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-muted-foreground)] uppercase font-black tracking-widest">
              {t("dashboard.verified")}
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <div 
                  key={s} 
                  className={`w-1 h-3 rounded-full ${s <= Math.round(avgRating) ? 'bg-[var(--soft-gold)]' : 'bg-[var(--bg-subtle)]'}`} 
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Rate Parity Tile */}
      <motion.div variants={itemVariants} className="h-full">
        <div className="h-full rounded-2xl sm:rounded-[2.5rem] bg-[var(--deep-ocean)]/40 border border-[#D4AF37]/20 p-4 sm:p-6 flex flex-col justify-between shadow-lg relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative flex items-center gap-3.5 sm:gap-4">
            <div className="p-2.5 sm:p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 shrink-0">
              <ArrowLeftRight className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-0.5 sm:mb-1">
                {t("dashboard.rateParity")}
              </p>
              <p className="text-2xl sm:text-3xl font-black text-[var(--overlay-text)] tracking-tighter">
                {loading ? "..." : `${rateParityScore || 0}%`}
              </p>
            </div>
          </div>
          <div className="relative mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-[var(--overlay-border)] flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-muted-foreground)] uppercase font-black tracking-widest">
              {t("dashboard.healthIndex")}
            </span>
            <div className="w-20 sm:w-24 h-1.5 bg-[var(--bg-subtle)] rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: loading ? "0%" : `${rateParityScore}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-blue-400"
              />
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
