"use client";

import React from "react";
import { motion } from "framer-motion";
import { Tooltip } from "@/components/ui/Tooltip";
import { Info } from "lucide-react";

interface OpportunityMatrixProps {
    city: string;
    intensity: number; // 0 to 5+
    priceGap: number;  // % difference
}

export const OpportunityMatrix: React.FC<OpportunityMatrixProps> = ({ city, intensity, priceGap }) => {
    // Logic to determine dot position:
    // Intensity (Y): TGA average for the city. Normalizing 0-5 to 0-100%
    // Price Gap (X): User vs. Comp. Normalizing -10% to +10% to 0-100%
    const yPos = Math.min(Math.max((intensity / 5) * 100, 5), 95);
    const xPos = Math.min(Math.max(((priceGap + 10) / 20) * 100, 5), 95);

    const quadrants = [
        { name: "Volume Play", pos: "top-left", color: "bg-blue-500/10", border: "border-blue-500/20", desc: "High Promo + Competitive Price. Maintain ADR." },
        { name: "Premium King", pos: "top-right", color: "bg-emerald-500/20", border: "border-emerald-500/50", desc: "High Promo + High Gap. Push Rates!" },
        { name: "Risk Zone", pos: "bottom-left", color: "bg-red-500/10", border: "border-red-500/20", desc: "Low Promo + Competitive Price. Churn Risk." },
        { name: "Niche Value", pos: "bottom-right", color: "bg-amber-500/10", border: "border-amber-500/20", desc: "Low Promo + High Gap. Targeted Offers." },
    ];

    return (
        <div className="p-4 bg-[var(--deep-ocean-card)] border border-[var(--glass-border)] rounded-xl backdrop-blur-sm shadow-xl flex flex-col ring-1 ring-[var(--glass-border)]">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">Strategic Opportunity Matrix</h3>
                    <Tooltip 
                        content={
                            <div className="max-w-xs space-y-2 p-1">
                                <p className="font-bold border-b border-[var(--glass-border)] pb-1 text-[var(--text-primary)]">About the Matrix</p>
                                <p>This grid plots your current market position based on two critical axes:</p>
                                <ul className="list-disc pl-4 space-y-1">
                                    <li><span className="text-emerald-400">Vertical:</span> regional promotion intensity (from TGA).</li>
                                    <li><span className="text-blue-400">Horizontal:</span> your price gap vs competitors.</li>
                                </ul>
                                <p className="pt-1 italic text-xs text-[var(--text-muted)]">Current position: {intensity.toFixed(1)} intensity / {priceGap > 0 ? '+' : ''}{priceGap}% gap</p>
                            </div>
                        }
                        side="bottom"
                    >
                        <Info className="w-4 h-4 text-slate-500 cursor-help hover:text-slate-300 transition-colors" />
                    </Tooltip>
                </div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest bg-[var(--deep-ocean-accent)]/20 px-2 py-0.5 rounded">{city}</span>
            </div>

            <div className="relative w-full max-w-[250px] mx-auto grid grid-cols-2 grid-rows-2 border border-[var(--glass-border)]" style={{ aspectRatio: '1' }}>
                <div className="absolute -left-12 top-1/2 -translate-y-1/2 -rotate-90 text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest whitespace-nowrap">
                    Promotion Intensity (TGA) &uarr;
                </div>
                {/* X-Axis Label */}
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest whitespace-nowrap">
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
                        <span className="text-[11px] font-bold text-[var(--text-primary)] mb-1 leading-tight group-hover:scale-105 transition-transform">
                            {q.name}
                        </span>
                        <p className="text-[9px] text-[var(--text-muted)] leading-tight px-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            {q.desc}
                        </p>
                    </motion.div>
                ))}

                {/* Pulsing indicator for current market stance */}
                <motion.div
                    className="absolute z-20"
                    initial={{ left: "50%", bottom: "50%" }}
                    animate={{ left: `${xPos}%`, bottom: `${yPos}%` }}
                    transition={{ type: "spring", stiffness: 50, damping: 15 }}
                >
                    <div className="relative">
                        <motion.div
                            animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute -inset-2 bg-emerald-400 rounded-full"
                        />
                        <div className="w-3 h-3 bg-emerald-400 rounded-full border-2 border-[var(--deep-ocean-card)] shadow-[0_0_15px_rgba(52,211,153,0.8)]" />
                    </div>
                </motion.div>
            </div>
        </div>
    );
};
