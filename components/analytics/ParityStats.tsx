"use client";

import React from "react";
import { Gauge, AlertTriangle, CircleDollarSign } from "lucide-react";
import { HotelWithPrice } from "@/types";
import { parsePrice } from "@/lib/utils";

interface ParityStatsProps {
  targetHotel?: HotelWithPrice | null;
  competitors?: HotelWithPrice[];
}

export default function ParityStats({
  targetHotel,
  competitors = [],
}: ParityStatsProps) {
  const targetOffers = targetHotel?.price_info?.offers || [];
  const targetDirectOffer = targetOffers.find((o) => o.is_direct);
  const targetPrice = targetDirectOffer ? parsePrice(targetDirectOffer.price || 0) : parsePrice(targetHotel?.price_info?.current_price || 0);

  // ─── Rate Parity Metrics ────────────────────────────────────────────
  // Compare YOUR direct price against YOUR OTA channel prices.
  // A "violation" is when an OTA sells YOUR rooms cheaper than your direct website.
  // This is true rate parity leakage — revenue lost to cheaper OTA listings.

  const otaOffers = targetOffers.filter((o) => !o.is_direct && o.price);
  const undercuttingOtas = otaOffers.filter(
    (o) => parsePrice(o.price || 0) < targetPrice && targetPrice > 0,
  );

  const activeDiscrepancies = undercuttingOtas.length;

  // Parity Score: Percentage of OTA channels NOT undercutting our direct price
  const parityScore =
    otaOffers.length > 0
      ? Math.round(
          ((otaOffers.length - undercuttingOtas.length) / otaOffers.length) * 100,
        )
      : 100;

  // Monthly Revenue Leakage: Σ (Direct Price - OTA Price) × 25 nights/month
  // Only counts OTA channels selling YOUR rooms below your direct price.
  const monthlyLeakage = undercuttingOtas.reduce((acc, o) => {
    const diff = targetPrice - parsePrice(o.price || 0);
    return acc + (diff * 25);
  }, 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: targetHotel?.price_info?.currency || "TRY",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Parity Score */}
      <div className="glass-card rounded-[2rem] p-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Gauge className="w-16 h-16 text-[#F6C344]" />
        </div>
        <h3 className="text-sm font-bold text-slate-500 dark:text-gray-400 font-black uppercase tracking-[0.2em] mb-4">
          Parity Health
        </h3>
        <div className="flex flex-col items-center">
          <div className="gauge-container mb-2">
            <div className="gauge-bg"></div>
            <div
              className="gauge-fill"
              style={{ transform: `rotate(${(parityScore / 100) * 180}deg)` }}
            ></div>
            <div className="gauge-value">
              <span className="text-3xl font-black text-slate-900 dark:text-white">
                {parityScore}%
              </span>
            </div>
          </div>
          <p className="text-[10px] text-[#F6C344] font-bold bg-[#F6C344]/10 px-3 py-1 rounded-full">
            Real-time Sync
          </p>
        </div>
      </div>

      {/* Active Discrepancies */}
      <div className="glass-card rounded-[2rem] p-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <AlertTriangle className="w-16 h-16 text-rose-500" />
        </div>
        <h3 className="text-sm font-bold text-slate-500 dark:text-gray-400 font-black uppercase tracking-[0.2em] mb-2">
          Active Violations
        </h3>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-5xl font-black text-slate-900 dark:text-white leading-none">
            {activeDiscrepancies}
          </span>
          <span className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase tracking-widest">
            Channels
          </span>
        </div>
        <div className="mt-6 w-full h-2 bg-[var(--deep-ocean-accent)]/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-rose-500 transition-all duration-1000"
            style={{
              width: `${(activeDiscrepancies / (otaOffers.length || 1)) * 100}%`,
            }}
          />
        </div>
        <p
          className={`text-[10px] mt-4 font-black uppercase tracking-wider ${activeDiscrepancies > 0 ? "text-rose-400" : "text-emerald-400"}`}
        >
          {activeDiscrepancies > 0 ? "⚠️ Immediate Action Required" : "✓ Shield Active: Full Parity"}
        </p>
      </div>

      {/* Monthly Revenue Leakage */}
      <div className="glass-card rounded-[2rem] p-6 relative overflow-hidden group border border-blue-500/10">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <CircleDollarSign className="w-16 h-16 text-blue-400" />
        </div>
        <h3 className="text-sm font-bold text-slate-500 dark:text-gray-400 font-black uppercase tracking-[0.2em] mb-2">
          Monthly Revenue Leakage
        </h3>
        <div className="mt-4">
          <span className="text-4xl font-black text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.3)]">
            {formatCurrency(monthlyLeakage)}
          </span>
        </div>
        <div className="mt-6 w-full h-2 bg-[var(--deep-ocean-accent)]/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-1000"
            style={{ width: monthlyLeakage > 0 ? "100%" : "0%" }}
          />
        </div>
        <p className="text-[10px] text-slate-500 dark:text-gray-400 font-bold mt-4 flex items-center gap-2 uppercase tracking-widest">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          Quantified Monthly Loss
        </p>
      </div>
    </div>
  );
}
