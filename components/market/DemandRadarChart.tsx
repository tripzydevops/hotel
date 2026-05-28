"use client";

import React, { useMemo } from "react";
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Tooltip
} from "recharts";
import { MarketEvent } from "@/hooks/useMarketEvents";
import { Activity, ShieldAlert, Award } from "lucide-react";
import { motion } from "framer-motion";

interface DemandRadarChartProps {
    city: string;
    events: MarketEvent[];
    loading?: boolean;
}

interface RadarDataPoint {
    subject: string;
    volume: number;      // Event Volume (normalized scale)
    intensity: number;   // Compression Stance (avg intensity score out of 10)
    rawCount: number;    // Actual count of events
}

export const DemandRadarChart: React.FC<DemandRadarChartProps> = ({
    city,
    events,
    loading = false
}) => {
    // Process and categorize events
    const radarData = useMemo<RadarDataPoint[]>(() => {
        // Base categories
        const categories = {
            "Trade Fairs": { count: 0, totalIntensity: 0, types: ["fair"] },
            "Tourism Initiatives": { count: 0, totalIntensity: 0, types: ["announcement"] },
            "Sports & Athletics": { count: 0, totalIntensity: 0, types: ["sports", "sport", "athletic"] },
            "Concerts & Music": { count: 0, totalIntensity: 0, types: ["music", "concert", "festival", "festivals"] },
            "Business & Summits": { count: 0, totalIntensity: 0, types: ["conference", "expo", "expos", "summit"] },
            "General Gatherings": { count: 0, totalIntensity: 0, types: [] }
        };

        // Classify each event
        events.forEach((e) => {
            const typeLower = (e.type || "").toLowerCase();
            const intensity = e.intensity_score || 3;
            
            let matched = false;
            for (const [catName, cat] of Object.entries(categories)) {
                if (cat.types.some(t => typeLower.includes(t) || t.includes(typeLower))) {
                    cat.count += 1;
                    cat.totalIntensity += intensity;
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                categories["General Gatherings"].count += 1;
                categories["General Gatherings"].totalIntensity += intensity;
            }
        });

        // Map to Recharts points
        const subjects = Object.entries(categories).map(([name, cat]) => {
            const rawCount = cat.count;
            const avgIntensity = rawCount > 0 ? cat.totalIntensity / rawCount : 0;
            
            // Normalize volume (0 to 10 scale for visual balance)
            // If rawCount is 0, give it a tiny base value for a nice grid layout
            const volume = rawCount > 0 ? Math.min(rawCount * 2, 10) : 1;
            const intensity = rawCount > 0 ? avgIntensity : 2;

            return {
                subject: name,
                volume,
                intensity,
                rawCount
            };
        });

        return subjects;
    }, [events]);

    const totalEventCount = events.length;

    // Check if the radar is empty
    const isEmpty = totalEventCount === 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="glass-card p-6 bg-[#0B1F3B]/40 border border-white/[0.08] rounded-3xl backdrop-blur-xl h-full flex flex-col group relative overflow-hidden"
        >
            {/* Background accent glow */}
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-[#3B82F6]/5 rounded-full blur-3xl -z-10 group-hover:bg-[#3B82F6]/8 transition-all duration-700"></div>

            <div className="flex items-center justify-between mb-4 z-10">
                <div>
                    <h3 className="text-lg font-bold text-[var(--overlay-text)] flex items-center gap-2">
                        <Activity className="w-4 h-4 text-[#3B82F6]" />
                        Demand Distribution Stance
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-black">
                        Categorized compression breakdown for {city}
                    </p>
                </div>
                {totalEventCount > 0 && (
                    <span className="text-[9px] text-[#3B82F6] font-black uppercase tracking-wider bg-[#3B82F6]/10 px-2 py-0.5 rounded border border-[#3B82F6]/20">
                        {totalEventCount} events mapped
                    </span>
                )}
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[250px]">
                    <div className="w-8 h-8 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">Analyzing category vectors...</p>
                </div>
            ) : isEmpty ? (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[250px] text-center p-4">
                    <ShieldAlert className="w-8 h-8 text-slate-600 mb-2 stroke-[1.5]" />
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">No distribution vectors found</p>
                    <p className="text-[10px] text-slate-600 mt-1 max-w-[200px]">Seeding empty state map. Dropdown selection will refresh coordinates.</p>
                </div>
            ) : (
                <div className="flex-1 min-h-[250px] flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                            <PolarGrid stroke="rgba(255, 255, 255, 0.05)" />
                            
                            <PolarAngleAxis 
                                dataKey="subject" 
                                tick={{ fill: "rgba(255, 255, 255, 0.4)", fontSize: 8, fontWeight: "bold" }} 
                            />
                            
                            <PolarRadiusAxis 
                                angle={30} 
                                domain={[0, 10]} 
                                tick={false} 
                                axisLine={false} 
                            />

                            {/* Tooltip for hover detail */}
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "rgba(5, 10, 30, 0.95)",
                                    border: "1px solid rgba(255, 255, 255, 0.1)",
                                    borderRadius: "16px",
                                    backdropFilter: "blur(12px)"
                                }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const dp = payload[0].payload;
                                        return (
                                            <div className="p-3 space-y-2">
                                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">
                                                    {dp.subject}
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between items-center gap-6 text-xs font-bold">
                                                        <span className="text-[#3B82F6]">Event Count:</span>
                                                        <span className="text-white font-black">{dp.rawCount}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center gap-6 text-xs font-bold">
                                                        <span className="text-[#D4AF37]">Compression Stance:</span>
                                                        <span className="text-white font-black">{dp.rawCount > 0 ? `${dp.intensity.toFixed(1)} / 10` : "N/A"}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />

                            {/* Radar 1: Compset Stance Volume */}
                            <Radar
                                name="Event Volume"
                                dataKey="volume"
                                stroke="#3B82F6"
                                fill="#3B82F6"
                                fillOpacity={0.2}
                            />

                            {/* Radar 2: Compression Stance Intensity */}
                            <Radar
                                name="Compression Impact"
                                dataKey="intensity"
                                stroke="#D4AF37"
                                fill="#D4AF37"
                                fillOpacity={0.4}
                            />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Legend row */}
            <div className="mt-4 pt-4 border-t border-white/[0.05] flex items-center justify-center gap-6 text-[10px] text-slate-500 font-bold">
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#3B82F6] opacity-60" />
                    <span>Event Volume Index</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] opacity-80" />
                    <span>Compression Impact Score</span>
                </div>
            </div>
        </motion.div>
    );
};
