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
  Hotel
} from "lucide-react";
import FallbackImage from "@/components/ui/FallbackImage";
import { motion } from "framer-motion";
import { formatCurrency, parsePrice } from "@/lib/utils";
import { HotelWithPrice, PricePoint, HotelImage } from "@/types";
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
  onEdit?: (id: string, hotel: HotelWithPrice) => void;
  onViewDetails?: (hotel: HotelWithPrice) => void;
  onSetTarget?: (id: string) => void;
  isEnterprise?: boolean;
  amenities?: string[];
  images?: HotelImage[];
  offers?: { vendor?: string; source?: string; price?: number }[];
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
  // Atomic derivation of best price and vendor
  const offers = props.offers || [];
  const bestOffer = offers.length > 0 
    ? offers.reduce((best, curr) => {
        const currentP = parsePrice(curr.price || 0);
        const bestP = parsePrice(best.price || 0);
        return (currentP > 0 && (currentP < bestP || bestP === 0)) ? curr : best;
      }, offers[0])
    : null;

  const displayPriceValue = (bestOffer && parsePrice(bestOffer.price || 0) > 0)
    ? parsePrice(bestOffer.price || 0)
    : parsePrice(props.currentPrice || 0);
    
  const displayVendor = bestOffer?.vendor || bestOffer?.source || props.vendor || "UNSPECIFIED";
  const previousPrice = parsePrice(props.previousPrice || 0);


  
  const {
    id,
    name,
    currency = "TRY",
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
      whileHover={{ y: -5 }}
      onClick={() => onViewDetails?.(props as any)}
      className={`glass-card group cursor-pointer flex flex-col h-full overflow-hidden border border-[var(--glass-border)] ${variant === "competitor" ? "border-l-4 border-l-[var(--soft-gold)]" : ""}`}
    >
      {/* Tactical Image Header */}
      <div className="relative aspect-video w-full overflow-hidden bg-[var(--deep-ocean-accent)]">
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
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--deep-ocean)]/80 via-transparent to-transparent" />
        
        {/* Badges Overlay */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
           {props.headerBadges}
           {isScanning && (
             <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-optimal-green/20 backdrop-blur-md border border-optimal-green/30 text-[9px] font-black text-optimal-green uppercase animate-pulse">
               <RefreshCw className="w-2.5 h-2.5 animate-spin" />
               Scanning
             </span>
           )}
        </div>

        {props.isUndercut && (
          <div className="absolute top-3 right-3 px-2 py-1 bg-optimal-green text-[var(--overlay-text)] text-[9px] font-black rounded-sm uppercase tracking-tighter shadow-lg flex items-center gap-1">
            <TrendingDown className="w-3 h-3" />
            Optimal Price
          </div>
        )}

        {props.rating && (
          <div className="absolute bottom-3 left-3 px-2 py-0.5 bg-[var(--overlay-bg)] backdrop-blur-md rounded border border-[var(--overlay-border)] flex items-center gap-1 text-[10px] font-bold text-[var(--overlay-text)]">
            <span className="text-[11px] text-[var(--soft-gold)]">★</span>
            {props.rating.toFixed(1)}
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1 bg-[var(--glass-bg)]">
        {/* Core Identity */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-black text-[var(--text-primary)] leading-tight tracking-tighter uppercase italic group-hover:text-[var(--soft-gold)] transition-colors truncate">
              {name}
            </h3>
            <p className="text-[10px] text-[var(--text-muted)] mt-1 uppercase font-bold tracking-widest flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 text-[var(--soft-gold)]/50 flex-shrink-0" />
              {props.location || "Location Unknown"}
            </p>
          </div>
          
          <div className="text-right flex-shrink-0 ml-4">
            <div className="text-xs font-black text-[var(--text-muted)] uppercase tracking-tight mb-1 opacity-50">
              Live Rate
            </div>
            <div className="text-2xl font-black text-[var(--soft-gold)] tracking-tighter italic">
              {displayPriceValue > 0 ? `${currency} ${displayPriceValue.toLocaleString('en-US')}` : "---"}
            </div>
            <div className="text-[10px] uppercase text-[var(--text-muted-foreground)] bg-[var(--bg-subtle)] px-2 py-0.5 rounded-full mt-1 inline-block border border-[var(--overlay-border)] backdrop-blur-sm font-bold tracking-wider">
              VIA {displayVendor}
            </div>
          </div>
        </div>

        {/* Intelligence Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4 pt-4 border-t border-[var(--glass-border)]">
          <div className="p-2 rounded bg-[var(--deep-ocean-accent)]/30 border border-[var(--glass-border)]">
            <div className="flex items-center gap-1.5 text-[9px] text-[var(--text-muted)] uppercase font-black tracking-widest mb-1.5 opacity-60">
              <RefreshCw className="w-2.5 h-2.5" />
              Recency
            </div>
            <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">
              {props.lastUpdated || "Pending Sync"}
            </div>
          </div>

          <div className="p-2 rounded bg-[var(--deep-ocean-accent)]/30 border border-[var(--glass-border)]">
            <div className="flex items-center gap-1.5 text-[9px] text-[var(--text-muted)] uppercase font-black tracking-widest mb-1.5 opacity-60">
              <TrendingUp className="w-2.5 h-2.5" />
              Shift
            </div>
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
              onViewDetails?.(props as any);
            }}
            className="flex-1 py-2.5 rounded bg-[var(--soft-gold)]/5 border border-[var(--soft-gold)]/20 text-[var(--soft-gold)] text-[10px] uppercase font-black tracking-[0.2em] hover:bg-[var(--soft-gold)] transition-all hover:text-[var(--deep-ocean)] flex items-center justify-center gap-2"
          >
            Tactical Intel
            <ExternalLink className="w-3 h-3" />
          </button>
          
          {variant === "competitor" && onSetTarget && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSetTarget(id);
              }}
              className="p-2.5 rounded bg-[var(--deep-ocean-accent)] border border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--soft-gold)] hover:border-[var(--soft-gold)] transition-all"
              title="Set as My Hotel"
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
            title="Edit Intel"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(id);
            }}
            className="p-2.5 rounded bg-[var(--deep-ocean-accent)] border border-[var(--glass-border)] text-[var(--text-muted)] hover:text-alert-red hover:border-alert-red/30 transition-all"
            title="Purge Intel"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
