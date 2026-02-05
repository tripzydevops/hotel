"use client";

import {
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  Trash2,
  Edit2,
  Hotel as HotelIcon,
} from "lucide-react";
import TrendChart from "./TrendChart";
import { PricePoint } from "@/types";
import { useI18n } from "@/lib/i18n";
import { ReactNode } from "react";

export type TrendDirection = "up" | "down" | "stable";

export interface HotelTileProps {
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

  // Variant specific props
  variant?: "target" | "competitor";
  rank?: number;
  isUndercut?: boolean;
  headerBadges?: ReactNode;
  footerStats?: boolean;
}

export default function HotelTile(props: HotelTileProps) {
  const { t } = useI18n();
  const {
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
    images,
    variant = "competitor",
    rank,
    isUndercut,
    headerBadges,
    footerStats = false,
  } = props;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat(currency === "TRY" ? "tr-TR" : "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getTrendIcon = (size = "w-5 h-5") => {
    switch (trend) {
      case "up":
        return (
          <TrendingUp
            className={`${size} ${variant === "target" ? "text-[var(--danger)]" : "text-optimal-green"}`}
          />
        );
      case "down":
        return (
          <TrendingDown
            className={`${size} ${variant === "target" ? "text-[var(--success)]" : "text-alert-red"}`}
          />
        );
      default:
        return <Minus className={`${size} text-[var(--text-muted)]`} />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case "up":
        return variant === "target"
          ? "text-[var(--danger)]"
          : "text-optimal-green";
      case "down":
        return variant === "target"
          ? "text-[var(--success)]"
          : "text-alert-red";
      default:
        return "text-[var(--text-muted)]";
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

  const isTarget = variant === "target";
  const padding = isTarget ? "p-4 sm:p-8" : "p-5";
  const titleSize = isTarget ? "text-xl sm:text-2xl" : "text-sm";
  const imageSize = isTarget ? "w-12 h-12 sm:w-16 sm:h-16" : "w-10 h-10";

  return (
    <div
      className={`glass-card ${padding} flex flex-col ${isTarget ? "" : "justify-between"} group/card relative overflow-hidden ${isUndercut ? "ring-2 ring-red-500/50" : ""}`}
    >
      {/* Header */}
      <div
        className={`flex items-start justify-between ${isTarget ? "mb-6" : "mb-4"}`}
      >
        <div
          className={`flex items-center ${isTarget ? "gap-3 sm:gap-4" : "gap-3"}`}
        >
          <div
            className={`relative ${imageSize} rounded-xl overflow-hidden bg-[var(--soft-gold)]/10 flex items-center justify-center border border-white/5`}
          >
            {imageUrl || (images && images.length > 0) ? (
              <img
                src={
                  imageUrl || images?.[0]?.original || images?.[0]?.thumbnail
                }
                alt={name}
                className="w-full h-full object-cover"
              />
            ) : isTarget ? (
              <Building2 className="w-8 h-8 text-[var(--soft-gold)]" />
            ) : (
              <HotelIcon className="w-5 h-5 text-[var(--text-secondary)]" />
            )}
            {stars && (
              <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-md px-1 rounded text-[8px] text-[var(--soft-gold)] font-bold flex items-center gap-0.5">
                {stars}★
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              {headerBadges}
              {rating && (
                <span className="text-[10px] font-bold text-white bg-white/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                  ★ {rating.toFixed(1)}
                </span>
              )}
              {isUndercut && (
                <span className="text-[10px] text-alert-red font-bold flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-alert-red animate-pulse" />
                  {t("dashboard.undercut")}
                </span>
              )}
            </div>
            <h2
              className={`${titleSize} font-bold text-white leading-tight line-clamp-1`}
              title={name}
            >
              {name}
            </h2>
            {location && (
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                {location}
              </p>
            )}

            {/* Rich Data: Amenities */}
            {isEnterprise && amenities && amenities.length > 0 && (
              <div
                className={`flex flex-wrap gap-1 mt-2 ${!isTarget ? "absolute -bottom-2 left-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none translate-y-full" : ""}`}
              >
                {amenities.slice(0, isTarget ? 3 : 2).map((am, i) => (
                  <span
                    key={i}
                    className={`px-1.5 py-0.5 rounded-md ${isTarget ? "bg-white/5 border border-white/5" : "bg-black/80"} text-[9px] ${isTarget ? "text-[var(--text-muted)]" : "text-[var(--soft-gold)]"}`}
                  >
                    {am}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(id, { id, name, location, is_target_hotel: isTarget });
              }}
              className={`p-2.5 rounded-xl ${isTarget ? "bg-white/5 text-[var(--text-muted)] hover:bg-white/10 hover:text-white" : "hover:bg-white/10 text-[var(--soft-gold)] hover:text-white"} transition-all`}
              title={t("common.edit")}
            >
              <Edit2
                className={`${isTarget ? "w-4.5 h-4.5" : "w-3.5 h-3.5"}`}
              />
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
              className={`p-2.5 rounded-xl ${isTarget ? "bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] hover:bg-[var(--soft-gold)]/20 border border-[var(--soft-gold)]/20" : "hover:bg-white/10 text-[var(--text-muted)] hover:text-white"} transition-all`}
              title={t("common.view")}
            >
              {isTarget ? (
                <Building2 className="w-4.5 h-4.5" />
              ) : (
                <HotelIcon className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(id);
              }}
              className={`p-2.5 rounded-xl ${isTarget ? "bg-white/5 text-[var(--text-muted)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] border border-white/5" : "hover:bg-red-500/20 text-red-500/50 hover:text-red-400"} transition-all`}
              title={t("common.delete")}
            >
              <Trash2
                className={`${isTarget ? "w-4.5 h-4.5" : "w-3.5 h-3.5"}`}
              />
            </button>
          )}

          {isTarget && (
            <div
              className={`p-2 rounded-xl bg-white/5 border border-white/5 ${getTrendColor()}`}
            >
              {getTrendIcon("w-8 h-8")}
            </div>
          )}

          {!isTarget && (
            <div
              className={`px-2 py-1 rounded-md ${getTrendBgColor()} flex items-center gap-1`}
            >
              {getTrendIcon()}
              <span
                className={`text-xs font-medium ${isTarget ? getTrendColor() : trend === "up" ? "text-optimal-green" : trend === "down" ? "text-alert-red" : "text-[var(--text-muted)]"}`}
              >
                {changePercent > 0 ? "+" : ""}
                {changePercent.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Price Display */}
      <div
        className={`flex-1 flex ${isTarget ? "flex-col justify-center py-6" : "items-center justify-between group relative cursor-default"}`}
      >
        <div className={`${isTarget ? "text-center group relative" : ""}`}>
          {!isTarget ? (
            <>
              <p
                className={`text-price-md ${currentPrice > 0 ? "text-white" : "text-[var(--text-muted)] animate-pulse"} transition-colors group-hover:text-[var(--soft-gold)]`}
              >
                {currentPrice > 0 ? formatPrice(currentPrice) : "—"}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">
                  {currentPrice > 0
                    ? t("common.perNight")
                    : t("common.pending")}
                </p>
                {vendor && currentPrice > 0 && (
                  <span className="text-[9px] text-[var(--text-muted)] italic">
                    {t("hotelDetails.foundVia")} {vendor}
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-[10px] font-bold tracking-widest text-[var(--soft-gold)] mb-2 uppercase flex items-center justify-center gap-2">
                <span className="w-1 h-1 rounded-full bg-[var(--soft-gold)] animate-pulse" />
                {t("dashboard.liveRate")}
              </p>
              <div className="relative inline-block mb-1">
                {currentPrice > 0 ? (
                  <div className="flex flex-col items-center">
                    <p className="text-3xl sm:text-5xl font-black text-white tracking-tighter transition-all">
                      {formatPrice(currentPrice)}
                    </p>
                    {vendor && (
                      <span className="mt-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest px-3 py-1 rounded-full border border-white/5 bg-white/5">
                        {t("hotelDetails.foundVia")} {vendor}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-5xl font-bold text-[var(--text-muted)] animate-pulse uppercase">
                    {t("common.pending")}
                  </p>
                )}
              </div>
              {/* Progressive Disclosure for Target */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 px-4 py-2 bg-[var(--deep-ocean-accent)] border border-white/10 rounded-xl text-[10px] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 whitespace-nowrap z-10 pointer-events-none shadow-2xl backdrop-blur-md">
                {t("dashboard.verified")} • {lastUpdated || t("common.pending")}
              </div>
            </>
          )}

          {/* Check-in info shared */}
          {(checkIn || (adults && adults !== 2)) && (
            <span
              className={`text-[10px] uppercase tracking-widest px-3 py-1 rounded-full border ${isTarget ? "mt-2 font-bold text-[var(--soft-gold)] border-[var(--soft-gold)]/20 bg-[var(--soft-gold)]/5" : "text-[var(--soft-gold)] font-bold ml-1 border-[var(--soft-gold)]/20 py-0.5 bg-[var(--soft-gold)]/5"}`}
            >
              {!isTarget && "• "}
              {checkIn
                ? isTarget
                  ? `${t("common.checkIn")} ${new Date(checkIn).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                  : new Date(checkIn).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                : t("common.today")}
              {adults && adults !== 2 ? ` • ${adults} G` : ""}
            </span>
          )}
        </div>

        {/* Trend Chart */}
        {priceHistory && priceHistory.length > 1 && (
          <div
            className={`${isTarget ? "absolute inset-x-8 bottom-0 h-24 opacity-30 pointer-events-none mask-linear-fade" : "w-20 h-10 opacity-60 group-hover:opacity-100 transition-opacity"}`}
          >
            <TrendChart
              data={priceHistory}
              color={
                trend === "up"
                  ? "#EF4444"
                  : trend === "down"
                    ? "#10B981"
                    : "#94A3B8"
              }
              width={isTarget ? 400 : 80}
              height={isTarget ? 96 : 40}
            />
          </div>
        )}

        {!isTarget && (
          <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-[var(--deep-ocean-accent)] border border-white/10 rounded-md text-[9px] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
            {t("dashboard.liveRate")} • {t("dashboard.verified")}
          </div>
        )}
      </div>

      {/* Footer Stats (Target Only usually) */}
      {footerStats && (
        <div className="flex items-center justify-between pt-6 border-t border-white/10">
          <div>
            <p className="text-xs text-[var(--text-muted)]">
              {t("dashboard.previous")}
            </p>
            <p className="text-lg text-[var(--text-secondary)]">
              {previousPrice ? formatPrice(previousPrice) : "—"}
            </p>
          </div>

          <div className="text-center">
            <p className="text-xs text-[var(--text-muted)]">
              {t("dashboard.change")}
            </p>
            <p className={`text-lg font-semibold ${getTrendColor()}`}>
              {changePercent > 0 ? "+" : ""}
              {changePercent.toFixed(1)}%
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs text-[var(--text-muted)]">
              {t("dashboard.updated")}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              {lastUpdated || t("common.pending")}
            </p>
          </div>
        </div>
      )}

      {/* Previous Price for Competitor */}
      {!isTarget && previousPrice && (
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
