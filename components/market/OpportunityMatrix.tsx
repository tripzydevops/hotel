"use client";

import React from "react";
import { motion } from "framer-motion";
import { Tooltip } from "@/components/ui/Tooltip";
import { Info } from "lucide-react";

interface OpportunityMatrixProps {
    city: string;
}

export const OpportunityMatrix: React.FC<OpportunityMatrixProps> = ({ city }) => {
    // Static demonstration data for the "Premium King" zone logic
    const quadrants = [
        { name: "Volume Play", pos: "top-left", color: "bg-blue-500/10", border: "border-blue-500/20", desc: "High Promo + Low Gap. Maintain ADR." },
        { name: "Premium King", pos: "top-right", color: "bg-emerald-500/20", border: "border-emerald-500/50", desc: "High Promo + High Gap. Push Rates!" },
        { name: "Risk Zone", pos: "bottom-left", color: "bg-red-500/10", border: "border-red-500/20", desc: "Low Promo + Low Gap. High Churn Risk." },
        { name: "Niche Value", pos: "bottom-right", color: "bg-amber-500/10", border: "border-amber-500/20", desc: "Low Promo + High Gap. Targeted Offers." },
    ];

    return (
        <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm shadow-xl flex flex-col h-full">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">Strategic Opportunity Matrix</h3>
                    <Tooltip 
                        content={
                            <div className="max-w-xs space-y-2 p-1">
                                <p className="font-bold border-b border-white/10 pb-1">About the Matrix</p>
                                <p>This grid plots your current market position based on two critical axes:</p>
                                <ul className="list-disc pl-4 space-y-1">
                                    <li><span className="text-emerald-400">Vertical:</span> regional promotion intensity (from TGA).</li>
                                    <li><span className="text-blue-400">Horizontal:</span> your price gap vs competitors.</li>
                                </ul>
                                <p className="pt-1 italic">Use this to decide whether to yield ADR or push for occupancy.</p>
                            </div>
                        }
                        side="bottom"
                    >
                        <Info className="w-4 h-4 text-slate-500 cursor-help hover:text-slate-300 transition-colors" />
                    </Tooltip>
                </div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest bg-slate-800/50 px-2 py-0.5 rounded">{city}</span>
            </div>

            <div className="relative flex-1 aspect-square w-full max-w-[320px] mx-auto grid grid-cols-2 grid-rows-2 border border-slate-700/30">
                {/* Y-Axis Label */}
                <div className="absolute -left-12 top-1/2 -translate-y-1/2 -rotate-90 text-[8px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">
                    Promotion Intensity (TGA) &uarr;
                </div>
                {/* X-Axis Label */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">
                    Price Gap vs Competitors &rarr;
                </div>

                {quadrants.map((q, i) => (
                    <motion.div
                        key={q.name}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className={`p-3 flex flex-col justify-center items-center text-center border ${q.border} ${q.color} relative overflow-hidden group cursor-crosshair`}
                    >
                        <span className="text-[11px] font-bold text-white mb-1 leading-tight group-hover:scale-105 transition-transform">
                            {q.name}
                        </span>
                        <p className="text-[9px] text-slate-400 leading-tight px-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            {q.desc}
                        </p>
                        {/* Pulsing indicator for current market stance */}
                        {q.name === "Premium King" && city === "Istanbul" && (
                            <motion.div
                                animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="absolute w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-[0_0_12px_rgba(52,211,153,0.6)]"
                            />
                        )}
                    </motion.div>
                ))}
            </div>
        </div>
    );
};
