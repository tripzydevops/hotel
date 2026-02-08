"use client";

import React from "react";
import { Gauge, AlertTriangle, CircleDollarSign } from "lucide-react";

export default function ParityStats() {
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
            <div className="gauge-fill"></div>
            <div className="gauge-value">
              <span className="text-2xl font-bold text-white">87%</span>
            </div>
          </div>
          <p className="text-[10px] text-emerald-400 font-bold bg-emerald-400/10 px-2 py-1 rounded">
            +2.4% vs Last Week
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
          <span className="text-4xl font-bold text-white">12</span>
          <span className="text-sm text-slate-500 ml-1">instances</span>
        </div>
        <div className="mt-4 w-full h-1.5 bg-[#142541] rounded-full overflow-hidden">
          <div className="w-[35%] h-full bg-rose-500"></div>
        </div>
        <p className="text-[10px] text-rose-400 mt-2 font-bold">
          Requires Attention
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
          <span className="text-4xl font-bold text-white">$4.2k</span>
        </div>
        <div className="mt-4 w-full h-1.5 bg-[#142541] rounded-full overflow-hidden">
          <div className="w-[12%] h-full bg-blue-400"></div>
        </div>
        <p className="text-[10px] text-slate-400 mt-2">
          Based on current undercut depth
        </p>
      </div>
    </div>
  );
}
