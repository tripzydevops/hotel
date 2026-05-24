"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingDown, TrendingUp, AlertCircle, BookOpen } from "lucide-react";
import { api } from "@/lib/api";

interface RevenueImpactData {
  hotel_name: string;
  recent_score: number | null;
  past_score: number | null;
  score_delta: number;
  direction: "improvement" | "decline" | "unchanged";
  impact_formatted: string;
  estimated_monthly_impact_try: number;
  narrative: string;
  methodology?: string;
}

export default function RevenueImpactCard({ hotelId }: { hotelId: string }) {
  const [data, setData] = useState<RevenueImpactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!hotelId) return;
    api.getRevenueImpact(hotelId)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [hotelId]);

  if (loading) {
    return (
      <div className="glass-card p-5 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/2 mb-3" />
        <div className="h-8 bg-white/10 rounded w-3/4 mb-2" />
        <div className="h-3 bg-white/10 rounded w-full" />
      </div>
    );
  }

  if (error || !data) return null;

  const isDecline = data.direction === "decline";
  const isImprovement = data.direction === "improvement";
  const hasData = data.recent_score !== null;

  const accentColor = isDecline
    ? "text-rose-400"
    : isImprovement
    ? "text-emerald-400"
    : "text-[var(--text-muted)]";

  const bgColor = isDecline
    ? "bg-rose-400/5 border-rose-400/20"
    : isImprovement
    ? "bg-emerald-400/5 border-emerald-400/20"
    : "bg-white/5 border-[var(--overlay-border)]";

  const Icon = isDecline ? TrendingDown : isImprovement ? TrendingUp : AlertCircle;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card p-5 border ${bgColor}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`p-2 rounded-lg ${isDecline ? "bg-rose-400/10" : isImprovement ? "bg-emerald-400/10" : "bg-white/5"}`}>
          <Icon className={`w-4 h-4 ${accentColor}`} />
        </div>
        <div>
          <h4 className="text-sm font-black text-[var(--overlay-text)]">Revenue Impact</h4>
          <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            Sentiment → Revenue Estimate
          </p>
        </div>
      </div>

      {hasData ? (
        <>
          {/* Score change */}
          <div className="flex items-baseline gap-3 mb-3">
            <div className={`text-3xl font-black tracking-tighter ${accentColor}`}>
              {data.impact_formatted}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase leading-tight">
              est. monthly<br />impact
            </div>
          </div>

          {/* Score delta pill */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] text-[var(--text-muted)]">
              Review score:
            </span>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${bgColor} ${accentColor}`}>
              {data.past_score?.toFixed(1)} → {data.recent_score?.toFixed(1)}
              {" "}({typeof data.score_delta === "number" && !isNaN(data.score_delta) ? (data.score_delta > 0 ? "+" : "") + data.score_delta.toFixed(1) : "0.0"} pts)
            </span>
          </div>

          {/* Narrative */}
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
            {data.narrative}
          </p>

          {/* Methodology footnote */}
          {data.methodology && (
            <div className="flex items-start gap-1.5 mt-2 pt-3 border-t border-[var(--overlay-border)]">
              <BookOpen className="w-3 h-3 flex-shrink-0 text-[var(--text-muted)] mt-0.5" />
              <p className="text-[9px] text-[var(--text-muted)] leading-relaxed">
                {data.methodology}
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-[var(--text-muted)]">{data.narrative}</p>
      )}
    </motion.div>
  );
}
