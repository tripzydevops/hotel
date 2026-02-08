"use client";

import React from "react";
import { ArrowRight, X, AlertTriangle } from "lucide-react";
import { HotelWithPrice } from "@/types";

interface ViolatingChannelsProps {
  targetHotel?: HotelWithPrice | null;
  competitors?: HotelWithPrice[];
}

export default function ViolatingChannels({
  targetHotel,
  competitors = [],
}: ViolatingChannelsProps) {
  const targetPrice = targetHotel?.price_info?.current_price || 0;

  // Filter real violations
  const violations = competitors
    .filter(
      (c) =>
        c.price_info?.current_price && c.price_info.current_price < targetPrice,
    )
    .map((c) => {
      const price = c.price_info!.current_price;
      const diffPercent = ((targetPrice - price) / targetPrice) * 100;
      return {
        name: c.name,
        diff: `-${diffPercent.toFixed(1)}%`,
        severity: diffPercent > 5 ? "high" : "low",
        desc: `Undercut detected at ${new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(price)}.`,
        last: "Just Now",
      };
    });

  return (
    <div className="card-blur rounded-[2.5rem] p-8 h-full bg-gradient-to-b from-[#0A1629]/80 to-[#050B18] border border-white/5 shadow-2xl">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-lg font-bold text-white">Violating Channels</h2>
        {violations.length > 0 && (
          <span className="text-[10px] bg-rose-500/20 text-rose-400 px-3 py-1 rounded-full border border-rose-500/20 font-bold uppercase tracking-wide">
            {violations.length} Alerts
          </span>
        )}
      </div>

      <div className="space-y-6">
        {violations.length > 0 ? (
          violations.map((v, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-2xl bg-[#050B18] border relative overflow-hidden group hover:border-rose-500 transition-colors cursor-pointer ${
                v.severity === "high"
                  ? "border-rose-500/30"
                  : "border-yellow-500/30 opacity-80 hover:border-yellow-500"
              }`}
            >
              <div
                className={`absolute left-0 top-0 bottom-0 w-1 ${v.severity === "high" ? "bg-rose-500" : "bg-yellow-500"}`}
              ></div>
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-white text-md truncate pr-2">
                  {v.name}
                </h4>
                <span
                  className={`${v.severity === "high" ? "text-rose-400" : "text-yellow-500"} font-bold text-sm whitespace-nowrap`}
                >
                  {v.diff}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mb-3">{v.desc}</p>
              <div className="flex gap-2">
                <span className="text-[9px] px-2 py-0.5 rounded bg-[#142541] text-slate-300">
                  Last: {v.last}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-white/5 flex justify-end">
                <button className="text-[9px] font-bold uppercase text-[#F6C344] hover:text-white flex items-center gap-1">
                  Send Alert <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="text-sm font-bold text-white">All Clear</p>
            <p className="text-xs text-slate-500 mt-1">
              No price violations detected in the current set.
            </p>
          </div>
        )}
      </div>

      <div className="mt-auto pt-8">
        <div className="p-4 bg-[#142541]/50 rounded-xl border border-white/5">
          <h5 className="text-[10px] font-bold text-[#F6C344] uppercase mb-2">
            Intelligence Shield
          </h5>
          <div className="flex items-center justify-between mb-1 text-[10px]">
            <span className="text-slate-400">Policy Check</span>
            <span className="font-bold text-emerald-400">Strict</span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-400">Agent Status</span>
            <span className="font-bold text-white">Active Mesh</span>
          </div>
        </div>
      </div>
    </div>
  );
}
