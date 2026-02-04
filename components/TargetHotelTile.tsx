"use client";

import {
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  Trash2,
  Edit2,
  Activity,
  History,
} from "lucide-react";
import TrendChart from "./TrendChart";
import { PricePoint } from "@/types";
import { useI18n } from "@/lib/i18n";

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
  isEnterprise?: boolean;
  amenities?: string[];
  images?: { thumbnail?: string; original?: string }[];
}

export default function TargetHotelTile({
  id,
  name,
  location,
  currentPrice,
  previousPrice,
  currency = "TRY",
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
  isEnterprise = false,
  amenities,
}: TargetHotelTileProps) {
  const { t } = useI18n();
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat(currency === "TRY" ? "tr-TR" : "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    }).format(price);
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
    <div className="panel flex flex-col h-full bg-[#0d2547] group/card border-[var(--panel-border)] animate-fade-in sm:col-span-2 lg:col-span-2 lg:row-span-2">
      <div className="panel-header bg-black/20">
        <div className="flex items-center gap-3">
          <Activity className="w-4 h-4 text-[var(--soft-gold)]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--soft-gold)]">
            Primary Performance Monitor
          </span>
        </div>
        <div className="flex gap-2">
          {onEdit && (
            <button
              onClick={() => onEdit(id, { id, name, location })}
              className="p-1.5 hover:text-white text-[var(--text-muted)] transition-colors"
            >
              <Edit2 size={14} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(id)}
              className="p-1.5 hover:text-[var(--danger)] text-[var(--text-muted)] transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white mb-1">
              {name}
            </h2>
            <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] font-mono uppercase">
              <span>{location || "Global Market"}</span>
              {stars && <span>• {stars} Star</span>}
              {rating && (
                <span className="text-[var(--soft-gold)]">
                  • RA: {rating.toFixed(1)}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest block mb-1">
              Current ADR
            </span>
            <div className="data-value text-3xl font-bold text-white">
              {currentPrice > 0
                ? formatPrice(currentPrice)
                : t("common.pending")}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="panel bg-black/10 p-4 border-[var(--panel-border)]">
            <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest block mb-1">
              Market Position
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`text-xl font-bold data-value ${getTrendColor()}`}
              >
                {changePercent > 0 ? "+" : ""}
                {changePercent.toFixed(2)}%
              </span>
              {trend === "up" ? (
                <TrendingUp size={16} className="text-[var(--danger)]" />
              ) : (
                <TrendingDown size={16} className="text-[var(--success)]" />
              )}
            </div>
          </div>
          <div className="panel bg-black/10 p-4 border-[var(--panel-border)]">
            <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest block mb-1">
              Last Update (UTC)
            </span>
            <div className="text-sm font-medium text-white data-value">
              {lastUpdated || "09:42:15"}
            </div>
          </div>
        </div>

        {/* Chart Area */}
        <div className="flex-1 min-h-[140px] relative mt-auto border-t border-[var(--panel-border)] pt-4 overflow-hidden">
          <div className="absolute top-4 left-0 flex items-center gap-2">
            <History size={12} className="text-[var(--text-muted)]" />
            <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
              Pricing History (30D)
            </span>
          </div>
          {priceHistory && priceHistory.length > 1 && (
            <div className="absolute inset-x-0 bottom-0 h-24 opacity-40">
              <TrendChart
                data={priceHistory}
                color={trend === "up" ? "#EF4444" : "#10B981"}
                width={600}
                height={80}
              />
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-[var(--panel-border)] flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)]">
        <div>IDENT: {id.slice(0, 8).toUpperCase()}</div>
        <div className="flex items-center gap-4">
          <span>SOURCE: {vendor?.toUpperCase() || "DIRECT"}</span>
          <span>STATUS: TRACKING</span>
        </div>
      </div>
    </div>
  );
}
