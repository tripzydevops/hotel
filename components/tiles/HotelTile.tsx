"use client";

import {
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  Trash2,
  Edit2,
  MapPin,
  RefreshCw,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  Hotel,
  Layers,
  Globe,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import FallbackImage from "@/components/ui/FallbackImage";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency, parsePrice, normalizeVendor } from "@/lib/utils";
import { HotelWithPrice, PricePoint, HotelImage } from "@/types";
import { useI18n } from "@/lib/i18n";
import { ReactNode, useState } from "react";
import { getStandardizedRoomCategory } from "@/utils/roomNormalization";
import { useSignalBuffer } from "@/hooks/useSignalBuffer";

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
  onEdit?: (id: string, hotel: HotelWithPrice) => void;
  onViewDetails?: (hotel: HotelWithPrice) => void;
  onSetTarget?: (id: string) => void;
  isEnterprise?: boolean;
  amenities?: string[];
  images?: HotelImage[];
  offers?: { vendor?: string; source?: string; price?: number; currency?: string; url?: string; room_type?: string }[];
  room_types?: { name?: string; price?: number; currency?: string }[];
  isEstimated?: boolean;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  description?: string;
  cid?: string;
  placeId?: string;
  variant?: "target" | "competitor";
  isUndercut?: boolean;
  headerBadges?: ReactNode;
  isScanning?: boolean;
  footerStats?: boolean;
  priority?: boolean;
}

