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
  Sparkles,
  Zap,
  MapPin,
  Clock,
} from "lucide-react";
import TrendChart from "./TrendChart";
import { PricePoint } from "@/types";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";

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

  const getTrendColor = () => {
    switch (trend) {
      case "up":
        return "text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]";
      case "down":
        return "text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]";
      default:
        return "text-[var(--text-muted)]";
    }
  };

  return (
    <div className="premium-card flex flex-col h-full group/card animate-fade-in sm:col-span-2 lg:col-span-2 lg:row-span-2 relative overflow-hidden bg-black/40 border-[var(--gold-primary)]/10">
      {/* Dynamic Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--gold-glow)] via-transparent to-transparent opacity-20 pointer-events-none group-hover/card:opacity-30 transition-opacity duration-1000" />
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-[var(--gold-glow)] opacity-10 blur-[100px] pointer-events-none group-hover/card:opacity-20 transition-all duration-1000 group-hover/card:scale-125" />

      {/* Header Status Bar */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-black/40 backdrop-blur-2xl relative z-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-[var(--gold-primary)]/20 blur-md rounded-full animate-pulse" />
            <div className="relative w-2 h-2 rounded-full bg-[var(--gold-primary)] shadow-[0_0_12px_var(--gold-primary)]" />
          </div>
          <span className="text-[9px] font-black uppercase tracking-[0.5em] text-[var(--gold-primary)] opacity-80">
            Primary_Node_Active
          </span>
        </div>
        <div className="flex items-center gap-3">
          {onEdit && (
            <button
              onClick={() => onEdit(id, { id, name, location })}
              className="p-2.5 hover:bg-white/5 rounded-xl text-[var(--text-muted)] hover:text-white transition-all transform hover:scale-110 active:scale-95"
            >
              <Edit2 size={15} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(id)}
              className="p-2.5 hover:bg-red-500/10 rounded-xl text-[var(--text-muted)] hover:text-red-500 transition-all transform hover:scale-110 active:scale-95"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="p-8 flex-1 relative z-10 flex flex-col">
        {/* Main Identity Section */}
        <div className="flex justify-between items-start mb-12">
          <div className="space-y-3">
            <h2 className="text-4xl font-black text-white tracking-tighter leading-tight group-hover/card:text-[var(--gold-primary)] transition-all duration-700 uppercase">
              {name}
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 shadow-inner">
                <MapPin size={12} className="text-[var(--gold-primary)]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                  {location || "Global_Market"}
                </span>
              </div>
              {stars && (
                <div className="flex gap-0.5">
                  {[...Array(stars)].map((_, i) => (
                    <Sparkles
                      key={i}
                      size={10}
                      className="text-[var(--gold-primary)]"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="text-right flex flex-col items-end">
            <span className="text-[10px] font-black text-[var(--gold-primary)] uppercase tracking-[0.4em] mb-2 opacity-60">
              OPTIMIZED ADR
            </span>
            <div className="text-5xl font-black text-white tracking-tighter drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
              {currentPrice > 0
                ? api.formatCurrency(currentPrice, currency)
                : t("common.pending")}
            </div>
          </div>
        </div>

        {/* Metrics Display */}
        <div className="grid grid-cols-2 gap-6 mb-12">
          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-3xl relative overflow-hidden group/metric transition-all hover:bg-white/[0.06] hover:border-[var(--gold-primary)]/20 shadow-2xl">
            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover/metric:opacity-20 transition-opacity">
              <Activity
                size={48}
                className={trend === "up" ? "text-red-500" : "text-emerald-500"}
              />
            </div>
            <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.4em] block mb-3 opacity-60">
              VARIANCE_SIGNAL
            </span>
            <div className="flex items-center gap-4">
              <span
                className={`text-3xl font-black tracking-tighter ${getTrendColor()}`}
              >
                {changePercent > 0 ? "+" : ""}
                {changePercent.toFixed(2)}%
              </span>
              <div
                className={`p-2 rounded-xl backdrop-blur-md border ${
                  trend === "up"
                    ? "bg-red-500/10 border-red-500/20 text-red-500"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                }`}
              >
                {trend === "up" ? (
                  <TrendingUp size={20} />
                ) : (
                  <TrendingDown size={20} />
                )}
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-3xl transition-all hover:bg-white/[0.06] shadow-2xl">
            <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.4em] block mb-3 opacity-60">
              LAST_NEURAL_SYNC
            </span>
            <div className="flex items-center gap-4">
              <div className="text-2xl font-black text-white tracking-tighter flex items-center gap-3">
                <Clock
                  size={20}
                  className="text-[var(--gold-primary)] opacity-60"
                />
                {lastUpdated || "09:42:15"}
              </div>
            </div>
          </div>
        </div>

        {/* Predictive Pricing Graph */}
        <div className="flex-1 min-h-[200px] relative mt-auto p-8 rounded-3xl bg-black/60 border border-white/5 overflow-hidden group/chart shadow-inner">
          <div className="absolute top-8 left-8 flex items-center gap-3 z-20">
            <Zap
              size={14}
              className="text-[var(--gold-primary)] animate-pulse"
            />
            <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.5em]">
              Predictive_Pricing_Velocity
            </span>
          </div>
          <div className="absolute top-8 right-8 z-20">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--gold-primary)]" />
              <span className="text-[8px] font-black text-[var(--gold-primary)] uppercase tracking-widest opacity-60">
                LIVE_FEED
              </span>
            </div>
          </div>
          {priceHistory && priceHistory.length > 1 ? (
            <div className="absolute inset-x-0 bottom-0 top-16 px-4">
              <TrendChart
                data={priceHistory}
                color="#d4af37"
                width={800}
                height={160}
              />
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 opacity-20">
              <div className="w-12 h-12 border border-[var(--gold-primary)]/20 rounded-full flex items-center justify-center animate-spin">
                <Activity size={24} className="text-[var(--gold-primary)]" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.8em] text-[var(--gold-primary)]">
                ACQUIRING_DATA...
              </span>
            </div>
          )}
          {/* Chart Gradient Fade */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-10" />
        </div>
      </div>

      {/* Footer / Actions */}
      <div className="px-8 py-6 border-t border-white/5 bg-black/40 backdrop-blur-3xl flex items-center justify-between relative z-10">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest leading-none mb-1.5 opacity-60">
              Data_Source
            </span>
            <span className="text-[10px] font-black text-white/80 tracking-[0.2em] uppercase">
              {vendor || "Global_API"}
            </span>
          </div>
          <div className="w-[1px] h-8 bg-white/10" />
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest leading-none mb-1.5 opacity-60">
              Node_Status
            </span>
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,1)]" />
              <span className="text-[10px] font-black text-emerald-500 tracking-[0.2em] uppercase">
                Active_Scan
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => onViewDetails && onViewDetails({ id, name, location })}
          className="btn-premium flex items-center gap-4 px-8 py-4 group/btn overflow-hidden relative"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
          <Sparkles
            size={16}
            className="relative z-10 text-black group-hover:scale-125 transition-transform"
          />
          <span className="relative z-10 font-black uppercase tracking-[0.2em] text-xs leading-none">
            DEEP_ANALYSIS
          </span>
        </button>
      </div>
    </div>
  );
}
