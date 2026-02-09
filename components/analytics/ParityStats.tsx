"use client";

import React from "react";
import { Gauge, AlertTriangle, CircleDollarSign } from "lucide-react";
import { HotelWithPrice } from "@/types";

interface ParityStatsProps {
  targetHotel?: HotelWithPrice | null;
  competitors?: HotelWithPrice[];
}

export default function ParityStats({
  targetHotel,
  competitors = [],
}: ParityStatsProps) {
  const targetPrice = targetHotel?.price_info?.current_price || 0;

  // Calculate real metrics
  // Filter for competitors where our price is higher (we are being undercut)
  const undercuts = competitors.filter(
    (c) =>
      c.price_info?.current_price && c.price_info.current_price < targetPrice,
  );

  const activeDiscrepancies = undercuts.length;

  // Parity Score: Percentage of competitors NOT undercutting us
  const parityScore =
    competitors.length > 0
      ? Math.round(
          ((competitors.length - undercuts.length) / competitors.length) * 100,
        )
      : 100;

  // Revenue Risk: Sum of price differences where we are losing on price
  const revenueRisk = undercuts.reduce((acc, c) => {
    const diff = targetPrice - (c.price_info?.current_price || 0);
    return acc + diff;
  }, 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Parity Score */}
      <div className="card-blur rounded-[2rem] p-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Gauge className="w-16 h-16 text-[#F6C344]" />
        </div>
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
          Parity Score
        </h3>
        <div className="flex flex-col items-center">
          <div className="gauge-container mb-2">
            <div className="gauge-bg"></div>
            <div
              className="gauge-fill"
              style={{ transform: `rotate(${(parityScore / 100) * 180}deg)` }}
            ></div>
            <div className="gauge-value">
              <span className="text-2xl font-bold text-white">
                {parityScore}%
              </span>
            </div>
          </div>
          <p className="text-[10px] text-emerald-400 font-bold bg-emerald-400/10 px-2 py-1 rounded">
            Live Database Accuracy
          </p>
        </div>
      </div>

      {/* Active Discrepancies */}
      <div className="card-blur rounded-[2rem] p-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <AlertTriangle className="w-16 h-16 text-rose-500" />
        </div>
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
          Active Discrepancies
        </h3>
        <div className="mt-4">
          <span className="text-4xl font-bold text-white">
            {activeDiscrepancies}
          </span>
          <span className="text-sm text-slate-500 ml-1">instances</span>
        </div>
        <div className="mt-4 w-full h-1.5 bg-[#142541] rounded-full overflow-hidden">
          <div
            className="h-full bg-rose-500 transition-all duration-1000"
            style={{
              width: `${(activeDiscrepancies / (competitors.length || 1)) * 100}%`,
            }}
          />
        </div>
        <p
          className={`text-[10px] mt-2 font-bold ${activeDiscrepancies > 0 ? "text-rose-400" : "text-emerald-400"}`}
        >
          {activeDiscrepancies > 0 ? "Requires Attention" : "In Full Parity"}
        </p>
      </div>

      {/* Est. Revenue Risk */}
      <div className="card-blur rounded-[2rem] p-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <CircleDollarSign className="w-16 h-16 text-blue-400" />
        </div>
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
          Est. Revenue Risk
        </h3>
        <div className="mt-4">
          <span className="text-4xl font-bold text-white">
            {formatCurrency(revenueRisk)}
          </span>
        </div>
        <div className="mt-4 w-full h-1.5 bg-[#142541] rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-400 transition-all duration-1000"
            style={{ width: revenueRisk > 0 ? "40%" : "0%" }}
          />
        </div>
        <p className="text-[10px] text-slate-400 mt-2">
          Based on current undercut depth
        </p>
      </div>
    </div>
  );
}
