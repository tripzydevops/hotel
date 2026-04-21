"use client";

import React from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceArea,
  ReferenceLine
} from "recharts";
import { motion } from "framer-motion";
import { Radar, Target, Info } from "lucide-react";

interface MarketDensityChartProps {
  data: any[];
  targetHotel: any;
}

export default function MarketDensityChart({ data, targetHotel }: MarketDensityChartProps) {
  // Mock data if none provided to show the visual
  const chartData = data?.length > 0 ? data : [
    { x: 1200, y: 85, z: 200, name: "Competitor A" },
    { x: 1450, y: 92, z: 150, name: "Competitor B" },
    { x: 1300, y: 78, z: 300, name: "Competitor C" },
    { x: 1100, y: 65, z: 100, name: "Competitor D" },
    { x: 1600, y: 88, z: 250, name: "Competitor E" },
    { x: targetHotel?.price || 1350, y: targetHotel?.sent || 82, z: 400, name: "Your Hotel", isTarget: true },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="backdrop-blur-xl bg-slate-900/90 border border-white/10 p-3 rounded-xl shadow-2xl">
          <p className="text-[10px] font-black text-[var(--soft-gold)] uppercase tracking-widest mb-1">{item.name}</p>
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-[9px] text-white/40 uppercase">Daily Rate</span>
              <span className="text-[10px] font-bold text-white">{item.x} TL</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[9px] text-white/40 uppercase">Sentiment</span>
              <span className="text-[10px] font-bold text-white">{item.y}%</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="command-card p-6 flex flex-col h-full relative overflow-hidden">
      {/* HUD Accents */}
      <div className="absolute top-0 right-0 p-4 opacity-20">
        <Radar className="w-12 h-12 text-[var(--soft-gold)]" />
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
          Market Density Radar
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--soft-gold)] animate-ping" />
        </h3>
        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-tighter mt-1">
          Vector mapping: Price vs Sentiment vs Volume
        </p>
      </div>

      <div className="flex-1 min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
            <XAxis 
              type="number" 
              dataKey="x" 
              name="Price" 
              unit=" TL" 
              stroke="rgba(255,255,255,0.1)" 
              tick={{fill: 'rgba(255,255,255,0.3)', fontSize: 10}}
              label={{ value: 'Price Intensity', position: 'bottom', offset: 0, fill: 'rgba(255,255,255,0.2)', fontSize: 9, fontWeight: 'bold' }}
            />
            <YAxis 
              type="number" 
              dataKey="y" 
              name="Sentiment" 
              unit="%" 
              stroke="rgba(255,255,255,0.1)" 
              tick={{fill: 'rgba(255,255,255,0.3)', fontSize: 10}}
              label={{ value: 'Sentiment Rank', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.2)', fontSize: 9, fontWeight: 'bold' }}
            />
            <ZAxis type="number" dataKey="z" range={[50, 400]} />
            
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            
            {/* Quadrant Backgrounds */}
            <ReferenceArea x1={1300} y1={80} fill="rgba(34, 197, 94, 0.05)" stroke="none" label={{ value: 'PREMIUM HIGH', position: 'insideTopRight', fill: 'rgba(34, 197, 94, 0.3)', fontSize: 9, fontWeight: 900 }} />
            <ReferenceArea x2={1300} y1={80} fill="rgba(212, 175, 55, 0.03)" stroke="none" label={{ value: 'VALUE LEADER', position: 'insideTopLeft', fill: 'rgba(212, 175, 55, 0.3)', fontSize: 9, fontWeight: 900 }} />
            <ReferenceArea x2={1300} y2={80} fill="rgba(255, 255, 255, 0.02)" stroke="none" label={{ value: 'BUDGET ZONE', position: 'insideBottomLeft', fill: 'rgba(255, 255, 255, 0.2)', fontSize: 9, fontWeight: 900 }} />
            <ReferenceArea x1={1300} y2={80} fill="rgba(239, 68, 68, 0.02)" stroke="none" label={{ value: 'UNDERPERFORMER', position: 'insideBottomRight', fill: 'rgba(239, 68, 68, 0.2)', fontSize: 9, fontWeight: 900 }} />

            <ReferenceLine x={1300} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            <ReferenceLine y={80} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            
            <ReferenceLine x={targetHotel?.price || 1350} stroke="rgba(212, 175, 55, 0.2)" strokeDasharray="3 3" />
            <ReferenceLine y={targetHotel?.sent || 82} stroke="rgba(212, 175, 55, 0.2)" strokeDasharray="3 3" />

            <Scatter name="Market" data={chartData}>
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.isTarget ? 'var(--soft-gold)' : 'rgba(255,255,255,0.1)'}
                  stroke={entry.isTarget ? 'white' : 'rgba(255,255,255,0.2)'}
                  strokeWidth={entry.isTarget ? 2 : 1}
                  className={entry.isTarget ? 'drop-shadow-[0_0_10px_rgba(212,175,55,0.5)]' : ''}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
        <div className="flex gap-4">
           <div className="flex items-center gap-1.5">
             <div className="w-2 h-2 rounded-full bg-[var(--soft-gold)]" />
             <span className="text-[9px] font-bold text-white uppercase">Your Position</span>
           </div>
           <div className="flex items-center gap-1.5">
             <div className="w-2 h-2 rounded-full bg-white/10 border border-white/20" />
             <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase">Competitor Orbit</span>
           </div>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] font-black text-[var(--optimal-green)] uppercase">
           <Target className="w-3 h-3" />
           Optimal Zone Identified
        </div>
      </div>
    </div>
  );
}
