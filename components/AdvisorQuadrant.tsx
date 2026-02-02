"use client";

import React from "react";
import {
  Zap,
  AlertTriangle,
  Trophy,
  TrendingDown,
  Target,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface AdvisorQuadrantProps {
  x: number; // -50 to 50
  y: number; // -50 to 50
  label: string;
  ari?: number;
  sentiment?: number;
  targetRating?: number;
  marketRating?: number;
}

const QUADRANT_INFO: Record<
  string,
  { color: string; icon: React.ReactNode; insight: string; action: string }
> = {
  "Value Leader": {
    color: "text-blue-400",
    icon: <Target className="w-4 h-4" />,
    insight: "Optimal position with strong value perception",
    action: "Maintain pricing strategy, focus on upsells",
  },
  "Premium King": {
    color: "text-[var(--soft-gold)]",
    icon: <Zap className="w-4 h-4" />,
    insight: "High price justified by superior reputation",
    action: "Leverage brand premium, maintain quality",
  },
  "Budget / Economy": {
    color: "text-[var(--optimal-green)]",
    icon: <TrendingDown className="w-4 h-4" />,
    insight: "Competitive pricing with room to grow",
    action: "Consider strategic price increases",
  },
  "Danger Zone": {
    color: "text-red-400",
    icon: <AlertTriangle className="w-4 h-4" />,
    insight: "High price with lower perceived value",
    action: "Review pricing or improve reputation",
  },
  Standard: {
    color: "text-white/60",
    icon: <Target className="w-4 h-4" />,
    insight: "Neutral market position",
    action: "Define differentiation strategy",
  },
};

export default function AdvisorQuadrant({
  x,
  y,
  label,
  ari,
  sentiment,
  targetRating,
  marketRating,
}: AdvisorQuadrantProps) {
  // Convert -50/50 range to percentage, clamped to stay within bounds
  // Add padding (15% on each side) so indicator stays fully visible
  const clamp = (val: number, min: number, max: number) =>
    Math.max(min, Math.min(max, val));

  // Map x from [-50, 50] to [15, 85] for left position
  const leftPercent = clamp(((x + 50) / 100) * 70 + 15, 15, 85);
  // Map y from [-50, 50] to [85, 15] for top position (inverted because CSS top goes down)
  const topPercent = clamp(85 - ((y + 50) / 100) * 70, 15, 85);

  const quadrantData = QUADRANT_INFO[label] || QUADRANT_INFO["Standard"];

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex flex-col lg:flex-row">
        {/* Quadrant Visualization - Left Side */}
        <div className="relative flex-1 h-[240px] lg:h-[280px] p-4">
          {/* Header */}
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.15em]">
              Advisor Quadrant
            </h3>
            <span className="px-1.5 py-0.5 rounded bg-white/5 text-[7px] font-bold text-[var(--text-muted)] border border-white/10 uppercase">
              Strategic Map
            </span>
          </div>

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
            Price Index (ARI)
          </div>
          <div className="absolute left-1 top-1/2 -rotate-90 -translate-y-1/2 text-[7px] font-black uppercase text-[var(--text-muted)] tracking-[0.2em] whitespace-nowrap">
            Value Index
          </div>

          {/* Crosshair lines */}
          <div className="absolute top-1/2 left-6 right-6 h-[1px] bg-white/10 -translate-y-1/2" />
          <div className="absolute left-1/2 top-12 bottom-6 w-[1px] bg-white/10 -translate-x-1/2" />

          {/* The Indicator */}
          <div
            className="absolute w-10 h-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 ease-out z-20"
            style={{
              left: `${leftPercent}%`,
              top: `${topPercent}%`,
            }}
          >
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Pulse Effect */}
              <div className="absolute inset-0 bg-[var(--soft-gold)] rounded-full animate-ping opacity-20" />
              <div className="absolute inset-0 bg-[var(--soft-gold)]/20 rounded-full blur-lg animate-pulse" />

              <div className="relative p-1.5 rounded-lg bg-[var(--soft-gold)] text-black shadow-xl shadow-[var(--soft-gold)]/40 border border-white/20">
                <Trophy className="w-4 h-4" />
              </div>
            </div>
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
        <div className="lg:w-[320px] p-5 bg-white/[0.02] border-t lg:border-t-0 lg:border-l border-white/5 flex flex-col justify-between">
          <div>
            {/* Current Position */}
            <div className="mb-6">
              <div className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">
                Current Position
              </div>
              <div
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 ${quadrantData.color}`}
              >
                {quadrantData.icon}
                <span className="text-sm font-black uppercase tracking-wide">
                  {label}
                </span>
              </div>
            </div>

            {/* Insight */}
            <div className="mb-6">
              <div className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">
                Market Insight
              </div>
              <p className="text-xs font-medium text-white/80 leading-relaxed">
                {quadrantData.insight}
              </p>
            </div>
          </div>

          {/* Key Indices */}
          <div className="space-y-4 pt-4 border-t border-white/5">
            {/* Sentiment Index */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                  Sentiment Index
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
