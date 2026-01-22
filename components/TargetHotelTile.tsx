"use client";

import { TrendingUp, TrendingDown, Minus, Building2 } from "lucide-react";

export type TrendDirection = "up" | "down" | "stable";

interface TargetHotelTileProps {
  name: string;
  location?: string;
  currentPrice: number;
  previousPrice?: number;
  currency?: string;
  trend: TrendDirection;
  changePercent: number;
  lastUpdated?: string;
}

/**
 * Target Hotel Tile (Large Format)
 * Displays user's own hotel with prominent pricing
 */
export default function TargetHotelTile({
  name,
  location,
  currentPrice,
  previousPrice,
  currency = "USD",
  trend,
  changePercent,
  lastUpdated,
}: TargetHotelTileProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getTrendIcon = () => {
    switch (trend) {
      case "up":
        return <TrendingUp className="w-8 h-8 text-alert-red" />;
      case "down":
        return <TrendingDown className="w-8 h-8 text-optimal-green" />;
      default:
        return <Minus className="w-8 h-8 text-[var(--text-muted)]" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case "up":
        return "text-alert-red";
      case "down":
        return "text-optimal-green";
      default:
        return "text-[var(--text-muted)]";
    }
  };

  return (
    <div className="glass-card p-8 sm:col-span-2 lg:col-span-2 lg:row-span-2 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--soft-gold)]/20 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-[var(--soft-gold)]" />
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider text-[var(--soft-gold)] font-semibold">
              Your Hotel
            </span>
            <h2 className="text-xl font-bold text-white">{name}</h2>
            {location && (
              <p className="text-sm text-[var(--text-muted)]">{location}</p>
            )}
          </div>
        </div>
        {getTrendIcon()}
      </div>

      {/* Price Display */}
      <div className="flex-1 flex flex-col justify-center py-4">
        <div className="text-center group relative">
          <p className="text-xs font-semibold tracking-tighter text-[var(--text-secondary)] mb-1 uppercase">
            Current Rate
          </p>
          <div className="relative inline-block">
            {currentPrice > 0 ? (
              <p className="text-price-lg text-white transition-all">
                {formatPrice(currentPrice)}
              </p>
            ) : (
              <p className="text-price-lg text-[var(--text-muted)] animate-pulse">
                —
              </p>
            )}
          </div>
          <p className="text-sm font-medium text-[var(--text-muted)] mt-1">
            {currentPrice > 0 ? "per night" : "Scan required for live rate"}
          </p>
          
          {/* Progressive Disclosure: Detail Tooltip on Hover */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1 bg-[var(--deep-ocean-accent)] border border-white/10 rounded-lg text-[10px] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
            Verified via SerpApi • {lastUpdated || "Just now"}
          </div>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="flex items-center justify-between pt-6 border-t border-white/10">
        <div>
          <p className="text-xs text-[var(--text-muted)]">Previous</p>
          <p className="text-lg text-[var(--text-secondary)]">
            {previousPrice ? formatPrice(previousPrice) : "—"}
          </p>
        </div>

        <div className="text-center">
          <p className="text-xs text-[var(--text-muted)]">Change</p>
          <p className={`text-lg font-semibold ${getTrendColor()}`}>
            {changePercent > 0 ? "+" : ""}
            {changePercent.toFixed(1)}%
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs text-[var(--text-muted)]">Updated</p>
          <p className="text-sm text-[var(--text-secondary)]">
            {lastUpdated || "Just now"}
          </p>
        </div>
      </div>
    </div>
  );
}
