"use client";

import {
  TrendingUp,
  TrendingDown,
  Minus,
  Hotel,
  Trash2,
  Edit2,
  AlertTriangle,
} from "lucide-react";
import TrendChart from "./TrendChart";
import { PricePoint } from "@/types";
import { useI18n } from "@/lib/i18n";

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
  onEdit?: (id: string, hotel: any) => void;
  onViewDetails?: (hotel: any) => void;
  isEnterprise?: boolean;
  amenities?: string[];
  images?: { thumbnail?: string; original?: string }[];
  checkIn?: string;
  adults?: number;
}

export default function CompetitorTile(props: CompetitorTileProps) {
  const { t } = useI18n();
  const {
    id,
    name,
    currentPrice,
    currency = "TRY",
    trend,
    changePercent,
    isUndercut = false,
    rank,
    onDelete,
    rating,
    stars,
    vendor,
    priceHistory,
    onEdit,
  } = props;

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
    <div
      className={`panel p-4 flex flex-col bg-[#0d2547] border-[var(--panel-border)] animate-fade-in ${isUndercut ? "border-red-500/40 bg-red-500/5" : ""}`}
    >
      {/* Mini Header */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-[var(--panel-border)]">
        <div className="flex items-center gap-2">
          {isUndercut ? (
            <AlertTriangle
              size={14}
              className="text-[var(--danger)] animate-pulse"
            />
          ) : (
            <span className="text-[9px] font-mono text-[var(--text-secondary)]">
              CMP-{rank}
            </span>
          )}
          <h3
            className="text-xs font-bold text-white tracking-tight line-clamp-1 max-w-[120px]"
            title={name}
          >
            {name}
          </h3>
        </div>
        <div className="flex gap-1">
          {onEdit && (
            <button
              onClick={() => onEdit(id, { id, name })}
              className="p-1 text-[var(--text-muted)] hover:text-white transition-colors"
            >
              <Edit2 size={12} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(id)}
              className="p-1 text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
              Rate
            </span>
            {rating && (
              <span className="text-[8px] font-bold text-[var(--soft-gold)]">
                ★ {rating.toFixed(1)}
              </span>
            )}
          </div>
          <div className="data-value text-xl font-bold text-white">
            {currentPrice > 0 ? formatPrice(currentPrice) : "PENDING"}
          </div>
        </div>
        <div className="text-right">
          <div className={`data-value text-xs font-bold ${getTrendColor()}`}>
            {changePercent > 0 ? "+" : ""}
            {changePercent.toFixed(1)}%
          </div>
          {trend === "up" ? (
            <TrendingUp size={12} className={`ml-auto ${getTrendColor()}`} />
          ) : (
            <TrendingDown size={12} className={`ml-auto ${getTrendColor()}`} />
          )}
        </div>
      </div>

      <div className="mt-4 h-8 opacity-30">
        {priceHistory && priceHistory.length > 1 && (
          <TrendChart
            data={priceHistory}
            color={trend === "up" ? "#EF4444" : "#10B981"}
            width={200}
            height={32}
          />
        )}
      </div>

      <div className="mt-4 pt-2 border-t border-[var(--panel-border)] flex items-center justify-between text-[8px] font-mono text-[var(--text-muted)]">
        <span>GRP: GLOBAL</span>
        <span>VIA: {vendor?.slice(0, 10).toUpperCase() || "DIRECT"}</span>
      </div>
    </div>
  );
}
