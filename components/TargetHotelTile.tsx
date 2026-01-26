"use client";

import {
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  Trash2,
  Edit2,
} from "lucide-react";
import TrendChart from "./TrendChart";
import { PricePoint } from "@/types";

export type TrendDirection = "up" | "down" | "stable";

interface TargetHotelTileProps {
  id: string;
  name: string;
  location?: string;
  currentPrice: number;
  previousPrice?: number;
  currency?: string;
  trend: TrendDirection;
  changePercent: number;
  lastUpdated?: string;
  onDelete?: (id: string) => void;
  rating?: number;
  stars?: number;
  imageUrl?: string;
  vendor?: string;
  priceHistory?: PricePoint[];
  checkIn?: string;
  adults?: number;
  onEdit?: (id: string, hotel: any) => void;
  onViewDetails?: (hotel: any) => void;
}

/**
 * Target Hotel Tile (Large Format)
 * Displays user's own hotel with prominent pricing
 */
export default function TargetHotelTile({
  id,
  name,
  location,
  currentPrice,
  previousPrice,
  currency = "USD",
  trend,
  changePercent,
  lastUpdated,
  onDelete,
  rating,
  stars,
  imageUrl,
  vendor,
  priceHistory,
  checkIn,
  adults,
  onEdit,
  onViewDetails,
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
        return <TrendingUp className="w-8 h-8 text-[var(--danger)]" />;
      case "down":
        return <TrendingDown className="w-8 h-8 text-[var(--success)]" />;
      default:
        return <Minus className="w-8 h-8 text-[var(--text-muted)]" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case "up":
        return "text-[var(--danger)]";
      case "down":
        return "text-[var(--success)]";
      default:
        return "text-[var(--text-muted)]";
    }
  };

  return (
    <div className="glass-card p-8 sm:col-span-2 lg:col-span-2 lg:row-span-2 flex flex-col group/card relative overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-[var(--soft-gold)]/10 flex items-center justify-center border border-white/5">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Building2 className="w-8 h-8 text-[var(--soft-gold)]" />
            )}
            {stars && (
              <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-md px-1 rounded text-[8px] text-[var(--soft-gold)] font-bold flex items-center gap-0.5">
                {stars}★
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] uppercase tracking-widest text-[var(--soft-gold)] font-bold bg-[var(--soft-gold)]/10 px-2 py-0.5 rounded-full">
                Property Owner
              </span>
              {rating && (
                <span className="text-[10px] font-bold text-white bg-white/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                  ★ {rating.toFixed(1)}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-white leading-tight">
              {name}
            </h2>
            {location && (
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                {location}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(id, { id, name, location, is_target_hotel: true });
              }}
              className="p-2.5 rounded-xl bg-white/5 text-[var(--text-muted)] hover:bg-white/10 hover:text-white transition-all border border-white/5"
              title="Edit Hotel"
            >
              <Edit2 className="w-4.5 h-4.5" />
            </button>
          )}
          {onViewDetails && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails({
                  id,
                  name,
                  location,
                  imageUrl,
                  price_info: { currency, current_price: currentPrice },
                });
              }}
              className="p-2.5 rounded-xl bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] hover:bg-[var(--soft-gold)]/20 transition-all border border-[var(--soft-gold)]/20"
              title="View Hotel Intelligence"
            >
              <Building2 className="w-4.5 h-4.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(id);
              }}
              className="p-2.5 rounded-xl bg-white/5 text-[var(--text-muted)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] transition-all border border-white/5"
              title="Delete Monitor"
            >
              <Trash2 className="w-4.5 h-4.5" />
            </button>
          )}
          <div
            className={`p-2 rounded-xl bg-white/5 border border-white/5 ${getTrendColor()}`}
          >
            {getTrendIcon()}
          </div>
        </div>
      </div>

      {/* Price Display */}
      <div className="flex-1 flex flex-col justify-center py-6">
        <div className="text-center group relative">
          <p className="text-[10px] font-bold tracking-widest text-[var(--soft-gold)] mb-2 uppercase flex items-center justify-center gap-2">
            <span className="w-1 h-1 rounded-full bg-[var(--soft-gold)] animate-pulse" />
            Live Market Rate
          </p>
          <div className="relative inline-block mb-1">
            {currentPrice > 0 ? (
              <div className="flex flex-col items-center">
                <p className="text-6xl font-black text-white tracking-tighter transition-all">
                  {formatPrice(currentPrice)}
                </p>
                {vendor && (
                  <span className="mt-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest px-3 py-1 rounded-full border border-white/5 bg-white/5">
                    via {vendor}
                  </span>
                )}
                {(checkIn || (adults && adults !== 2)) && (
                  <span className="mt-2 text-[10px] font-bold text-[var(--soft-gold)] uppercase tracking-widest px-3 py-1 rounded-full border border-[var(--soft-gold)]/20 bg-[var(--soft-gold)]/5">
                    {checkIn
                      ? `Check-in ${new Date(checkIn).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                      : "Check-in Today"}
                    {adults && adults !== 2 ? ` • ${adults} Guests` : ""}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-5xl font-bold text-[var(--text-muted)] animate-pulse">
                SCAN REQUIRED
              </p>
            )}
          </div>

          {/* Progressive Disclosure: Detail Tooltip on Hover */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 px-4 py-2 bg-[var(--deep-ocean-accent)] border border-white/10 rounded-xl text-[10px] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 whitespace-nowrap z-10 pointer-events-none shadow-2xl backdrop-blur-md">
            Verified via SerpApi Intelligence • {lastUpdated || "Just now"}
          </div>
        </div>

        {/* Trend Chart Background */}
        {priceHistory && priceHistory.length > 1 && (
          <div className="absolute inset-x-8 bottom-0 h-24 opacity-30 pointer-events-none mask-linear-fade">
            <TrendChart
              data={priceHistory}
              color={
                trend === "up"
                  ? "#EF4444"
                  : trend === "down"
                    ? "#10B981"
                    : "#94A3B8"
              }
              width={400}
              height={96}
            />
          </div>
        )}
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
            {lastUpdated || "Pending"}
          </p>
        </div>
      </div>
    </div>
  );
}
