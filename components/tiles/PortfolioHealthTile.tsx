"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Activity, ShieldCheck, TrendingUp, AlertTriangle, TrendingDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface PortfolioHealthTileProps {
  targetPrice: number;
  competitors: Array<{
    id: string;
    name: string;
    price_info?: {
      current_price: number;
      currency: string;
    };
  }>;
}

export default function PortfolioHealthTile({
  targetPrice,
  competitors,
}: PortfolioHealthTileProps) {
  const { t, locale } = useI18n();
  const stats = useMemo(() => {
    if (!targetPrice || !competitors.length) return { score: 0, winningRate: 0, parityStatus: "Unknown", gap: "0" };

    const validCompetitors = competitors.filter(c => c.price_info && c.price_info.current_price > 0);
    if (!validCompetitors.length) return { score: 0, winningRate: 0, parityStatus: "No Data", gap: "0" };

    const winningCount = validCompetitors.filter(c => targetPrice < (c.price_info?.current_price || 0)).length;
    const winningRate = (winningCount / validCompetitors.length) * 100;

    const avgRivalPrice = validCompetitors.reduce((sum, c) => sum + (c.price_info?.current_price || 0), 0) / validCompetitors.length;
    const gap = ((avgRivalPrice - targetPrice) / targetPrice) * 100;

    let parityStatus = "Balanced";
    let score = 70; // Base score

    if (gap > 10) {
      parityStatus = "Aggressive";
      score = 90 + Math.min(gap/10, 10);
    } else if (gap < -10) {
      parityStatus = "Yield Risk";
      score = 40 + Math.max(gap/2, -30);
    } else if (gap > 0) {
      parityStatus = "Competitive";
      score = 75 + gap;
    } else {
      parityStatus = "Under Pressure";
      score = 60 + gap;
    }

    return {
      score: Math.min(Math.max(Math.round(score), 0), 100),
      winningRate: Math.round(winningRate),
      parityStatus,
      gap: gap.toFixed(1),
    };
  }, [targetPrice, competitors]);

  const getScoreColor = (score: number) => {
    if (score >= 85) return "#10b981"; // emerald-500
    if (score >= 65) return "#F6C344"; // brand gold
    if (score >= 45) return "#f59e0b"; // amber-500
    return "#ef4444"; // rose-500
  };

  const scoreColor = getScoreColor(stats.score);

  return (
    <div className="card-blur rounded-[2rem] p-8 border border-white/5 h-full relative overflow-hidden group">
      {/* Background Decorative Glow */}
      <div 
        className="absolute -top-24 -right-24 w-64 h-64 blur-[80px] opacity-20 transition-colors duration-1000"
        style={{ backgroundColor: scoreColor }}
      />

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight uppercase">
                {t("dashboard.portfolioHealth")}
              </h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {t("dashboard.realtimeIndex")}
              </p>
            </div>
          </div>
          <div 
            className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border"
            style={{ 
              color: scoreColor, 
              borderColor: `${scoreColor}30`,
              backgroundColor: `${scoreColor}10` 
            }}
          >
            {stats.parityStatus}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-between gap-8">
          {/* Gauge Section */}
          <div className="relative flex-shrink-0">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="58"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                className="text-white/5"
              />
              <motion.circle
                cx="64"
                cy="64"
                r="58"
                stroke={scoreColor}
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 58}
                initial={{ strokeDashoffset: 2 * Math.PI * 58 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 58 * (1 - stats.score / 100) }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span 
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-3xl font-black text-white tracking-tighter"
              >
                {stats.score}
              </motion.span>
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                INDEX
              </span>
            </div>
          </div>

          {/* Metrics List */}
          <div className="flex-1 space-y-4">
            <MetricRow 
              label={t("dashboard.winningRate")}
              value={`${stats.winningRate}%`}
              icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
              subValue={t("dashboard.againstRivals")}
            />
            <MetricRow 
              label={t("dashboard.marketGap")}
              value={`${parseFloat(stats.gap) > 0 ? "+" : ""}${stats.gap}%`}
              icon={parseFloat(stats.gap) > 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-rose-400" />}
              subValue={t("dashboard.averageSpread")}
            />
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/5">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            {parseFloat(stats.gap) < -5 ? 
              t("dashboard.healthRisk") : 
              specs_ok(stats) ? 
              t("dashboard.healthOptimal") : 
              t("dashboard.healthAggressive")
            }
          </div>
        </div>
      </div>
    </div>
  );
}

function specs_ok(stats: any) {
    return Math.abs(parseFloat(stats.gap)) <= 5;
}

function MetricRow({ label, value, icon, subValue }: { label: string; value: string; icon: React.ReactNode, subValue: string }) {
  return (
    <div className="flex items-center justify-between group/row">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-white/5 group-hover/row:bg-white/10 transition-colors">
          {icon}
        </div>
        <div>
          <p className="text-xs font-black text-white uppercase tracking-wider">{label}</p>
          <p className="text-[10px] font-medium text-slate-500 tracking-wide">{subValue}</p>
        </div>
      </div>
      <span className="text-lg font-black text-white tracking-tighter">{value}</span>
    </div>
  );
}
