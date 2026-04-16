"use client";

import {
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  Trash2,
  Edit2,
  Users,
  Zap,
  Cpu,
  AlertTriangle,
  MapPin,
  Calendar,
  Info,
  Phone,
  Mail,
  Globe,
} from "lucide-react";
import { useModalContext } from "@/components/ui/ModalContext";
import FallbackImage from "@/components/ui/FallbackImage";
import { motion } from "framer-motion";

import TrendChart from "@/components/analytics/TrendChart";
import { getStarRating, formatCurrency, formatDate, calculateNights } from "@/lib/utils";
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

  // Handlers
  lastUpdated?: string;
  onDelete?: (id: string) => void;
  rating?: number;
  stars?: number;
  imageUrl?: string;
  vendor?: string;
  priceHistory?: PricePoint[];
  checkIn?: string;
  checkOut?: string;
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
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  description?: string;
  cid?: string;
  placeId?: string;
  isScanning?: boolean;
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
    checkOut,
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
    phone,
    email,
    website,
    address,
    description,
    cid,
    placeId,
    isScanning = false,
  } = props;

  const { openIntradayModal } = useModalContext();

  const handleIntradayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Simulate intraday events for the demo with the correct schema
    const mockEvents = [
      {
        id: "1",
        recorded_at: new Date(Date.now() - 4 * 3600000).toISOString(),
        price: currentPrice + 150,
        vendor: "Booking.com",
        label: "Morning Peak",
        narrative: "Initial high rate detected during morning scan. Market demand was peaking."
      },
      {
        id: "2",
        recorded_at: new Date(Date.now() - 2 * 3600000).toISOString(),
        price: currentPrice + 50,
        vendor: "Expedia",
        label: "Midday Adjustment",
        narrative: "Competitor lowered price by 5% due to sudden low occupancy signals in this district."
      },
      {
        id: "3",
        recorded_at: new Date(Date.now() - 30 * 60000).toISOString(),
        price: currentPrice,
        vendor: vendor || "Direct",
        label: "Current",
        narrative: "Market scarcity detected. Only a few rooms remaining at this optimized rate."
      }
    ];
    openIntradayModal(mockEvents, name);
  };

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
            className={`${size} ${variant === "target" ? "text-[var(--alert-red)]" : "text-[var(--optimal-green)]"}`}
          />
        );
      case "down":
        return (
          <TrendingDown
            className={`${size} ${variant === "target" ? "text-[var(--optimal-green)]" : "text-[var(--alert-red)]"}`}
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
          ? "text-[var(--alert-red)]"
          : "text-[var(--optimal-green)]";
      case "down":
        return variant === "target"
          ? "text-[var(--optimal-green)]"
          : "text-[var(--alert-red)]";
      default:
        return "text-[var(--text-muted)]";
    }
  };

  const getTrendBgColor = () => {
    switch (trend) {
      case "up":
        return "bg-[var(--optimal-green-soft)]";
      case "down":
        return "bg-[var(--alert-red-soft)]";
      default:
        return "bg-[var(--glass-bg)]";
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
      className={`glass-card ${padding} flex flex-col ${isTarget ? "ring-2 ring-[var(--soft-gold)]/30" : "justify-between"} group/card relative overflow-visible`}
    >
      {/* Target Gold Glow */}
      {isTarget && (
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--soft-gold)]/10 via-transparent to-transparent pointer-events-none" />
      )}
      {/* Header */}
      <div
        className={`flex items-start justify-between ${isTarget ? "mb-6" : "mb-3"}`}
      >
        <div
          className={`flex items-center min-w-0 flex-1 ${isTarget ? "gap-4" : "gap-3"}`}
        >
          {isTarget && (
            <div
              className={`relative flex-shrink-0 ${imageSize} rounded-2xl overflow-hidden bg-[var(--soft-gold)]/20 flex items-center justify-center border-2 border-[var(--soft-gold)]/30 shadow-2xl`}
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
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {/* Primary Label */}
              <span
                className={`text-[10px] uppercase tracking-[0.15em] font-bold px-3 py-1 rounded-lg border-2 shadow-sm ${
                  isTarget
                    ? "text-[var(--soft-gold)] bg-[var(--soft-gold)]/15 border-[var(--soft-gold)]/30"
                    : "text-[var(--text-secondary)] bg-[var(--glass-bg-accent)] border-[var(--glass-border)]"
                }`}
              >
                {isTarget ? t("common.myHotel") : t("common.competitor")}
              </span>

              {/* Rating */}
              {rating && (
                <span className="text-[10px] font-bold text-[var(--text-primary)] bg-[var(--glass-bg-accent)] px-3 py-1 rounded-lg flex items-center gap-1.5 border-2 border-[var(--glass-border)]">
                  <span className="text-[var(--soft-gold)]">★</span> {rating.toFixed(1)}
                </span>
              )}

              {props.isEstimated && (
                <span className="text-[10px] font-bold text-[var(--alert-red)] bg-[var(--alert-red)]/15 px-3 py-1 rounded-lg border-2 border-[var(--alert-red)]/30 flex items-center gap-1.5 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {t("common.estimated") || "ESTIMATED"}
                </span>
              )}

              {/* Real-time Scan Status */}
              {isScanning && (
                <div className="ml-auto sm:ml-0 flex items-center gap-2 text-[10px] font-bold text-[var(--optimal-green)] bg-[var(--optimal-green)]/15 px-3 py-1 rounded-lg border border-[var(--optimal-green)]/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--optimal-green)] animate-pulse" />
                  {t("common.scanning") || "SCANNING..."}
                </div>
              )}
            </div>
            <h2
              className={`${titleSize} text-[var(--text-primary)] leading-tight mb-2 line-clamp-2 pr-2 font-montserrat tracking-tight`}
              title={name}
            >
              {name}
            </h2>
            {stars && (
              <div className="flex items-center gap-0.5 mb-2 px-2 py-1 rounded-lg bg-[var(--soft-gold)]/10 border-2 border-[var(--soft-gold)]/20 w-fit">
                {Array.from({ length: Math.max(0, Math.min(5, Math.floor(Number(stars) || 0))) }).map((_, i) => (
                  <span
                    key={i}
                    className="text-[10px] text-[var(--soft-gold)] font-bold"
                  >
                    ★
                  </span>
                ))}
              </div>
            )}
            {location && (
              <p className="text-sm font-medium text-[var(--text-secondary)] mt-1 truncate flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[var(--soft-gold)]" />
                {location}
              </p>
            )}
          </div>
        </div>

        {/* Actions - Restored Tactical Layout */}
        <div
          className={`flex ${isTarget ? "flex-row items-center gap-3" : "flex-row items-start gap-2"} flex-shrink-0 ml-2`}
        >
          {isTarget ? (
            <>
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(id, props as any);
                  }}
                  className="p-3 rounded-2xl transition-all shadow-xl bg-[var(--glass-bg-accent)] text-[var(--text-primary)] border-2 border-[var(--glass-border)] hover:border-[var(--soft-gold)] hover:scale-110 active:scale-95"
                  title={t("common.edit")}
                >
                  <Edit2 className="w-5 h-5" />
                </button>
              )}
              {onViewDetails && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDetails(props as any);
                  }}
                  className="p-3 rounded-2xl transition-all shadow-xl bg-[var(--soft-gold)] text-[var(--deep-ocean)] hover:brightness-110 hover:scale-110 active:scale-95 ring-4 ring-[var(--soft-gold)]/20"
                  title={t("common.view")}
                >
                  <Building2 className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={handleIntradayClick}
                className="p-3 rounded-2xl transition-all shadow-xl bg-[var(--optimal-green)]/20 text-[var(--optimal-green)] border-2 border-[var(--optimal-green)]/30 hover:bg-[var(--optimal-green)]/30 hover:scale-110 active:scale-95"
                title={t("intradayStory.viewAiStory")}
              >
                <Zap className="w-5 h-5 fill-current" />
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              {onViewDetails && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDetails(props as any);
                  }}
                  className="p-2 rounded-xl transition-all bg-[var(--glass-bg-accent)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-2 border-[var(--glass-border)] hover:border-[var(--soft-gold)] shadow-sm"
                  title={t("common.view")}
                >
                  <Building2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleIntradayClick}
                className="p-2 rounded-xl transition-all bg-[var(--optimal-green)]/10 text-[var(--optimal-green)] border-2 border-[var(--optimal-green)]/20 hover:bg-[var(--optimal-green)]/20 hover:scale-105 active:scale-95"
                title={t("intradayStory.viewAiStory")}
              >
                <Zap className="w-4 h-4 fill-current" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Stat Block - Frame Tinting Applied */}
      <div
        className={`flex-1 flex flex-col ${isTarget ? "justify-center py-8" : "mt-4"} rounded-2xl bg-[var(--glass-bg-accent)] border-2 border-[var(--glass-border)] p-4 relative overflow-hidden`}
      >
        {/* Subtle Shine Background */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[var(--glass-border)] to-transparent opacity-20 rotate-12" />
        
        {/* Scan Parameters - New Section */}
        {(checkIn || adults) && (
          <div className="flex flex-wrap items-center gap-3 mb-4 opacity-70 group-hover/card:opacity-100 transition-opacity">
            {checkIn && (
              <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider bg-[var(--glass-bg)] px-3 py-1.5 rounded-lg border border-[var(--glass-border)] shadow-sm">
                <Calendar className="w-3.5 h-3.5 text-[var(--soft-gold)]" />
                <span className="flex items-center gap-1.5">
                  {formatDate(checkIn, { month: 'short', day: 'numeric' })}
                  {checkOut ? (
                    <>
                      <span className="opacity-30">→</span>
                      {formatDate(checkOut, { month: 'short', day: 'numeric' })}
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] text-[9px]">
                        {(() => {
                            const nights = calculateNights(new Date(checkIn), new Date(checkOut));
                            return t("scanSettings.nightCount", { 0: nights, 1: nights > 1 ? 's' : '' });
                        })()}
                      </span>
                    </>
                  ) : ""}
                </span>
              </div>
            )}
            {adults !== undefined && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider bg-[var(--glass-bg)] px-3 py-1.5 rounded-lg border border-[var(--glass-border)] shadow-sm">
                <Users className="w-3.5 h-3.5 text-[var(--soft-gold)]" />
                <span>{t("scanSettings.adultCount", { 0: adults, 1: adults > 1 ? 's' : '' })}</span>
              </div>
            )}
          </div>
        )}

        <div className={`${isTarget ? "text-center" : "flex items-center justify-between"}`}>
          <div>
            <p className={`tactical-label mb-1 ${isTarget ? "justify-center" : ""}`}>
              {t("dashboard.liveMarketRate")}
            </p>
            <p className={`${isTarget ? "text-4xl font-black" : "text-2xl font-bold"} text-[var(--text-primary)] tracking-tight`}>
              {currentPrice > 0 ? formatPrice(currentPrice) : "—"}
            </p>
          </div>

          <div className={`flex flex-col items-end ${isTarget ? "mt-4 items-center" : ""}`}>
             <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${getTrendBgColor()} border-2 border-[var(--glass-border)]`}>
                {getTrendIcon("w-4 h-4")}
                <span className={`text-xs font-black ${changePercent > 0 ? "text-[var(--alert-red)]" : "text-[var(--optimal-green)]"}`}>
                  {changePercent > 0 ? "+" : ""}{changePercent.toFixed(1)}%
                </span>
             </div>
             {vendor && (
               <span className="text-[10px] font-bold text-[var(--text-muted)] mt-2 uppercase tracking-widest">
                 {t("intradayStory.via")} {vendor}
               </span>
             )}
             {lastUpdated && !isTarget && (
               <div className="flex items-center gap-1.5 mt-3 text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-tighter opacity-60 group-hover/card:opacity-100 transition-opacity">
                 <div className="w-1.5 h-1.5 rounded-full bg-[var(--optimal-green)] animate-pulse" />
                 {t("dashboard.marketSynchronized")}: {lastUpdated}
               </div>
             )}
          </div>
        </div>
      </div>

      {/* Footer Stats - Restored Card Identity */}
      {footerStats && (
        <div className="mt-6 flex items-center justify-between pt-6 border-t-2 border-[var(--glass-border)]">
          <div className="text-center">
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 tracking-tighter">{t("dashboard.previous")}</p>
            <p className="text-sm font-bold text-[var(--text-primary)] opacity-80">{previousPrice ? formatPrice(previousPrice) : "—"}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1 tracking-tighter">{t("dashboard.synchronized")}</p>
            <p className="text-sm font-bold text-[var(--text-primary)] opacity-80">{lastUpdated || t("intradayStory.justNow")}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
