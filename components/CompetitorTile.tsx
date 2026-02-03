"use client";

import {
  TrendingUp,
  TrendingDown,
  Minus,
  Hotel,
  Trash2,
  Edit2,
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
  checkIn?: string;
  adults?: number;
  onEdit?: (id: string, hotel: any) => void;

  onViewDetails?: (hotel: any) => void;
  isEnterprise?: boolean;
  amenities?: string[];
  images?: { thumbnail?: string; original?: string }[];
}

export default function CompetitorTile(props: CompetitorTileProps) {
  const { t } = useI18n();
  const {
    id,
    name,
    currentPrice,
    previousPrice,
    currency = "TRY",
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
    checkIn,
    adults,
    onEdit,
    onViewDetails,
    isEnterprise = false,
    amenities,
    images,
  } = props;
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat(currency === "TRY" ? "tr-TR" : "en-US", {
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
        glass-panel-premium p-5 flex flex-col justify-between relative overflow-hidden
        ${isUndercut ? "ring-2 ring-red-500/50" : ""}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center border border-white/5">
            {image_src ? (
              <img
                src={image_src}
                alt={name}
                className="w-full h-full object-cover"
              />
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
              {/* Rich Data: Amenities (Mini) */}
              {isEnterprise && amenities && amenities.length > 0 && (
                <div className="absolute -bottom-2 left-0 flex gap-0.5 translate-y-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {amenities.slice(0, 2).map((am, i) => (
                    <span
                      key={i}
                      className="px-1 py-0.5 rounded-[2px] bg-black/80 text-[7px] text-[var(--soft-gold)] whitespace-nowrap"
                    >
                      {am}
                    </span>
                  ))}
                </div>
              )}
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
                  {t("dashboard.undercut")}
                </span>
              )}
              {onViewDetails && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDetails({
                      id,
                      name,
                      imageUrl: image_src,
                      price_info: { currency, current_price: currentPrice },
                    });
                  }}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-[var(--text-muted)] hover:text-white transition-colors"
                  title={t("common.view")}
                >
                  <Hotel className="w-3.5 h-3.5" />
                </button>
              )}
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(id, { id, name });
                  }}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-[var(--soft-gold)] hover:text-white transition-colors"
                  title={t("common.edit")}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(id);
                  }}
                  className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-500/50 hover:text-red-400 transition-colors"
                  title={t("common.delete")}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Trend Badge & Actions */}
        <div className="flex items-center gap-2">
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
          <p
            className={`text-price-md ${currentPrice > 0 ? "text-white" : "text-[var(--text-muted)] animate-pulse"} transition-colors group-hover:text-[var(--soft-gold)]`}
          >
            {currentPrice > 0 ? formatPrice(currentPrice) : "—"}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">
              {currentPrice > 0 ? t("common.perNight") : t("common.pending")}
            </p>
            {vendor && currentPrice > 0 && (
              <span className="text-[9px] text-[var(--text-muted)] italic">
                {t("hotelDetails.foundVia")} {vendor}
              </span>
            )}
            {(checkIn || (adults && adults !== 2)) && (
              <span className="text-[9px] text-[var(--soft-gold)] font-bold ml-1 border border-[var(--soft-gold)]/20 px-1.5 py-0.5 rounded-full bg-[var(--soft-gold)]/5">
                •{" "}
                {checkIn
                  ? new Date(checkIn).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : t("common.today")}
                {adults && adults !== 2 ? ` • ${adults} G` : ""}
              </span>
            )}
          </div>
        </div>

        {/* Trend Chart */}
        {priceHistory && priceHistory.length > 1 && (
          <div className="w-20 h-10 opacity-60 group-hover:opacity-100 transition-opacity">
            <TrendChart
              data={priceHistory}
              color={
                trend === "up"
                  ? "#EF4444"
                  : trend === "down"
                    ? "#10B981"
                    : "#94A3B8"
              }
              width={80}
              height={40}
            />
          </div>
        )}

        {/* Progressive Disclosure: Hover Tooltip */}
        <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-[var(--deep-ocean-accent)] border border-white/10 rounded-md text-[9px] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
          {t("dashboard.liveRate")} • {t("dashboard.verified")}
        </div>
      </div>

      {/* Previous Price */}
      {previousPrice && (
        <div className="pt-3 border-t border-white/5">
          <p className="text-xs text-[var(--text-muted)]">
            {t("dashboard.previous")}:{" "}
            <span className="text-[var(--text-secondary)]">
              {formatPrice(previousPrice)}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
