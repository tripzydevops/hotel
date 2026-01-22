"use client";

import { TrendingUp, TrendingDown, Minus, Hotel } from "lucide-react";

export type TrendDirection = "up" | "down" | "stable";

interface CompetitorTileProps {
  name: string;
  currentPrice: number;
  previousPrice?: number;
  currency?: string;
  trend: TrendDirection;
  changePercent: number;
  isUndercut?: boolean;
  rank?: number;
}

/**
 * Competitor Tile (Small Format)
 * Compact display for competitor hotels with trend arrows
 */
export default function CompetitorTile({
  name,
  currentPrice,
  previousPrice,
  currency = "USD",
  trend,
  changePercent,
  isUndercut = false,
  rank,
}: CompetitorTileProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getTrendIcon = () => {
    const size = "w-5 h-5";
    switch (trend) {
      case "up":
        return <TrendingUp className={`${size} text-optimal-green`} />;
      case "down":
        return <TrendingDown className={`${size} text-alert-red`} />;
      default:
        return <Minus className={`${size} text-[var(--text-muted)]`} />;
    }
  };

  const getTrendBgColor = () => {
    switch (trend) {
      case "up":
        return "bg-optimal-green-soft";
      case "down":
        return "bg-alert-red-soft";
      default:
        return "bg-white/5";
    }
  };

  const getTrendTextColor = () => {
    switch (trend) {
      case "up":
        return "text-optimal-green";
      case "down":
        return "text-alert-red";
      default:
        return "text-[var(--text-muted)]";
    }
  };

  return (
    <div
      className={`
        glass-card p-5 flex flex-col justify-between
        ${isUndercut ? "ring-2 ring-red-500/50" : ""}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
            <Hotel className="w-4 h-4 text-[var(--text-secondary)]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3
                className="text-sm font-bold text-white line-clamp-1"
                title={name}
              >
                {name}
              </h3>
              {rank && (
                <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-black text-[var(--text-secondary)] uppercase">
                  #{rank}
                </span>
              )}
            </div>
            {isUndercut && (
              <span className="text-[10px] text-alert-red font-bold flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-alert-red animate-pulse" />
                Aggressive Undercut
              </span>
            )}
          </div>
        </div>

        {/* Trend Badge */}
        <div
          className={`px-2 py-1 rounded-md ${getTrendBgColor()} flex items-center gap-1`}
        >
          {getTrendIcon()}
          <span className={`text-xs font-medium ${getTrendTextColor()}`}>
            {changePercent > 0 ? "+" : ""}
            {changePercent.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Price */}
      <div className="flex-1 flex items-center group relative cursor-default">
        <div>
          <p className={`text-price-md ${currentPrice > 0 ? "text-white" : "text-[var(--text-muted)] animate-pulse"} transition-colors group-hover:text-[var(--soft-gold)]`}>
            {currentPrice > 0 ? formatPrice(currentPrice) : "—"}
          </p>
          <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">
            {currentPrice > 0 ? "per night" : "Pending Scan"}
          </p>
        </div>
        
        {/* Progressive Disclosure: Hover Tooltip */}
        <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-[var(--deep-ocean-accent)] border border-white/10 rounded-md text-[9px] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
          Live Market Rate • Verified
        </div>
      </div>

      {/* Previous Price */}
      {previousPrice && (
        <div className="pt-3 border-t border-white/5">
          <p className="text-xs text-[var(--text-muted)]">
            Was:{" "}
            <span className="text-[var(--text-secondary)]">
              {formatPrice(previousPrice)}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
