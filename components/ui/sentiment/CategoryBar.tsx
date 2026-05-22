"use client";

import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";

/**
 * ── CategoryBar ──
 * Enhanced comparison bar showing how a category score stacks against the leader and market average.
 * Bars are thicker (6px), gradient-filled, and color-coded based on performance vs market.
 * Green = above market, Amber = at market, Red = below market.
 */
export const CategoryBar = ({
  category,
  myScore,
  leaderScore,
  marketAvg,
  leaderName,
}: {
  category: string;
  myScore: number;
  leaderScore: number;
  marketAvg: number;
  leaderName?: string;
}) => {
  const { t } = useI18n();
  const categoryKey = category.toLowerCase();
  const localizedCategory =
    t(`sentiment.${categoryKey}`) !== `sentiment.${categoryKey}`
      ? t(`sentiment.${categoryKey}`)
      : category;

  // Fixed color for My Hotel (Blue gradient)
  const getBarGradient = () => {
    if (myScore <= 0) return "from-gray-700/50 to-gray-600/30";
    return "from-blue-500 to-blue-400";
  };

  return (
    <div className="flex flex-col">
      {/* Header: Category name + Score */}
      <div className="flex justify-between items-end mb-3">
        <span className="text-sm font-bold text-slate-800 dark:text-gray-400">
          {localizedCategory}
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-black text-slate-900 dark:text-white">
            {myScore > 0 ? myScore.toFixed(2) : "N/A"}
          </span>
          <span className="text-[10px] text-gray-600 font-semibold">/ 5.0</span>
        </div>
      </div>

      {/* My Hotel bar — thick with gradient fill */}
      <div className="h-[6px] bg-white/[0.06] rounded-full overflow-hidden relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(Math.max(myScore, 0.5) / 5) * 100}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          className={`h-full rounded-full bg-gradient-to-r ${getBarGradient()} relative group`}
        >
          {/* Tooltip on hover */}
          {myScore > 0 && (
            <div className="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-900/95 backdrop-blur-sm text-slate-900 dark:text-white text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap z-10 border border-slate-200 dark:border-[var(--overlay-border)] shadow-md">
              {t("sentiment.myHotel")}: {myScore.toFixed(2)}
            </div>
          )}
        </motion.div>
      </div>

      {/* Comparison rows: Leader + Market Average */}
      <div className="mt-2.5 space-y-1.5">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-800 dark:text-gray-500 w-24 truncate font-medium">
            {leaderName || t("sentiment.leader")}
          </span>
          <div className="flex-1 h-[4px] bg-[var(--bg-accent)] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(leaderScore / 5) * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
              className="h-full bg-gradient-to-r from-amber-500/80 to-amber-400/60 rounded-full"
            />
          </div>
          <span className="text-[11px] text-amber-400/80 font-bold w-8 text-right">
            {leaderScore.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-800 dark:text-gray-500 w-24 font-medium">
            {t("sentiment.avgComp")}
          </span>
          <div className="flex-1 h-[4px] bg-[var(--bg-accent)] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(marketAvg / 5) * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
              className="h-full bg-gradient-to-r from-gray-500/60 to-gray-400/40 rounded-full"
            />
          </div>
          <span className="text-[11px] text-gray-400 w-8 text-right">
            {marketAvg.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};
