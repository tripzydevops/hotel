"use client";

import React, { useMemo } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine,
    ResponsiveContainer
} from "recharts";
import { format, parseISO, addDays, isSameDay } from "date-fns";
import { MarketEvent } from "@/hooks/useMarketEvents";
import { ForecastDay } from "@/hooks/useMarketForecast";
import { TrendingUp, Activity, HelpCircle, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

interface PricingEventOverlayChartProps {
    city: string;
    events: MarketEvent[];
    forecastData: ForecastDay[];
    dailyPrices?: any[]; // actual pricing logs if available
    currency?: string;
}

export const PricingEventOverlayChart: React.FC<PricingEventOverlayChartProps> = ({
    city,
    events,
    forecastData,
    dailyPrices = [],
    currency = "TRY"
}) => {
    const currencySymbol = currency === "TRY" ? "₺" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency;

    // Harmonize and align data
    const chartData = useMemo(() => {
        const today = new Date();
        const daysToProject = 30;
        
        // Generate list of next 30 days
        const dateRange = Array.from({ length: daysToProject }).map((_, idx) => {
            return addDays(today, idx);
        });

        // Map dailyPrices if they exist and are populated
        const actualPricesMap = new Map<string, { price: number; comp_avg: number }>();
        if (dailyPrices && dailyPrices.length > 0) {
            dailyPrices.forEach((dp) => {
                if (dp.date) {
                    const cleanDate = dp.date.split("T")[0];
                    actualPricesMap.set(cleanDate, {
                        price: dp.price || dp.comp_avg || 0,
                        comp_avg: dp.comp_avg || dp.price || 0
                    });
                }
            });
        }

        // Determine if we are in "Predictive/Cold Start" mode
        const hasActualPricing = actualPricesMap.size >= 5;

        return dateRange.map((dateObj) => {
            const dateStr = format(dateObj, "yyyy-MM-dd");
            const displayDate = format(dateObj, "MMM d");
            const dayOfWeek = dateObj.getDay();
            const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Fri & Sat stay nights

            // Find events happening on this exact day
            const dailyEvents = events.filter((e) => {
                const start = parseISO(e.start_date);
                const end = parseISO(e.end_date || e.start_date);
                // Normalized check
                return dateObj >= start && dateObj <= end;
            });

            // Find compression forecast for this day
            const forecastDay = forecastData.find((fd) => {
                try {
                    return isSameDay(parseISO(fd.date), dateObj);
                } catch {
                    return fd.date === dateStr;
                }
            });

            const compressionScore = forecastDay?.compression_score || 0;

            // Base price rates
            let targetPrice = 0;
            let compAverage = 0;

            if (hasActualPricing && actualPricesMap.has(dateStr)) {
                const rates = actualPricesMap.get(dateStr)!;
                targetPrice = rates.price;
                compAverage = rates.comp_avg;
            } else {
                // Predictive pricing logic: Solve cold start / cross-city
                // Dynamic multiplier based on event intensity & compression scores
                // Cap at 0.6 to prevent price spikes from blowing the Y-axis scale
                const rawEventMultiplier = dailyEvents.reduce((acc, evt) => {
                    const weight = ((evt.intensity_score ?? evt.compression_score) || 3) / 15;
                    return acc + weight;
                }, 0);
                const eventMultiplier = Math.min(rawEventMultiplier, 0.6);

                const compressionMultiplier = Math.min(compressionScore / 20, 0.5); // max score 10 = +50%, capped
                const finalMultiplier = 1 + eventMultiplier + compressionMultiplier;

                // Base pricing scales for different major cities in Turkey
                const baseTarget = city === "Istanbul" ? 2800 : city === "Antalya" ? 2400 : city === "Ankara" ? 1800 : 1600;
                const baseComp = city === "Istanbul" ? 2500 : city === "Antalya" ? 2200 : city === "Ankara" ? 1650 : 1500;

                // Weekend stays mark-up
                const weekendMarkup = isWeekend ? 1.15 : 1.0;

                // Dynamic simulation with soft random variance
                const dayHash = dateObj.getDate() * 7;
                const pseudoRandom = 1 + ((dayHash % 10) - 5) / 150; // -3% to +3%

                targetPrice = Math.round(baseTarget * finalMultiplier * weekendMarkup * pseudoRandom);
                compAverage = Math.round(baseComp * finalMultiplier * weekendMarkup * pseudoRandom);
            }

            // Top event info for tooltips
            const dominantEvent = dailyEvents.sort((a, b) => ((b.intensity_score ?? b.compression_score) || 0) - ((a.intensity_score ?? a.compression_score) || 0))[0];

            return {
                date: dateStr,
                displayDate,
                targetPrice,
                compAverage,
                compressionScore,
                eventName: dominantEvent ? dominantEvent.name : null,
                eventIntensity: dominantEvent ? (dominantEvent.intensity_score ?? dominantEvent.compression_score) : null,
                isPredicted: !hasActualPricing
            };
        });
    }, [city, events, forecastData, dailyPrices]);

    // Extract high-intensity events to overlay as vertical indicators
    const overlayEvents = useMemo(() => {
        // Find events in the next 30 days
        const today = new Date();
        const maxDate = addDays(today, 30);

        const activeUpcoming = events.filter((e) => {
            const start = parseISO(e.start_date);
            return start >= today && start <= maxDate;
        });

        // Group by day to prevent chart clutter (limit to top intensity event per day)
        const uniqueDayEvents: Record<string, MarketEvent> = {};
        activeUpcoming.forEach((e) => {
            const dateKey = e.start_date.split("T")[0];
            if (!uniqueDayEvents[dateKey] || ((e.intensity_score ?? e.compression_score) || 0) > ((uniqueDayEvents[dateKey].intensity_score ?? uniqueDayEvents[dateKey].compression_score) || 0)) {
                uniqueDayEvents[dateKey] = e;
            }
        });

        // Convert to overlay indicators and sort by intensity
        return Object.entries(uniqueDayEvents)
            .map(([dateStr, e]) => ({
                date: dateStr,
                name: e.name,
                intensity: (e.intensity_score ?? e.compression_score) || 3,
                type: e.type,
                attendees: e.expected_attendees || 0
            }))
            .filter(o => o.intensity >= 4) // Only highlight medium-high compression events
            .slice(0, 6); // Cap at 6 reference lines to maintain high chart legibility
    }, [events]);

    const isProjectedData = chartData[0]?.isPredicted;

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="glass-card p-6 bg-[#0B1F3B]/40 border border-white/[0.08] rounded-3xl backdrop-blur-xl relative overflow-hidden flex flex-col group"
        >
            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-[#D4AF37]/5 rounded-full blur-3xl -z-10 group-hover:bg-[#D4AF37]/8 transition-all duration-700"></div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
                <div>
                    <h3 className="text-lg font-bold text-[var(--overlay-text)] flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/20">
                            <Activity className="w-4 h-4 text-[#D4AF37]" />
                        </div>
                        Pricing vs. Event Compression
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-black flex items-center gap-1.5">
                        Stay-Date Price Elasticity overlayed with demand spikes
                        {isProjectedData && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] font-black uppercase tracking-normal">
                                Predictive Model Active
                            </span>
                        )}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-black/30 px-2.5 py-1 rounded-lg border border-white/5 text-[9px] font-bold">
                        <div className="w-2 h-2 rounded bg-[#D4AF37]" />
                        <span className="text-slate-300">Target ADR</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-black/30 px-2.5 py-1 rounded-lg border border-white/5 text-[9px] font-bold">
                        <div className="w-2 h-2 rounded bg-[#3B82F6]" />
                        <span className="text-slate-300">Compset Avg</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-black/30 px-2.5 py-1 rounded-lg border border-white/5 text-[9px] font-bold">
                        <div className="w-2 h-2 rounded bg-purple-500 animate-pulse" />
                        <span className="text-slate-300">Compression Overlay</span>
                    </div>
                </div>
            </div>

            {/* Main Chart Container */}
            <div className="w-full relative" style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData} margin={{ top: 20, right: 35, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                        
                        <XAxis 
                            dataKey="displayDate" 
                            stroke="rgba(255,255,255,0.2)" 
                            fontSize={9}
                            fontWeight="bold"
                            tickLine={false}
                            axisLine={false}
                        />
                        
                        <YAxis 
                            stroke="rgba(255,255,255,0.2)" 
                            fontSize={9}
                            fontWeight="bold"
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => `${currencySymbol}${v}`}
                            domain={[
                                (dataMin: number) => Math.floor(dataMin * 0.9 / 100) * 100,
                                (dataMax: number) => Math.ceil(dataMax * 1.1 / 100) * 100
                            ]}
                        />

                        {/* Interactive Dark Tooltip */}
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "rgba(5, 10, 30, 0.95)",
                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                borderRadius: "16px",
                                backdropFilter: "blur(12px)",
                                boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
                            }}
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    const dataPoint = payload[0].payload;
                                    return (
                                        <div className="p-4 space-y-2.5 min-w-[200px] max-w-[260px]">
                                            <div className="text-xs font-black text-slate-400 uppercase tracking-wider leading-none">
                                                {format(parseISO(dataPoint.date), "EEEE, MMM d")}
                                            </div>
                                            
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center gap-4">
                                                    <span className="text-sm font-bold text-[#D4AF37]">Target ADR:</span>
                                                    <span className="text-base font-black text-white">{currencySymbol}{dataPoint.targetPrice.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center gap-4">
                                                    <span className="text-sm font-bold text-[#3B82F6]">Compset Avg:</span>
                                                    <span className="text-base font-black text-white">{currencySymbol}{dataPoint.compAverage.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center gap-4 pt-1 border-t border-white/5">
                                                    <span className="text-xs font-bold text-slate-400">Compression:</span>
                                                    <span className={`text-sm font-black ${dataPoint.compressionScore >= 8 ? 'text-red-400' : dataPoint.compressionScore >= 5 ? 'text-orange-400' : 'text-blue-400'}`}>
                                                        {dataPoint.compressionScore}/10
                                                    </span>
                                                </div>
                                            </div>

                                            {dataPoint.eventName && (
                                                <div className="pt-2 border-t border-white/10 space-y-1">
                                                    <div className="text-[10px] font-black text-purple-400 uppercase tracking-wider leading-none">
                                                        Dominant Event
                                                    </div>
                                                    <div className="text-xs font-bold text-white leading-snug">
                                                        {dataPoint.eventName}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />

                        {/* High-intensity Event Indicators */}
                        {overlayEvents.map((evt, idx) => (
                            <ReferenceLine
                                key={idx}
                                x={format(parseISO(evt.date), "MMM d")}
                                stroke="rgba(168, 85, 247, 0.45)"
                                strokeWidth={1}
                                strokeDasharray="3 3"
                                label={{
                                    value: evt.name.substring(0, 12) + (evt.name.length > 12 ? "…" : ""),
                                    fill: "rgba(168, 85, 247, 0.6)",
                                    fontSize: 9,
                                    fontWeight: "bold",
                                    position: "top",
                                    offset: 8
                                }}
                            />
                        ))}

                        {/* Compset Line */}
                        <Line
                            type="monotone"
                            dataKey="compAverage"
                            stroke="#3B82F6"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, stroke: "rgba(59, 130, 246, 0.5)", strokeWidth: 4 }}
                        />

                        {/* Target ADR Line */}
                        <Line
                            type="monotone"
                            dataKey="targetPrice"
                            stroke="#D4AF37"
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 6, stroke: "rgba(212, 175, 55, 0.4)", strokeWidth: 6 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Context / Notice Panel */}
            <div className="mt-4 pt-4 border-t border-white/[0.05] flex items-center justify-between text-[10px] text-slate-500 font-bold">
                <span className="flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5" />
                    How to read: Peak spacing indicates target ADR outperforming compset during event compression events.
                </span>
                
                {isProjectedData && (
                    <span className="flex items-center gap-1 text-emerald-400 uppercase tracking-tighter bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">
                        <AlertCircle className="w-3 h-3" />
                        AI-Seeded Compression Stance Enabled
                    </span>
                )}
            </div>
        </motion.div>
    );
};
