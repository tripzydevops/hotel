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
  Phone,
  Mail,
  Globe,
  MapPin,
  Info,
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
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  description?: string;
  cid?: string;
  placeId?: string;
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
    phone,
    email,
    website,
    address,
    description,
    cid,
    placeId,
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
      className={`glass-modal ${padding} flex flex-col ${isTarget ? "border-[var(--soft-gold)]/40 shadow-[0_0_40px_rgba(212,175,55,0.15)]" : "border-[var(--glass-border)]"} group/card relative overflow-visible`}
    >
      {/* Target Gold Glow */}
      {isTarget && (
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[var(--soft-gold)]/50 to-transparent pointer-events-none" />
      )}
      
      {/* HUD-style corners */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[var(--soft-gold)]/30 rounded-tl-lg pointer-events-none" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[var(--soft-gold)]/30 rounded-tr-lg pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[var(--soft-gold)]/30 rounded-bl-lg pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[var(--soft-gold)]/30 rounded-br-lg pointer-events-none" />

      {/* Header */}
      <div
        className={`flex items-start justify-between ${isTarget ? "mb-6" : "mb-3"}`}
      >
        <div
          className={`flex items-center min-w-0 flex-1 ${isTarget ? "gap-4" : "gap-3"}`}
        >
          {isTarget && (
            <div
              className={`relative flex-shrink-0 ${imageSize} rounded-2xl overflow-hidden bg-[var(--deep-ocean-lighter)] flex items-center justify-center border border-[var(--soft-gold)]/30 shadow-2xl group-hover/card:border-[var(--soft-gold)]/60 transition-colors`}
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
                  className="object-cover opacity-80 group-hover/card:opacity-100 transition-opacity"
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
              {/* Image Scanning Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--soft-gold)]/20 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity pointer-events-none" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {/* Primary Label */}
              <div className="flex items-center gap-1.5 ">
                <span className={`w-1.5 h-1.5 rounded-full ${isTarget ? "bg-[var(--soft-gold)] animate-pulse shadow-[0_0_8px_var(--soft-gold)]" : "bg-[var(--text-muted)]"}`} />
                <span
                  className={`text-[9px] uppercase tracking-[0.25em] font-black ${
                    isTarget
                      ? "text-[var(--soft-gold)]"
                      : "text-[var(--text-muted)]"
                  }`}
                >
                  {isTarget ? t("common.myHotel") : t("common.competitor")}
                </span>
              </div>

              {/* Rating */}
              {rating && (
                <div className="flex items-center gap-1 pl-2 border-l border-[var(--glass-border)]">
                  <span className="text-[10px] font-bold text-[var(--text-primary)]">
                    {rating.toFixed(1)}
                  </span>
                  <span className="text-[8px] text-[var(--soft-gold)] font-black uppercase tracking-tighter">SCORE</span>
                </div>
              )}

              {props.isEstimated && (
                <span className="text-[9px] font-black text-[var(--alert-red)] px-2 py-0.5 rounded bg-[var(--alert-red)]/10 border border-[var(--alert-red)]/20 animate-pulse tracking-widest">
                  {t("common.estimated") || "ESTIMATED"}
                </span>
              )}
            </div>
            <h2
              className={`${titleSize} text-[var(--text-primary)] leading-tight mb-1 line-clamp-1 pr-2 font-montserrat tracking-tight group-hover/card:text-[var(--soft-gold)] transition-colors`}
              title={name}
            >
              {name}
            </h2>
            
            {location && (
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider truncate flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-[var(--soft-gold)]/60" />
                {location}
              </p>
            )}
          </div>
        </div>

        {/* Actions - Tactical Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-2 overflow-hidden">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(id, props as any);
              }}
              className="p-2 rounded-lg transition-all bg-[var(--glass-bg-accent)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--glass-border)] hover:border-[var(--soft-gold)]/50 group/btn"
              title={t("common.edit")}
            >
              <Edit2 className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
            </button>
          )}
          {onViewDetails && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(props as any);
              }}
              className="p-2 rounded-lg transition-all bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] border border-[var(--soft-gold)]/30 hover:bg-[var(--soft-gold)] hover:text-[var(--deep-ocean)] group/btn"
              title={t("common.view")}
            >
              <Info className="w-4 h-4 group-hover/btn:rotate-12 transition-transform" />
            </button>
          )}
        </div>
      </div>

      {/* Main Stat Block - Tactical HUD Layout */}
      <div
        className={`flex-1 flex flex-col ${isTarget ? "justify-center py-6" : "mt-2"} rounded-xl bg-[var(--deep-ocean-lighter)]/50 border border-[var(--glass-border)] p-4 relative group-hover/card:border-[var(--soft-gold)]/20 transition-colors`}
      >
        <div className="absolute top-0 right-0 p-2 overflow-hidden pointer-events-none opacity-10">
          <Building2 className="w-12 h-12 -mr-4 -mt-4 rotate-12" />
        </div>
        
        <div className={`${isTarget ? "flex flex-col items-center" : "flex items-center justify-between"}`}>
          <div className={isTarget ? "text-center mb-4" : ""}>
            <div className={`flex items-center gap-1.5 mb-1 ${isTarget ? "justify-center" : ""}`}>
               <div className="w-1 h-3 bg-[var(--soft-gold)]/60 rounded-full" />
               <p className="text-[9px] uppercase tracking-[0.2em] text-[var(--text-muted)] font-black">
                 {t("dashboard.liveMarketRate")}
               </p>
            </div>
            <p className={`${isTarget ? "text-4xl font-black" : "text-xl font-bold"} text-[var(--text-primary)] tracking-tighter leading-none`}>
              {currentPrice > 0 ? formatPrice(currentPrice) : "—"}
            </p>
          </div>

          <div className={`flex flex-col items-end ${isTarget ? "items-center" : ""}`}>
             <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg-accent)] group-hover/card:border-[var(--soft-gold)]/30 transition-colors`}>
                {getTrendIcon("w-3.5 h-3.5")}
                <span className={`text-[11px] font-black tracking-widest ${changePercent > 0 ? "text-[var(--alert-red)]" : "text-[var(--optimal-green)]"}`}>
                  {changePercent > 0 ? "+" : ""}{changePercent.toFixed(1)}%
                </span>
             </div>
             {vendor && (
               <span className="text-[8px] font-black text-[var(--text-muted)] mt-2 uppercase tracking-[0.25em] opacity-60">
                 DATA SOURCE: {vendor}
               </span>
             )}
          </div>
        </div>
      </div>

      {/* Footer Stats - HUD Meta Info */}
      {footerStats && (
        <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t border-[var(--glass-border)]">
          <div className="flex flex-col">
            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">{t("dashboard.previous")}</p>
            <p className="text-xs font-bold text-[var(--text-primary)]/80 tracking-tight">{previousPrice ? formatPrice(previousPrice) : "—"}</p>
          </div>
          <div className="flex flex-col items-end">
            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">{t("dashboard.updated")}</p>
            <p className="text-xs font-bold text-[var(--text-primary)]/80 tracking-tight underline decoration-[var(--soft-gold)]/30 underline-offset-4">{lastUpdated || "Live"}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
