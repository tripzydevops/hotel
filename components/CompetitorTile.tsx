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
  isUndercut?: boolean; // True if cheaper than target hotel
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
        return <TrendingUp className={`${size} text-[var(--soft-gold)]`} />;
      case "down":
        return <TrendingDown className={`${size} text-[#0ea5e9]`} />;
      default:
        return <Minus className={`${size} text-[var(--text-muted)]`} />;
    }
  };

  const getTrendBgColor = () => {
    switch (trend) {
      case "up":
        return "bg-[var(--soft-gold)]/10";
      case "down":
        return "bg-[#0ea5e9]/10";
      default:
        return "bg-white/5";
    }
  };

  const getTrendTextColor = () => {
    switch (trend) {
      case "up":
        return "text-[var(--soft-gold)]";
      case "down":
        return "text-[#0ea5e9]";
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
            <h3
              className="text-sm font-semibold text-white line-clamp-1"
              title={name}
            >
              {name}
            </h3>
            {isUndercut && (
              <span className="text-[10px] text-red-400 font-medium">
                ⚠ Undercutting you
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
      <div className="flex-1 flex items-center">
        <div>
          <p className="text-2xl font-bold text-white">
            {formatPrice(currentPrice)}
          </p>
          <p className="text-xs text-[var(--text-muted)]">per night</p>
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
