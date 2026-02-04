"use client";

import {
  TrendingUp,
  TrendingDown,
  Minus,
  Hotel,
  Trash2,
  Edit2,
  AlertTriangle,
  Zap,
  ShieldAlert,
  Target,
  BarChart3,
} from "lucide-react";
import TrendChart from "./TrendChart";
import { PricePoint } from "@/types";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";

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
    priceHistory,
    onEdit,
  } = props;

  const getTrendColor = () => {
    switch (trend) {
      case "up":
        return "text-red-400";
      case "down":
        return "text-emerald-400";
      default:
        return "text-[var(--text-muted)]";
    }
  };

  return (
    <div
      className={`premium-card p-8 flex flex-col group/comp transition-all duration-700 relative overflow-hidden bg-black/40 ${
        isUndercut
          ? "border-red-500/40 bg-red-500/[0.03] shadow-[0_0_50px_rgba(239,68,68,0.1)]"
          : "border-[var(--gold-primary)]/10 hover:border-[var(--gold-primary)]/30"
      }`}
    >
      {/* Background Glow */}
      <div
        className={`absolute -top-24 -right-24 w-48 h-48 blur-[100px] pointer-events-none transition-opacity duration-1000 ${isUndercut ? "bg-red-500/20" : "bg-[var(--gold-glow)] opacity-10 group-hover/comp:opacity-20"}`}
      />

      {/* Header with Rank/Threat Status */}
      <div className="flex items-center justify-between mb-8 pb-5 border-b border-white/5 relative z-10">
        <div className="flex items-center gap-4">
          <div
            className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.3em] border transition-all duration-500 ${
              isUndercut
                ? "bg-red-500 border-red-400 text-white animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                : "bg-white/10 border-white/5 text-white/50"
            }`}
          >
            {isUndercut
              ? "Pricing_Threat_Detected"
              : `Competitor_Node_#${rank || "00"}`}
          </div>
          {isUndercut && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20">
              <ShieldAlert size={12} className="text-red-500" />
              <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">
                AGGRESSIVE_UNDERCUT
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              onClick={() => onEdit(id, { id, name })}
              className="opacity-0 group-hover/comp:opacity-100 p-2 hover:bg-white/5 rounded-xl text-[var(--text-muted)] hover:text-white transition-all transform hover:scale-110 active:scale-95"
            >
              <Edit2 size={14} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(id)}
              className="opacity-0 group-hover/comp:opacity-100 p-2 hover:bg-red-500/10 rounded-xl text-[var(--text-muted)] hover:text-red-500 transition-all transform hover:scale-110 active:scale-95"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col relative z-10">
        <div className="mb-6">
          <h3 className="text-xl font-black text-white tracking-tighter leading-tight group-hover/comp:text-[var(--gold-primary)] transition-colors line-clamp-1 uppercase">
            {name}
          </h3>
          <div className="flex items-center gap-2 mt-2 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest opacity-40">
            <Target size={12} className="text-[var(--gold-primary)]" />
            <span>Counter_Monitor_Node</span>
          </div>
        </div>

        <div className="flex items-baseline justify-between mb-8 group/price">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1 opacity-60">
              CURRENT_VALUE
            </span>
            <div
              className={`text-3xl font-black data-value tracking-tighter transition-all duration-500 group-hover/price:scale-105 origin-left ${isUndercut ? "text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.3)]" : "text-white"}`}
            >
              {api.formatCurrency(currentPrice, currency)}
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1 opacity-60 text-right">
              MARKET_DELTA
            </span>
            <div
              className={`flex items-center gap-1.5 text-xs font-black transition-all ${getTrendColor()}`}
            >
              {trend === "up" ? (
                <TrendingUp size={16} />
              ) : trend === "down" ? (
                <TrendingDown size={16} />
              ) : (
                <Minus size={16} />
              )}
              {changePercent > 0 ? "+" : ""}
              {changePercent.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Neural Data Pulse */}
        <div className="flex-1 min-h-[80px] opacity-40 group-hover/comp:opacity-100 transition-all duration-700 bg-black/40 rounded-2xl border border-white/5 p-4 overflow-hidden relative">
          <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
            <BarChart3
              size={10}
              className="text-[var(--gold-primary)] opacity-60"
            />
            <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">
              Neural_Data_Stream
            </span>
          </div>
          {priceHistory && priceHistory.length > 0 ? (
            <div className="absolute inset-x-0 bottom-0 top-10 px-2 opacity-80">
              <TrendChart
                data={priceHistory}
                color={isUndercut ? "#ef4444" : "#d4af37"}
                height={70}
                width={300}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2 border border-dashed border-white/10 rounded-xl">
              <div className="w-1 h-1 rounded-full bg-[var(--gold-primary)] animate-ping" />
              <span className="text-[8px] font-black uppercase tracking-[0.4em] text-[var(--text-muted)] opacity-40">
                AWAITING_SIGNAL
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 pt-5 border-t border-white/5 flex items-center justify-between relative z-10">
        <div className="flex flex-col">
          <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1 opacity-50">
            STRATEGIC_POSTURE
          </span>
          <div className="flex items-center gap-2">
            <div
              className={`w-1.5 h-1.5 rounded-full ${isUndercut ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)]" : "bg-[var(--gold-primary)] opacity-40"}`}
            />
            <span
              className={`text-[10px] font-black tracking-[0.2em] uppercase ${isUndercut ? "text-red-500" : "text-white/60"}`}
            >
              {isUndercut ? "CRITICAL_RESPONSE" : "PASSIVE_MONITOR"}
            </span>
          </div>
        </div>
        <button className="relative overflow-hidden group/btn p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-[var(--gold-gradient)] transition-all duration-500 shadow-xl group/btn_parent">
          <div className="absolute inset-0 bg-white/40 translate-x-full group-hover/btn:translate-x-0 transition-transform duration-500" />
          <Zap
            size={16}
            className="text-[var(--gold-primary)] group-hover/btn:text-black transition-all relative z-10 group-hover/btn:scale-125"
          />
        </button>
      </div>
    </div>
  );
}
