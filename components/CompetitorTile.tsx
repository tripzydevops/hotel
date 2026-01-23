"use client";

import { TrendingUp, TrendingDown, Minus, Hotel, Trash2 } from "lucide-react";
import TrendChart from "./TrendChart";
import { PricePoint } from "@/types";

export type TrendDirection = "up" | "down" | "stable";

interface CompetitorTileProps {
  id: string;
  name: string;
  currentPrice: number;
  previousPrice?: number;
  currency?: string;
  trend: TrendDirection;
  changePercent: number;
  isUndercut?: boolean;
  rank?: number;
  onDelete?: (id: string) => void;
  rating?: number;
  stars?: number;
  imageUrl?: string;
  vendor?: string;
  priceHistory?: PricePoint[];
}

/**
 * Competitor Tile (Small Format)
 * Compact display for competitor hotels with trend arrows
 */
export default function CompetitorTile(props: CompetitorTileProps) {
  const {
    id,
    name,
    currentPrice,
    previousPrice,
    currency = "USD",
    trend,
    changePercent,
    isUndercut = false,
    rank,
    onDelete,
    rating,
    stars,
    imageUrl: image_src,
    vendor,
    priceHistory,
  } = props;
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
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center border border-white/5">
            {image_src ? (
                <img src={image_src} alt={name} className="w-full h-full object-cover" />
            ) : (
                <Hotel className="w-5 h-5 text-[var(--text-secondary)]" />
            )}
            {stars && (
                <div className="absolute bottom-0.5 right-0.5 bg-black/60 backdrop-blur-md px-1 rounded text-[7px] text-[var(--soft-gold)] font-bold flex items-center gap-0.5">
                    {stars}★
                </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
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
            <div className="flex items-center gap-2">
                {rating && (
                    <span className="text-[10px] font-bold text-[var(--soft-gold)] bg-[var(--soft-gold)]/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        ★ {rating.toFixed(1)}
                    </span>
                )}
                {isUndercut && (
                    <span className="text-[10px] text-alert-red font-bold flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-alert-red animate-pulse" />
                        Undercut
                    </span>
                )}
            </div>
          </div>
        </div>

        {/* Trend Badge & Actions */}
        <div className="flex items-center gap-2">
          {onDelete && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onDelete(id);
              }}
              className="p-1.5 rounded-md bg-white/5 text-[var(--text-muted)] hover:bg-alert-red/10 hover:text-alert-red transition-all"
              title="Delete Monitor"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
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
      </div>

      <div className="flex-1 flex items-center justify-between group relative cursor-default">
        <div>
          <p className={`text-price-md ${currentPrice > 0 ? "text-white" : "text-[var(--text-muted)] animate-pulse"} transition-colors group-hover:text-[var(--soft-gold)]`}>
            {currentPrice > 0 ? formatPrice(currentPrice) : "—"}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">
                {currentPrice > 0 ? "per night" : "Pending Scan"}
            </p>
            {vendor && currentPrice > 0 && (
                <span className="text-[9px] text-[var(--text-muted)] italic">
                    via {vendor}
                </span>
            )}
          </div>
        </div>

        {/* Trend Chart */}
        {priceHistory && priceHistory.length > 1 && (
            <div className="w-20 h-10 opacity-60 group-hover:opacity-100 transition-opacity">
                <TrendChart 
                    data={priceHistory} 
                    color={trend === "up" ? "#EF4444" : trend === "down" ? "#10B981" : "#94A3B8"} 
                    width={80} 
                    height={40} 
                />
            </div>
        )}
        
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
