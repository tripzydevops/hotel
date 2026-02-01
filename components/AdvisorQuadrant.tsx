"use client";

import React from "react";
import { Zap, AlertTriangle, Trophy, TrendingDown, Target } from "lucide-react";

interface AdvisorQuadrantProps {
  x: number; // -50 to 50
  y: number; // -50 to 50
  label: string;
}

export default function AdvisorQuadrant({ x, y, label }: AdvisorQuadrantProps) {
  // Convert -50/50 range to 0-100% for CSS positioning
  const leftPos = `${50 + x}%`;
  const topPos = `${50 - y}%`; // Invert Y because CSS top increases downwards

  return (
    <div className="glass-card p-8 relative overflow-hidden h-[400px]">
      {/* Background Grid & Labels */}
      <div className="absolute inset-0 p-8 flex flex-col pointer-events-none opacity-20">
        <div className="flex-1 flex border-b border-white/10">
          <div className="flex-1 border-r border-white/10 flex items-center justify-center">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white -rotate-45">
              Danger Zone
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--soft-gold)] -rotate-45">
              Premium King
            </div>
          </div>
        </div>
        <div className="flex-1 flex">
          <div className="flex-1 border-r border-white/10 flex items-center justify-center">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--optimal-green)] -rotate-45">
              Budget / Economy
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 -rotate-45">
              Value Leader
            </div>
          </div>
        </div>
      </div>

      {/* Axis Labels */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase text-[var(--text-muted)] tracking-[0.3em]">
        Price Index (ARI)
      </div>
      <div className="absolute left-4 top-1/2 -rotate-90 -translate-y-1/2 text-[9px] font-black uppercase text-[var(--text-muted)] tracking-[0.3em]">
        Value Index (Sentiment)
      </div>

      {/* Crosshair lines */}
      <div className="absolute top-1/2 left-8 right-8 h-[1px] bg-white/5 -translate-y-1/2" />
      <div className="absolute left-1/2 top-8 bottom-8 w-[1px] bg-white/5 -translate-x-1/2" />

      {/* The Indicator */}
      <div
        className="absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 ease-out z-20"
        style={{ left: leftPos, top: topPos }}
      >
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Pulse Effect */}
          <div className="absolute inset-0 bg-[var(--soft-gold)] rounded-full animate-ping opacity-20" />
          <div className="absolute inset-0 bg-[var(--soft-gold)]/20 rounded-full blur-xl animate-pulse" />

          <div className="relative p-2 rounded-xl bg-[var(--soft-gold)] text-black shadow-2xl shadow-[var(--soft-gold)]/50 border border-white/20">
            <Trophy className="w-5 h-5" />
          </div>

          {/* Label Tooltip */}
          <div className="absolute top-14 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 shadow-2xl">
            <span className="text-[10px] font-black text-white uppercase tracking-widest">
              {label}
            </span>
          </div>
        </div>
      </div>

      {/* Static Legend icons in corners */}
      <div className="absolute top-10 right-10 text-[var(--soft-gold)]/30">
        <Zap className="w-6 h-6" />
      </div>
      <div className="absolute bottom-10 right-10 text-blue-400/30">
        <Target className="w-6 h-6" />
      </div>
      <div className="absolute top-10 left-10 text-red-400/30">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <div className="absolute bottom-10 left-10 text-[var(--optimal-green)]/30">
        <TrendingDown className="w-6 h-6" />
      </div>

      <div className="absolute top-6 left-6 flex items-center gap-2">
        <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">
          Advisor Quadrant
        </h3>
        <span className="px-2 py-0.5 rounded bg-white/5 text-[8px] font-bold text-[var(--text-muted)] border border-white/10 uppercase">
          Strategic Map
        </span>
      </div>
    </div>
  );
}
