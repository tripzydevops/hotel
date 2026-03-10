"use client";

import React from "react";
import { motion } from "framer-motion";

interface OpportunityMatrixProps {
    city: string;
}

export const OpportunityMatrix: React.FC<OpportunityMatrixProps> = ({ city }) => {
    // Static demonstration data for the "Premium King" zone logic
    const quadrants = [
        { name: "Premium King", pos: "top-right", color: "bg-emerald-500/20", border: "border-emerald-500/50", desc: "High Promo + High Gap. Push Rates!" },
        { name: "Volume Play", pos: "top-left", color: "bg-blue-500/10", border: "border-blue-500/30", desc: "High Promo + Low Gap. Maintain ADR." },
        { name: "Risk Zone", pos: "bottom-left", color: "bg-red-500/10", border: "border-red-500/30", desc: "Low Promo + Low Gap. High Churn Risk." },
        { name: "Niche Value", pos: "bottom-right", color: "bg-amber-500/10", border: "border-amber-500/30", desc: "Low Promo + High Gap. Targeted Offers." },
    ];

    return (
        <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-sm shadow-xl">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Strategic Opportunity Matrix</h3>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{city}</span>
            </div>

            <div className="relative aspect-square w-full max-w-[400px] mx-auto grid grid-cols-2 grid-rows-2 border border-slate-700/50">
                {/* Axes */}
                <div className="absolute left-[-20px] top-1/2 -translate-y-1/2 -rotate-90 text-[9px] font-bold text-slate-500 uppercase tracking-widest pointer-events-none">
                    Regional Promotion (TGA)
                </div>
                <div className="absolute bottom-[-20px] left-1/2 -translate-x-1/2 text-[9px] font-bold text-slate-500 uppercase tracking-widest pointer-events-none">
                    Competitor Price Gap
                </div>

                {quadrants.map((q, i) => (
                    <motion.div
                        key={q.name}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className={`p-4 flex flex-col justify-center items-center text-center border ${q.border} ${q.color} relative overflow-hidden group cursor-crosshair`}
                    >
                        <span className="text-xs font-bold text-white mb-1 group-hover:scale-110 transition-transform">
                            {q.name}
                        </span>
                        <p className="text-[9px] text-slate-400 leading-tight px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {q.desc}
                        </p>
                        {/* Pulsing indicator for current market stance (Mocked for Istanbul) */}
                        {q.name === "Premium King" && city === "Istanbul" && (
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="absolute w-3 h-3 bg-emerald-400 rounded-full shadow-[0_0_15px_rgba(52,211,153,0.5)]"
                            />
                        )}
                    </motion.div>
                ))}
            </div>
        </div>
    );
};
