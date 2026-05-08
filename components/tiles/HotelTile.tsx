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
  ChevronUp,
  Star,
  Target,
  AlertTriangle
} from "lucide-react";
import FallbackImage from "@/components/ui/FallbackImage";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency, parsePrice } from "@/lib/utils";
import { HotelWithPrice, PricePoint, HotelImage } from "@/types";
import { ReactNode, useState } from "react";

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
  offers?: { vendor?: string; source?: string; price?: number; currency?: string; url?: string }[];
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
  const [showAllOffers, setShowAllOffers] = useState(false);
  
  // Atomic derivation of best price and vendor
  const allOffers = props.offers || [];
  const sortedOffers = [...allOffers].sort((a, b) => 
    parsePrice(a.price || 0) - parsePrice(b.price || 0)
  );

  const bestOffer = sortedOffers.length > 0 ? sortedOffers[0] : null;
  const otherOffers = sortedOffers.slice(1);

  const displayPriceValue = (bestOffer && parsePrice(bestOffer.price || 0) > 0)
    ? parsePrice(bestOffer.price || 0)
    : parsePrice(props.currentPrice || 0);
    
  const displayVendor = bestOffer?.vendor || bestOffer?.source || props.vendor || "UNSPECIFIED";
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
      whileHover={{ y: -12 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`group cursor-pointer flex flex-col h-full overflow-hidden glass-card bg-[var(--deep-ocean-lighter)] border-white/5 relative ${
        variant === "target" 
          ? "ring-1 ring-[var(--optimal-green)]/30 shadow-[0_20px_50px_-12px_rgba(16,185,129,0.3)]" 
          : "ring-1 ring-[var(--soft-gold)]/20 shadow-[0_20px_50px_-12px_rgba(212,175,55,0.2)]"
      }`}
    >
      {/* Decorative Corner Accent */}
      <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl -mr-16 -mt-16 transition-opacity duration-500 opacity-20 group-hover:opacity-40 ${
        variant === "target" ? "bg-emerald-500" : "bg-[var(--soft-gold)]"
      }`} />

      {/* Tactical Image Header */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--deep-ocean-accent)]" onClick={() => onViewDetails?.(props as any)}>
        {imageUrl ? (
          <FallbackImage
            src={imageUrl}
            alt={name}
            fill
            priority={props.priority}
            className="object-cover transition-transform duration-1000 group-hover:scale-110"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--deep-ocean)] to-[var(--deep-ocean-accent)]">
            <Hotel className="w-12 h-12 text-[var(--soft-gold)]/20" />
          </div>
        )}

        {/* Premium Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--deep-ocean)] via-[var(--deep-ocean)]/10 to-transparent opacity-90" />
        
        {/* Badges Overlay */}
        <div className="absolute top-5 left-5 right-5 flex justify-between items-start pointer-events-none">
          <div className="flex flex-col gap-2">
            {props.headerBadges}
            {isScanning && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 backdrop-blur-xl border border-emerald-500/30 text-[10px] font-black text-emerald-400 uppercase tracking-widest animate-pulse shadow-lg">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Scanning
              </span>
            )}
            {props.stars && props.stars > 0 && (
              <div className="flex gap-0.5 px-2.5 py-1.5 rounded-xl bg-[var(--deep-ocean)]/60 backdrop-blur-md border border-white/10 shadow-xl">
                {[...Array(props.stars)].map((_, i) => (
                  <Star key={i} className="w-2.5 h-2.5 fill-[var(--soft-gold)] text-[var(--soft-gold)]" />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            {variant === "target" && (
              <span className="px-3.5 py-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.4)] border border-white/20">
                Primary Target
              </span>
            )}
            {props.isUndercut && (
              <span className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--alert-red)] text-white text-[10px] font-black uppercase tracking-widest animate-pulse border border-white/20 shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                <AlertTriangle className="w-3.5 h-3.5" />
                Price Deficit
              </span>
            )}
          </div>
        </div>

        {/* Bottom Metrics Overlay */}
        <div className="absolute bottom-5 left-5 right-5 flex justify-between items-end pointer-events-none">
          <div className="flex gap-2">
            {props.rating && (
              <div className="px-3 py-1.5 bg-[var(--deep-ocean)]/70 backdrop-blur-xl rounded-2xl border border-white/10 flex items-center gap-1.5 text-[11px] font-black text-white shadow-2xl">
                <Star className="w-3 h-3 fill-[var(--soft-gold)] text-[var(--soft-gold)]" />
                {props.rating.toFixed(1)}
              </div>
            )}
            {props.room_types && props.room_types.length > 0 && (
              <div className="px-3 py-1.5 bg-[var(--deep-ocean)]/70 backdrop-blur-xl rounded-2xl border border-white/10 flex items-center gap-1.5 text-[10px] font-black text-white uppercase tracking-widest shadow-2xl">
                <Layers className="w-3.5 h-3.5 text-[var(--soft-gold)]" />
                {props.room_types.length} Rooms
              </div>
            )}
          </div>

          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 px-4 py-2 rounded-2xl flex items-center gap-2.5 shadow-2xl pointer-events-auto hover:bg-white/20 transition-colors">
            <Globe className="w-3.5 h-3.5 text-[var(--soft-gold)]" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest whitespace-nowrap">
              {displayVendor}
            </span>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 p-8 flex flex-col">
        <div className="flex items-start justify-between mb-6" onClick={() => onViewDetails?.(props as any)}>
          <div className="flex-1 min-w-0 pr-6">
            <h3 className="text-2xl font-black text-[var(--text-primary)] leading-[1.1] tracking-tighter uppercase italic group-hover:text-[var(--soft-gold)] transition-colors line-clamp-2 mb-2">
              {name}
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--soft-gold)] flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--soft-gold)] animate-pulse" />
                {props.lastUpdated || "Live Feed"}
              </span>
            </div>
          </div>

          <div className="text-right flex-shrink-0 flex flex-col items-end">
            <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-1">
              Optimized Rate
            </span>
            <div className="text-3xl font-black text-[var(--soft-gold)] tracking-tighter italic leading-none mb-2">
              {displayPriceValue > 0 ? formatCurrency(displayPriceValue, currency) : "---"}
            </div>
            {trend !== "stable" && (
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black ${
                trend === "down" 
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}>
                {trend === "down" ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                <span>{changePercent > 0 ? "+" : ""}{changePercent.toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Market Presence Visualization */}
        {allOffers.length > 0 && (
          <div className="mb-8 p-1 rounded-3xl bg-white/[0.02] border border-white/[0.05]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-[var(--soft-gold)]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Ota Distribution</span>
              </div>
              <span className="text-[10px] font-black text-[var(--soft-gold)] bg-[var(--soft-gold)]/10 px-2 py-0.5 rounded-md">
                {allOffers.length} Sources
              </span>
            </div>

            <div className="p-3 space-y-1.5">
              {(showAllOffers ? allOffers : allOffers.slice(0, 3)).map((offer, idx) => (
                <div 
                  key={`${offer.vendor}-${idx}`}
                  className={`flex items-center justify-between p-3 rounded-2xl transition-all duration-300 ${
                    idx === 0 
                      ? "bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 shadow-[0_0_15px_rgba(212,175,55,0.05)]" 
                      : "bg-white/[0.01] hover:bg-white/[0.03] border border-transparent hover:border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-2 h-2 rounded-full ${idx === 0 ? "bg-[var(--soft-gold)] shadow-[0_0_10px_var(--soft-gold)]" : "bg-white/10"}`} />
                    <span className={`text-[11px] font-bold uppercase tracking-tight truncate ${idx === 0 ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                      {offer.vendor || offer.source || "Direct"}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`text-xs font-black italic ${idx === 0 ? "text-[var(--soft-gold)]" : "text-[var(--text-primary)]"}`}>
                      {formatCurrency(offer.price || 0, currency)}
                    </span>
                  </div>
                </div>
              ))}
              
              {allOffers.length > 3 && !showAllOffers && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAllOffers(true);
                  }}
                  className="w-full py-2 text-[9px] font-black text-[var(--text-muted)] hover:text-[var(--soft-gold)] transition-colors uppercase tracking-[0.2em]"
                >
                  Show +{allOffers.length - 3} More Intelligence Sources
                </button>
              )}
            </div>
          </div>
        )}

        {/* Premium Action Hub */}
        <div className="flex items-center gap-3 mt-auto pt-6 border-t border-white/5">
          {onSetTarget && variant !== "target" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSetTarget(id);
              }}
              className="flex-1 flex items-center justify-center gap-2.5 h-12 px-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all duration-500 font-black text-[11px] uppercase tracking-widest group/target active:scale-95 shadow-lg hover:shadow-emerald-500/20"
            >
              <Target className="w-4 h-4 transition-transform duration-500 group-hover/target:rotate-180" />
              <span>Mark as Target</span>
            </button>
          )}

          {variant === "target" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails?.(props as any);
              }}
              className="flex-1 flex items-center justify-center gap-2.5 h-12 px-6 rounded-2xl bg-[var(--soft-gold)] text-[var(--deep-ocean)] border border-[var(--soft-gold)] hover:brightness-110 transition-all duration-500 font-black text-[11px] uppercase tracking-widest group/view active:scale-95 shadow-[0_0_20px_var(--soft-gold-glow)]"
            >
              <ArrowUpRight className="w-4 h-4 transition-transform duration-500 group-hover/view:translate-x-1 group-hover/view:-translate-y-1" />
              <span>Analyze Intel</span>
            </button>
          )}
          
          <div className="flex gap-2.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(id, props as any);
              }}
              className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/[0.03] border border-white/[0.08] text-[var(--text-muted)] hover:text-[var(--soft-gold)] hover:border-[var(--soft-gold)] hover:bg-[var(--soft-gold)]/5 transition-all duration-300 active:scale-90"
              title="Edit Parameters"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(id);
              }}
              className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/[0.03] border border-white/[0.08] text-[var(--text-muted)] hover:text-[var(--alert-red)] hover:border-[var(--alert-red)]/30 hover:bg-[var(--alert-red)]/5 transition-all duration-300 active:scale-90"
              title="Purge Intelligence"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
