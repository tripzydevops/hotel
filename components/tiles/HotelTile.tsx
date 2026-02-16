"use client";

import {
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  Trash2,
  Edit2,
  Hotel as HotelIcon,
  Tag,
  AlertTriangle,
} from "lucide-react";
import FallbackImage from "@/components/ui/FallbackImage";
import { motion } from "framer-motion";

import TrendChart from "@/components/analytics/TrendChart";
import { PricePoint, HotelWithPrice } from "@/types";
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
  offers?: { vendor?: string; price?: number }[];
  onEdit?: (id: string, hotel: HotelWithPrice) => void;
  onViewDetails?: (hotel: HotelWithPrice) => void;
  isEnterprise?: boolean;
  amenities?: string[];
  images?: { thumbnail?: string; original?: string }[];

  // Variant specific props
  variant?: "target" | "competitor";
  rank?: number;
  isUndercut?: boolean;
  headerBadges?: ReactNode;
  footerStats?: boolean;
  priority?: boolean;
  isEstimated?: boolean;
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
    offers,
    onEdit,
    onViewDetails,
    isEnterprise = false,
    amenities,
    images,
    variant = "competitor",
    // rank removed from destructuring
    isUndercut,
    headerBadges,
    footerStats = false,
    priority = false,
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
  // User Request: Make "My Hotel" card smaller
  const padding = isTarget ? "p-4 sm:p-5" : "p-4";
  const titleSize = isTarget ? "text-lg font-bold" : "text-xs font-bold";
  const imageSize = isTarget ? "w-10 h-10 sm:w-14 sm:h-14" : "w-10 h-10";

  return (
    <motion.div
      whileHover={{ scale: 1.01, translateY: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`card-blur ${padding} flex flex-col ${isTarget ? "" : "justify-between"} group/card relative overflow-visible rounded-[2rem]`}
    >
      {/* Target Gradient Overlay */}
      {isTarget && (
        <div className="absolute inset-0 bg-gradient-to-br from-[#F6C344]/5 to-transparent pointer-events-none" />
      )}
      {/* Header */}
      <div
        className={`flex items-start justify-between ${isTarget ? "mb-4" : "mb-3"}`}
      >
        {/* 
          Main Content Container: Added min-w-0 and flex-1 to verify 
          that the text container can shrink and doesn't push the 
          action buttons out of the card.
        */}
        <div
          className={`flex items-center min-w-0 flex-1 ${isTarget ? "gap-3" : "gap-3"}`}
        >
          {isTarget && (
            <div
              className={`relative flex-shrink-0 ${imageSize} rounded-xl overflow-hidden bg-[var(--soft-gold)]/10 flex items-center justify-center border border-white/5`}
            >
              {imageUrl || (images && images.length > 0) ? (
                <FallbackImage
                  src={
                    imageUrl ||
                    images?.[0]?.original ||
                    images?.[0]?.thumbnail ||
                    ""
                  }
                  alt={name}
                  fill
                  className="object-cover"
                  sizes={isTarget ? "(max-width: 640px) 100vw, 800px" : "64px"}
                  priority={priority}
                  // @ts-ignore
                  iconClassName={
                    isTarget
                      ? "w-8 h-8 text-[var(--soft-gold)]"
                      : "w-5 h-5 text-[var(--text-secondary)]"
                  }
                />
              ) : (
                <Building2 className="w-8 h-8 text-[var(--soft-gold)]" />
              )}
              {/* Star rating removed from image as it was deemed "cheap" looking */}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {/* Primary Label */}
              <span
                className={`text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-full border shadow-sm ${
                  isTarget
                    ? "text-[#F6C344] bg-[#F6C344]/10 border-[#F6C344]/20"
                    : "text-slate-400 bg-white/5 border-white/10"
                }`}
              >
                {isTarget ? t("common.myHotel") : t("common.competitor")}
              </span>

              {/* Rating */}
              {rating && (
                <span className="text-[10px] font-bold text-slate-400 bg-white/5 px-2 py-1 rounded-full flex items-center gap-1 border border-white/5">
                  ★ {rating.toFixed(1)}
                </span>
              )}

              {/* 
                EXPLANATION: Estimated / Sold Out Tag
                This badge is triggered when the backend flags a price as 'is_estimated'.
                This happens under 'Smart Continuity' rules (sold out dates) or 
                when a suspicious price drop was rejected by the Safeguard agent.
              */}
              {props.isEstimated && (
                <span className="text-[10px] font-black text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20 flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-3 h-3" />
                  {t("common.estimated") || "ESTIMATED / SOLD OUT"}
                </span>
              )}

              {/* User Request: Removed Rank Badges and Undercut Status to fix layout overlap */}
            </div>
            <h2
              className={`${titleSize} text-white leading-tight mb-1 line-clamp-3 pr-1`}
              title={name}
            >
              {name}
            </h2>
            {stars && (
              <div className="flex items-center gap-0.5 mb-1 px-1.5 py-0.5 rounded-md bg-[#F6C344]/10 border border-[#F6C344]/20 w-fit">
                {[...Array(Math.min(5, stars))].map((_, i) => (
                  <span
                    key={i}
                    className="text-[10px] text-[#F6C344] font-bold"
                  >
                    ★
                  </span>
                ))}
              </div>
            )}
            {location && (
              <p className="text-sm text-[var(--text-muted)] mt-0.5 truncate">
                {location}
              </p>
            )}

            {/* Removed amenities and offers badges as requested */}
          </div>
        </div>

        {/* Actions */}
        <div
          className={`flex ${isTarget ? "flex-row items-center gap-2" : "flex-row items-start gap-1"} flex-shrink-0 ml-1`}
        >
          {isTarget ? (
            // Target Hotel: Horizontal Layout
            <>
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(id, {
                      id,
                      name,
                      location,
                      is_target_hotel: isTarget,
                      user_id: "",
                      created_at: "",
                      price_info: {
                        current_price: currentPrice,
                        currency,
                        trend,
                        change_percent: changePercent,
                        recorded_at: lastUpdated || "",
                      },
                    } as HotelWithPrice);
                  }}
                  className="p-2.5 rounded-xl transition-all shadow-lg bg-white/10 text-white border border-white/10 hover:bg-white/20 hover:scale-110 active:scale-95"
                  title={t("common.edit")}
                  aria-label={t("common.edit")}
                >
                  <Edit2 className="w-5 h-5" />
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
                      image_url: imageUrl,
                      user_id: "",
                      created_at: "",
                      is_target_hotel: isTarget,
                      price_info: {
                        currency,
                        current_price: currentPrice,
                        offers,
                        previous_price: previousPrice,
                        trend,
                        change_percent: changePercent,
                        recorded_at: lastUpdated || "",
                      },
                      amenities,
                      images,
                      stars,
                      rating,
                    } as HotelWithPrice);
                  }}
                  className="p-2.5 rounded-xl transition-all shadow-lg bg-[#F6C344] text-[#050B18] hover:bg-[#EAB308] hover:scale-110 active:scale-95"
                  title={t("common.view")}
                  aria-label={t("common.view")}
                >
                  <Building2 className="w-5 h-5" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(id);
                  }}
                  className="p-2.5 rounded-xl transition-all shadow-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white hover:scale-110 active:scale-95"
                  title={t("common.delete")}
                  aria-label={t("common.delete")}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              <div
                className={`p-2 rounded-xl bg-white/5 border border-white/5 ${getTrendColor()}`}
              >
                {getTrendIcon("w-8 h-8")}
              </div>
            </>
          ) : (
            // Competitor: Vertical Layout for Buttons to save width
            <>
              <div
                className={`px-1.5 py-1 rounded-md ${getTrendBgColor()} flex flex-col items-center justify-center gap-0.5 self-center mr-1 min-w-[45px]`}
              >
                {getTrendIcon("w-3 h-3")}
                <span
                  className={`text-[10px] font-medium leading-none ${changePercent > 0 ? "text-optimal-green" : changePercent < 0 ? "text-alert-red" : "text-[var(--text-muted)]"}`}
                >
                  {changePercent > 0 ? "+" : ""}
                  {Math.abs(changePercent).toFixed(1)}%
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                {/* View on Top */}
                {onViewDetails && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDetails({
                        id,
                        name,
                        location,
                        image_url: imageUrl,
                        user_id: "",
                        created_at: "",
                        is_target_hotel: isTarget,
                        price_info: {
                          currency,
                          current_price: currentPrice,
                          offers,
                          previous_price: previousPrice,
                          trend,
                          change_percent: changePercent,
                          recorded_at: lastUpdated || "",
                        },
                        amenities,
                        images,
                        stars,
                        rating,
                      } as HotelWithPrice);
                    }}
                    className="p-1.5 rounded-lg transition-all shadow-sm bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5"
                    title={t("common.view")}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {/* Edit Under View */}
                {onEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(id, {
                        id,
                        name,
                        location,
                        is_target_hotel: isTarget,
                        user_id: "",
                        created_at: "",
                        price_info: {
                          current_price: currentPrice,
                          currency,
                          trend,
                          change_percent: changePercent,
                          recorded_at: lastUpdated || "",
                        },
                      } as HotelWithPrice);
                    }}
                    className="p-1.5 rounded-lg transition-all shadow-sm bg-white/5 hover:bg-white/10 text-slate-400 hover:text-[#F6C344] border border-white/5"
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
                    className="p-1.5 rounded-lg transition-all shadow-sm bg-white/5 hover:bg-red-500/20 text-red-400/50 hover:text-red-400 border border-white/5"
                    title={t("common.delete")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </>
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
              <p className="text-[10px] font-bold tracking-widest text-[#F6C344] mb-2 uppercase flex items-center justify-center gap-2">
                <span className="w-1 h-1 rounded-full bg-[#F6C344] animate-pulse" />
                {/* 
                  EXPLANATION: Localization of Live Market Rate
                  Using i18n to ensure "Live Market Rate" follows the user's selected language.
                */}
                {t("dashboard.liveMarketRate") || "Live Market Rate"}
              </p>
              <div className="relative inline-block mb-1">
                {currentPrice > 0 ? (
                  <div className="flex flex-col items-center">
                    <p className="text-2xl sm:text-4xl font-black text-white tracking-tighter transition-all">
                      {formatPrice(currentPrice)}
                    </p>
                    {vendor && (
                      <span className="mt-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest px-3 py-1 rounded-full border border-white/5 bg-white/5">
                        {/* 
                          EXPLANATION: Found via localization
                          Ensuring the data source attribution is localized.
                        */}
                        {t("hotelDetails.foundVia") || "Found via"} {vendor}
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
              className={`text-[10px] uppercase tracking-widest px-3 py-1 rounded-full border ${isTarget ? "mt-2 font-bold text-[#F6C344] border-[#F6C344]/20 bg-[#F6C344]/5" : "text-[#F6C344] font-bold ml-1 border-[#F6C344]/20 py-0.5 bg-[#F6C344]/5"}`}
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
    </motion.div>
  );
}
