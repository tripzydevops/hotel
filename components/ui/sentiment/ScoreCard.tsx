"use client";

import { motion } from "framer-motion";
import { Star, TrendingUp, TrendingDown } from "lucide-react";
import { getCurrencySymbol } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

/* ── Stagger animation variants ── */
const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0, 0, 0.58, 1] as const },
  },
};

/**
 * ── ScoreCard ──
 * Premium glass card displaying hotel rank, rating, and price.
 * Target hotel gets an animated gradient border + glow effect.
 * Competitors get a subtle glass panel with hover elevation.
 */
export const ScoreCard = ({
  hotel,
  rank,
  isTarget,
  currency = "USD",
  index = 0,
}: {
  hotel: any;
  rank: string;
  isTarget?: boolean;
  currency?: string;
  index?: number;
}) => {
  const { t } = useI18n();

  // Color-coded rating indicator ring (green > blue > amber > red)
  const getRatingColor = (rating: number) => {
    if (rating >= 4.5)
      return {
        text: "text-emerald-400",
        ring: "ring-emerald-500/30",
        bg: "bg-emerald-500/10",
      };
    if (rating >= 4.0)
      return {
        text: "text-sky-400",
        ring: "ring-sky-500/30",
        bg: "bg-sky-500/10",
      };
    if (rating >= 3.5)
      return {
        text: "text-amber-400",
        ring: "ring-amber-500/30",
        bg: "bg-amber-500/10",
      };
    return {
      text: "text-red-400",
      ring: "ring-red-500/30",
      bg: "bg-red-500/10",
    };
  };
  const ratingStyle = getRatingColor(hotel.rating || 0);

  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`relative rounded-2xl border transition-all duration-300 group overflow-hidden cursor-default ${
        isTarget
          ? "bg-gradient-to-br from-blue-950/80 via-indigo-950/60 to-slate-900/80 backdrop-blur-xl border-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.12),0_8px_32px_rgba(0,0,0,0.3)]"
          : "bg-[var(--bg-accent)] backdrop-blur-lg border-[var(--glass-border)] hover:border-white/15 hover:bg-white/[0.06] hover:shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
      }`}
    >
      {/* Animated gradient border shimmer for target hotel */}
      {isTarget && (
        <div
          className="absolute inset-0 rounded-2xl opacity-40 pointer-events-none"
          style={{
            background:
              "linear-gradient(135deg, rgba(59,130,246,0.3) 0%, transparent 40%, transparent 60%, rgba(99,102,241,0.3) 100%)",
          }}
        />
      )}

      <div className="relative p-5">
        {/* Header: Label + Rank Badge */}
        <div className="flex justify-between items-start mb-5">
          <div className="flex flex-col gap-1">
            <span
              className={`text-[10px] font-semibold uppercase tracking-[0.15em] ${
                isTarget
                  ? "text-blue-600 dark:text-blue-400/80"
                  : "text-slate-700 dark:text-gray-500"
              }`}
            >
              {isTarget ? t("sentiment.myHotel") : t("sentiment.competitor")}
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[140px]">
              {hotel.name}
            </h3>
          </div>
          <div
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
              isTarget
                ? "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300"
                : "bg-[var(--bg-subtle)] border-[var(--glass-border)] text-slate-800 dark:text-gray-400"
            }`}
          >
            {rank}
          </div>
        </div>

        {/* Metrics: Rating (with color ring) + Price */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-800 dark:text-gray-500 mb-2 font-medium">
              {t("sentiment.overallRating")}
            </span>
            <div className="flex items-center gap-2.5">
              <div
                className={`w-11 h-11 rounded-xl ${ratingStyle.bg} ring-2 ${ratingStyle.ring} flex items-center justify-center`}
              >
                <span className={`text-lg font-black ${ratingStyle.text}`}>
                  {(Number(hotel.rating) || 0).toFixed(1)}
                </span>
              </div>
              <span className="text-[10px] text-slate-700 dark:text-gray-500 font-semibold">
                / 5.0
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[11px] text-slate-800 dark:text-gray-500 mb-2 font-medium">
              {t("sentiment.currentPrice")}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                {hotel.price_info?.current_price
                  ? hotel.price_info.current_price.toLocaleString()
                  : "N/A"}
              </span>
              {hotel.price_info?.current_price && (
                <span className="text-[10px] text-gray-500 font-bold">
                  {getCurrencySymbol(currency || "USD")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer: Review count + Price change */}
        <div className="mt-4 pt-3.5 border-t border-[var(--glass-border)] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-700 dark:text-gray-500">
            <Star className="w-3 h-3 text-amber-500/70" />
            <span className="font-medium">
              {(hotel.review_count || 0).toLocaleString()} reviews
            </span>
          </div>
          {hotel.price_info?.price_change_percent !== undefined && (
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                hotel.price_info.price_change_percent > 0
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {hotel.price_info.price_change_percent > 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {Math.abs(hotel.price_info.price_change_percent)}%
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
