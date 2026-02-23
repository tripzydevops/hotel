"use client";

import React, { useState } from "react";
import {
  Zap,
  AlertTriangle,
  Trophy,
  TrendingDown,
  Target,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

// EXPLANATION: Maps the upstream `label` prop (e.g. "Value Leader") to the
// corresponding i18n dictionary key (e.g. "strategicMap.positions.valueLeader").
const LABEL_TO_KEY: Record<string, string> = {
  "Value Leader": "valueLeader",
  "Premium King": "premiumKing",
  "Budget / Economy": "budget",
  "Danger Zone": "dangerZone",
  Standard: "standard",
  "Insufficient Data": "insufficientData",
};

interface AdvisorQuadrantProps {
  x: number; // -50 to 50
  y: number; // -50 to 50
  label: string;
  ari?: number;
  sentiment?: number;
  targetRating?: number;
  marketRating?: number;
  compact?: boolean;
}

// EXPLANATION: Quadrant Position Registry
// Each entry defines the visual styling, short insight, recommended action,
// and a rich user-facing description for the hover tooltip.
// The quadrant is determined by the intersection of two axes:
//   X-axis (ARI) = Price Index — how your price compares to market average
//   Y-axis = Value Index — how your guest perception compares to competitors
// The label is computed upstream (in the Sentiment page) based on these scores.
// EXPLANATION: Quadrant Visual Registry (styling + icons only)
// Text content is now pulled from i18n dictionaries via the t() function.
const QUADRANT_STYLE: Record<string, { color: string; icon: React.ReactNode }> = {
  "Value Leader": { color: "text-blue-400", icon: <Target className="w-4 h-4" /> },
  "Premium King": { color: "text-[var(--soft-gold)]", icon: <Zap className="w-4 h-4" /> },
  "Budget / Economy": { color: "text-[var(--optimal-green)]", icon: <TrendingDown className="w-4 h-4" /> },
  "Danger Zone": { color: "text-red-400", icon: <AlertTriangle className="w-4 h-4" /> },
  Standard: { color: "text-white/60", icon: <Target className="w-4 h-4" /> },
  "Insufficient Data": { color: "text-white/40", icon: <AlertTriangle className="w-4 h-4" /> },
};

export default function AdvisorQuadrant({
  x,
  y,
  label,
  ari,
  sentiment,
  targetRating,
  marketRating,
  compact = false,
}: AdvisorQuadrantProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { t } = useI18n();

  // EXPLANATION: Coordinate Mapping
  // The backend sends x,y in [-50, 50] range. We map to CSS percentages
  // with 15% padding so the indicator never clips the chart border.
  // Y-axis is inverted (CSS top goes down, value index goes up).
  const clamp = (val: number, min: number, max: number) =>
    Math.max(min, Math.min(max, val));

  const leftPercent = clamp(((x + 50) / 100) * 70 + 15, 15, 85);
  const topPercent = clamp(85 - ((y + 50) / 100) * 70, 15, 85);

  const quadrantStyle = QUADRANT_STYLE[label] || QUADRANT_STYLE["Standard"];
  const posKey = LABEL_TO_KEY[label] || "standard";
  // Pull i18n text for this quadrant position
  const posLabel = t(`strategicMap.positions.${posKey}.label`);
  const posInsight = t(`strategicMap.positions.${posKey}.insight`);
  const posAction = t(`strategicMap.positions.${posKey}.action`);
  const posDescription = t(`strategicMap.positions.${posKey}.description`);

  return (
    <div className={`overflow-hidden ${!compact ? "glass-card" : ""}`}>
      <div className="flex flex-col lg:flex-row">
        {/* Quadrant Visualization - Left Side */}
        <div className={`relative flex-1 ${compact ? "h-[320px] lg:h-[380px]" : "h-[240px] lg:h-[280px]"} p-4`}>
          {/* Header */}
          {!compact && (
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
              <h3 className="text-[10px] font-black text-white uppercase tracking-[0.15em]">
                Advisor Quadrant
              </h3>
              <span className="px-1.5 py-0.5 rounded bg-white/5 text-[7px] font-bold text-[var(--text-muted)] border border-white/10 uppercase">
                Strategic Map
              </span>
            </div>
          )}

          {/* Background Grid & Labels */}
          <div className="absolute inset-4 top-10 flex flex-col pointer-events-none opacity-25">
            <div className="flex-1 flex border-b border-white/10">
              <div className="flex-1 border-r border-white/10 flex items-center justify-center">
                <div className="text-[8px] font-black uppercase tracking-widest text-red-400/80 -rotate-45">
                  Danger
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <div className="text-[8px] font-black uppercase tracking-widest text-[var(--soft-gold)] -rotate-45">
                  Premium
                </div>
              </div>
            </div>
            <div className="flex-1 flex">
              <div className="flex-1 border-r border-white/10 flex items-center justify-center">
                <div className="text-[8px] font-black uppercase tracking-widest text-[var(--optimal-green)] -rotate-45">
                  Budget
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <div className="text-[8px] font-black uppercase tracking-widest text-blue-400 -rotate-45">
                  Value
                </div>
              </div>
            </div>
          </div>

          {/* Axis Labels */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[7px] font-black uppercase text-[var(--text-muted)] tracking-[0.2em]">
            {t("strategicMap.priceIndex")}
          </div>
          <div className="absolute left-1 top-1/2 -rotate-90 -translate-y-1/2 text-[7px] font-black uppercase text-[var(--text-muted)] tracking-[0.2em] whitespace-nowrap">
            {t("strategicMap.valueIndex")}
          </div>

          {/* Crosshair lines */}
          <div className="absolute top-1/2 left-6 right-6 h-[1px] bg-white/10 -translate-y-1/2" />
          <div className="absolute left-1/2 top-12 bottom-6 w-[1px] bg-white/10 -translate-x-1/2" />

          {/* EXPLANATION: Position Indicator
              The gold Trophy icon represents the hotel's current strategic position
              on the quadrant map. Its CSS position is computed from the x/y props.
              On hover, it reveals a tooltip with an in-depth explanation of what
              the position means and what action the hotelier should take. */}
          {/* The Indicator */}
          <div
            className="absolute w-10 h-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 ease-out z-20"
            style={{
              left: `${leftPercent}%`,
              top: `${topPercent}%`,
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="relative w-full h-full flex items-center justify-center cursor-pointer">
              {/* Pulse Effect */}
              <div className="absolute inset-0 bg-[var(--soft-gold)] rounded-full animate-ping opacity-20" />
              <div className="absolute inset-0 bg-[var(--soft-gold)]/20 rounded-full blur-lg animate-pulse" />

              <div className="relative p-1.5 rounded-lg bg-[var(--soft-gold)] text-black shadow-xl shadow-[var(--soft-gold)]/40 border border-white/20">
                <Trophy className="w-4 h-4" />
              </div>
            </div>

            {/* EXPLANATION: Smart Tooltip Positioning
                If the indicator is in the upper half of the chart (topPercent < 45),
                the tooltip renders BELOW the icon to avoid clipping off the top edge.
                Otherwise it renders ABOVE. The tooltip is pointer-events-none so it
                doesn't interfere with the hover detection on the parent div. */}
            {/* Hover Tooltip */}
            {isHovered && (
              <div
                className={`absolute left-1/2 -translate-x-1/2 z-50 w-[280px] pointer-events-none
                  ${topPercent < 45 ? "top-full mt-3" : "bottom-full mb-3"}`}
              >
                {/* Arrow */}
                <div
                  className={`absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-black/90 border border-white/10
                    ${topPercent < 45 ? "-top-[6px] border-b-0 border-r-0" : "-bottom-[6px] border-t-0 border-l-0"}`}
                />
                <div className="relative bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-2xl shadow-black/60">
                  <div className={`flex items-center gap-2 mb-2 ${quadrantStyle.color}`}>
                    {quadrantStyle.icon}
                    <span className="text-xs font-black uppercase tracking-wide">{posLabel}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-white/70 mb-3">
                    {posDescription}
                  </p>
                  <div className="flex items-center gap-1.5 pt-2 border-t border-white/5">
                    <ArrowUpRight className="w-3 h-3 text-[var(--soft-gold)] flex-shrink-0" />
                    <span className="text-[10px] font-bold text-[var(--soft-gold)] uppercase tracking-wide">
                      {posAction}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Corner Icons */}
          <div className="absolute top-12 right-4 text-[var(--soft-gold)]/20">
            <Zap className="w-4 h-4" />
          </div>
          <div className="absolute bottom-6 right-4 text-blue-400/20">
            <Target className="w-4 h-4" />
          </div>
          <div className="absolute top-12 left-6 text-red-400/20">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="absolute bottom-6 left-6 text-[var(--optimal-green)]/20">
            <TrendingDown className="w-4 h-4" />
          </div>
        </div>

        {/* Insights Panel - Right Side */}
        <div className={`${compact ? "lg:w-[380px]" : "lg:w-[320px]"} p-6 bg-white/[0.02] border-t lg:border-t-0 lg:border-l border-white/5 flex flex-col justify-between`}>
          <div>
            {/* Current Position */}
            <div className="mb-6">
              <div className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">
                {t("strategicMap.currentPosition")}
              </div>
              <div
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 ${quadrantStyle.color}`}
              >
                {quadrantStyle.icon}
                <span className="text-sm font-black uppercase tracking-wide">
                  {posLabel}
                </span>
              </div>
            </div>

            {/* Insight */}
            <div className="mb-6">
              <div className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">
                {t("strategicMap.marketInsight")}
              </div>
              <p className="text-xs font-medium text-white/80 leading-relaxed">
                {posInsight}
              </p>
            </div>
          </div>

          {/* EXPLANATION: Key Performance Indices
              Sentiment Index: Your guest rating divided by market average (×100).
              Values >= 100 mean you're outperforming the market (green).
              Values < 100 mean you're underperforming (red).
              ARI (Average Rate Index): Your price divided by market average (×100).
              Together these two indices determine the quadrant position above. */}
          {/* Key Indices */}
          <div className="space-y-4 pt-4 border-t border-white/5">
            {/* Sentiment Index */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                  {t("strategicMap.sentimentIndex")}
                </span>
                <span
                  className={`text-xs font-black ${(sentiment || 100) >= 100 ? "text-[var(--optimal-green)]" : "text-[var(--alert-red)]"}`}
                >
                  {sentiment?.toFixed(1) || "100.0"}
                </span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${(sentiment || 100) >= 100 ? "bg-[var(--optimal-green)]" : "bg-[var(--alert-red)]"}`}
                  style={{
                    width: `${Math.min(Math.max((sentiment || 100) / 2, 0), 100)}%`,
                  }} // Normalized loosely
                />
              </div>
              {/* Actual Ratings Display */}
              <div className="flex justify-between text-[8px] font-bold text-white/40 uppercase tracking-widest ">
                <span>You: {targetRating?.toFixed(1) || "N/A"}</span>
                <span>Mkt: {marketRating?.toFixed(1) || "N/A"}</span>
              </div>
            </div>

            {/* ARI */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                  ARI
                </span>
                <span className="text-xs font-black text-white">
                  {ari?.toFixed(1) || "100.0"}
                </span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--soft-gold)] rounded-full transition-all duration-1000"
                  style={{
                    width: `${Math.min(Math.max((ari || 100) / 2, 0), 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
