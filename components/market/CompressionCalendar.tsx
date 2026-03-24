"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ForecastDay } from "@/hooks/useMarketForecast";
import { Tooltip } from "@/components/ui/Tooltip";

interface CompressionCalendarProps {
    data: ForecastDay[];
    selectedDate?: string;
    onSelectDay?: (date: string) => void;
}

export const CompressionCalendar: React.FC<CompressionCalendarProps> = ({ 
    data, 
    selectedDate,
    onSelectDay 
}) => {
    const getScoreColor = (score: number) => {
        if (score >= 8) return "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]";
        if (score >= 6) return "bg-orange-400";
        if (score >= 4) return "bg-amber-300";
        return "bg-slate-700/50";
    };

    return (
        <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Demand Compression Heatmap</h3>
                <div className="flex gap-2">
                    {["Stable", "Active", "Elevated", "Critical"].map((label, i) => (
                        <div key={label} className="flex items-center gap-1.5">
                            <div className={`w-2.5 h-2.5 rounded-full ${[
                                "bg-slate-700/50", "bg-amber-300", "bg-orange-400", "bg-red-500"
                            ][i]}`} />
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-7 gap-2 md:grid-cols-10 lg:grid-cols-[repeat(15,minmax(0,1fr))]">
                {data.map((day, idx) => (
                    <Tooltip
                        key={day.date}
                        content={
                            <div className="space-y-2 w-72 p-1">
                                <div className="flex justify-between items-start">
                                    <span className="text-xs font-bold">{new Date(day.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/10">{day.level}</span>
                                </div>
                                <p className="text-[11px] leading-relaxed text-slate-300 italic">
                                    "{day.rationale}"
                                </p>
                                {day.signals.length > 0 && (
                                    <div className="pt-2 border-t border-white/5 space-y-1">
                                        {day.signals.map((s, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${
                                                    s.type === 'fair' ? 'bg-[#A855F7]' : 'bg-[#F97316]'
                                                }`} />
                                                <span className="text-[10px] text-slate-400">{s.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        }
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.005 }}
                            whileHover={{ scale: 1.1, zIndex: 10 }}
                            onClick={() => onSelectDay?.(day.date)}
                            className={`aspect-square w-full rounded-md cursor-pointer flex items-center justify-center border-2 transition-all ${
                                selectedDate === day.date 
                                    ? "border-white scale-110 z-10 shadow-lg shadow-white/10" 
                                    : "border-white/5"
                            } ${getScoreColor(day.compression_score)}`}
                        >
                            <span className={`text-[9px] font-bold ${
                                day.compression_score >= 4 ? "text-black/80" : "text-white/40"
                            }`}>
                                {new Date(day.date).getDate()}
                            </span>
                        </motion.div>
                    </Tooltip>
                ))}
            </div>
        </div>
    );
};