export default function HotelTile(props: HotelTileProps) {
  const { t } = useI18n();
  const { track } = useSignalBuffer();

  const [showAllOffers, setShowAllOffers] = useState(false);
  
  // Atomic derivation of best price and vendor (Standard Rooms only)
  const allOffers = (props.offers || []).filter(offer => 
    getStandardizedRoomCategory(offer.room_type || "") === "Standard"
  );
  const sortedOffers = [...allOffers].sort((a, b) => 
    parsePrice(a.price || 0) - parsePrice(b.price || 0)
  );

  const bestOffer = sortedOffers.length > 0 ? sortedOffers[0] : null;
  const otherOffers = sortedOffers.slice(1);

  const displayPriceValue = (bestOffer && parsePrice(bestOffer.price || 0) > 0)
    ? parsePrice(bestOffer.price || 0)
    : parsePrice(props.currentPrice || 0);
    
  const rawVendor = bestOffer?.vendor || bestOffer?.source || props.vendor || "UNSPECIFIED";
  const displayVendor = normalizeVendor(rawVendor);
  const currency = props.currency || bestOffer?.currency || "TRY";

  const {
    id,
    name,
    trend,
    changePercent,
    imageUrl,
    onEdit,
    onViewDetails,
    onSetTarget,
    onDelete,
    variant = "competitor",
    isScanning = false,
  } = props;

  return (
    <motion.div
      tabIndex={0}
      role="button"
      aria-label={`View details for ${name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewDetails?.(props as any);
        }
      }}
      whileHover={{ y: -5 }}
      layout
      className={`glass-card group cursor-pointer flex flex-col h-full overflow-hidden border border-[var(--glass-border)] ${variant === "competitor" ? "border-l-4 border-l-[var(--soft-gold)]" : "border-l-4 border-l-emerald-500"}`}
    >
      {/* Tactical Image Header */}
      <div className="relative aspect-video w-full overflow-hidden bg-[var(--deep-ocean-accent)]" onClick={() => onViewDetails?.(props as any)}>
        {imageUrl ? (
          <FallbackImage
            src={imageUrl}
            alt={name}
            fill
            priority={props.priority}
            className="object-cover transition-transform duration-700 group-hover:scale-110"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--deep-ocean)] to-[var(--deep-ocean-accent)]">
            <Hotel className="w-12 h-12 text-[var(--soft-gold)]/20" />
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--deep-ocean)]/90 via-[var(--deep-ocean)]/20 to-transparent" />
        
        {/* Badges Overlay */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
           {props.headerBadges}
           {isScanning && (
             <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-optimal-green/20 backdrop-blur-md border border-optimal-green/30 text-[9px] font-black text-optimal-green uppercase animate-pulse">
               <RefreshCw className="w-2.5 h-2.5 animate-spin" />{t("common.scanning")}</span>
           )}
        </div>

        {props.isUndercut && (
          <div className="absolute top-3 right-3 px-2 py-1 bg-optimal-green text-[var(--overlay-text)] text-[9px] font-black rounded-sm uppercase tracking-tighter shadow-lg flex items-center gap-1">
            <TrendingDown className="w-3 h-3" />{t("hotelDetails.optimalPrice")}</div>
        )}

        {props.rating && (
          <div className="absolute bottom-3 left-3 px-2 py-0.5 bg-[var(--overlay-bg)] backdrop-blur-md rounded border border-[var(--overlay-border)] flex items-center gap-1 text-[10px] font-bold text-[var(--overlay-text)]">
            <span className="text-[11px] text-[var(--soft-gold)]">★</span>
            {props.rating.toFixed(1)}
          </div>
        )}

        {/* Room Variety Badge */}
        {props.room_types && props.room_types.length > 0 && (
          <div className="absolute bottom-3 right-3 px-2 py-0.5 bg-[var(--overlay-bg)] backdrop-blur-md rounded border border-[var(--overlay-border)] flex items-center gap-1 text-[9px] font-black text-[var(--overlay-text)] uppercase tracking-widest">
            <Layers className="w-2.5 h-2.5 text-[var(--soft-gold)]" />
            {props.room_types.length} Varieties
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1 bg-[var(--glass-bg)]">
        {/* Core Identity */}
        <div className="flex items-start justify-between mb-4" onClick={() => onViewDetails?.(props as any)}>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-black text-[var(--text-primary)] leading-tight tracking-tighter uppercase italic group-hover:text-[var(--soft-gold)] transition-colors truncate">
              {name}
            </h3>
            <p className="text-[10px] text-[var(--text-muted)] mt-1 uppercase font-bold tracking-widest flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 text-[var(--soft-gold)]/50 flex-shrink-0" />
              {props.location || t("hotelDetails.locationUnknown")}
            </p>
          </div>
          
          <div className="text-right flex-shrink-0 ml-4">
            <div className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1 opacity-50">{t("hotelDetails.leadRate")}</div>
            <div className="text-2xl font-black text-[var(--soft-gold)] tracking-tighter italic leading-none">
              {displayPriceValue > 0 ? formatCurrency(displayPriceValue, currency) : "---"}
            </div>
            <div className="text-[9px] uppercase text-[var(--text-primary)] bg-[var(--soft-gold)]/10 px-2 py-0.5 rounded-sm mt-1.5 inline-block border border-[var(--soft-gold)]/20 font-black tracking-widest">
              {displayVendor}
            </div>
          </div>
        </div>

        {/* Market Presence Section (Multiple OTAs) */}
        {allOffers.length > 0 && (
          <div className="mb-4 pt-4 border-t border-[var(--glass-border)]">
            <div 
              className="flex items-center justify-between cursor-pointer group/toggle mb-2"
              onClick={() => {
                const next = !showAllOffers;
                setShowAllOffers(next);
                if (next) {
                  // Track competitor expansion for CompsetIntelligenceAgent
                  track('competitor_expand', { hotel_id: id, hotel_name: name, offers_count: allOffers.length });
                }
              }}
            >
              <div className="flex items-center gap-1.5 text-[9px] text-[var(--text-muted)] uppercase font-black tracking-[0.2em] opacity-60">
                <Globe className="w-2.5 h-2.5" />
                {t("hotelDetails.marketPresence")} ({allOffers.length})
              </div>
              {allOffers.length > 1 && (
                <div className="text-[9px] font-black text-[var(--soft-gold)] flex items-center gap-1 uppercase tracking-widest">
                  {showAllOffers ? t("common.collapse") : t("common.compare")}
                  {showAllOffers ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              {/* Primary Offer (Visual emphasis) */}
              <div className="flex flex-col p-2 rounded bg-[var(--soft-gold)]/5 border border-[var(--soft-gold)]/20">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-[var(--text-primary)] uppercase truncate max-w-[120px]">
                    {displayVendor}
                  </span>
                  <span className="text-[11px] font-black text-[var(--soft-gold)] italic">
                    {formatCurrency(displayPriceValue, currency)}
                  </span>
                </div>
                {bestOffer?.room_type && (
                  <span className="text-[8px] text-[var(--text-muted)] uppercase tracking-widest mt-0.5 truncate max-w-[200px]">
                    {bestOffer.room_type}
                  </span>
                )}
              </div>

              {/* Other Offers (Animated) */}
              <AnimatePresence>
                {showAllOffers && otherOffers.map((offer, idx) => (
                  <motion.div
                    key={`${offer.vendor}-${idx}`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-col p-2 rounded bg-[var(--deep-ocean-accent)]/20 border border-[var(--glass-border)]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase truncate max-w-[120px]">
                        {normalizeVendor(offer.vendor || offer.source || "Other")}
                      </span>
                      <span className="text-[10px] font-bold text-[var(--text-primary)]">
                        {formatCurrency(parsePrice(offer.price || 0), currency)}
                      </span>
                    </div>
                    {offer.room_type && (
                      <span className="text-[8px] text-[var(--text-muted)] uppercase tracking-widest mt-0.5 truncate max-w-[200px]">
                        {offer.room_type}
                      </span>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Intelligence Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4 pt-4 border-t border-[var(--glass-border)]" onClick={() => onViewDetails?.(props as any)}>
          <div className="p-2 rounded bg-[var(--deep-ocean-accent)]/30 border border-[var(--glass-border)]">
            <div className="flex items-center gap-1.5 text-[9px] text-[var(--text-muted)] uppercase font-black tracking-widest mb-1.5 opacity-60">
              <RefreshCw className="w-2.5 h-2.5" />{t("hotelDetails.recency")}</div>
            <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">
              {props.lastUpdated || t("hotelDetails.pendingSync")}
            </div>
          </div>

          <div className="p-2 rounded bg-[var(--deep-ocean-accent)]/30 border border-[var(--glass-border)]">
            <div className="flex items-center gap-1.5 text-[9px] text-[var(--text-muted)] uppercase font-black tracking-widest mb-1.5 opacity-60">
              <TrendingUp className="w-2.5 h-2.5" />{t("hotelDetails.shift")}</div>
            <div className={`text-[10px] font-bold flex items-center gap-1 ${
              changePercent > 0 ? "text-emerald-500" : changePercent < 0 ? "text-rose-500" : "text-[var(--text-muted)]"
            }`}>
              {changePercent > 0 ? "+" : ""}{changePercent.toFixed(1)}%
              {trend === "up" ? <ArrowUpRight className="w-3 h-3 text-emerald-500" /> : trend === "down" ? <ArrowDownRight className="w-3 h-3 text-rose-500" /> : <Minus className="w-3 h-3" />}
            </div>
          </div>
        </div>

        {/* Action Hub */}
        <div className="flex items-center gap-2 mt-auto pt-4 border-t border-[var(--glass-border)]/50">
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Track competitor click for CompsetIntelligenceAgent
              if (variant === 'competitor') {
                track('competitor_click', { hotel_id: id, hotel_name: name, current_price: props.currentPrice });
              }
              onViewDetails?.(props as any);
            }}
            className="flex-1 py-2.5 rounded bg-[var(--soft-gold)]/5 border border-[var(--soft-gold)]/20 text-[var(--soft-gold)] text-[10px] uppercase font-black tracking-[0.2em] hover:bg-[var(--soft-gold)] transition-all hover:text-[var(--deep-ocean)] flex items-center justify-center gap-2 shadow-sm"
          >{t("hotelDetails.tacticalIntel")}<ExternalLink className="w-3 h-3" />
          </button>
          
          <div className="flex items-center gap-1.5">
            {variant === "competitor" && onSetTarget && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSetTarget(id);
                }}
                className="p-2.5 rounded bg-[var(--deep-ocean-accent)] border border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--soft-gold)] hover:border-[var(--soft-gold)] transition-all"
                title={t("hotelDetails.setAsMyHotel")}
              >
                <Building2 className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(id, props as any);
              }}
              className="p-2.5 rounded bg-[var(--deep-ocean-accent)] border border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--soft-gold)] transition-all"
              title={t("hotelDetails.editIntel")}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(id);
              }}
              className="p-2.5 rounded bg-[var(--deep-ocean-accent)] border border-[var(--glass-border)] text-[var(--text-muted)] hover:text-alert-red hover:border-alert-red/30 transition-all"
              title={t("hotelDetails.purgeIntel")}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

