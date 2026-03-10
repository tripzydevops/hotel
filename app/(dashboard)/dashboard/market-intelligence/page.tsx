"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Loader2, RefreshCw, Info } from "lucide-react";
import { useMarketForecast } from "@/hooks/useMarketForecast";
import { api } from "@/lib/api";
import { Tooltip } from "@/components/ui/Tooltip";
import { CompressionCalendar } from "@/components/market/CompressionCalendar";
import { IntensityBubbleChart } from "@/components/market/IntensityBubbleChart";
import { OpportunityMatrix } from "@/components/market/OpportunityMatrix";
import { BentoTile } from "@/components/ui/BentoGrid";

export default function MarketIntelligencePage() {
    const [city, setCity] = useState("Istanbul");
    const [cities, setCities] = useState<string[]>(["Istanbul"]);
    const [loadingCities, setLoadingCities] = useState(true);
    const { data, loading, error } = useMarketForecast(city, 60);

    useEffect(() => {
        async function fetchCities() {
            try {
                const res = await fetch("/api/market/cities");
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.length > 0) {
                        setCities(data);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch cities", err);
            } finally {
                setLoadingCities(false);
            }
        }
        fetchCities();
    }, []);

    const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setCity(e.target.value);
    };

    const currentDay = data.length > 0 ? data[0] : null;

    return (
        <div className="container mx-auto p-6 space-y-8 min-h-screen bg-[#020617]">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Market Intelligence</h1>
                    <p className="text-slate-400">Localized demand signals & predictive compression.</p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <select
                            value={city}
                            onChange={handleCityChange}
                            disabled={loadingCities}
                            className="appearance-none pl-3 pr-10 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)] w-64 cursor-pointer disabled:opacity-50"
                        >
                            {cities.map(c => (
                                <option key={c} value={c} className="bg-slate-900 text-white">
                                    {c}
                                </option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <RefreshCw className={`w-3 h-3 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                        </div>
                    </div>
                </div>
            </div>

            {loading && data.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[50vh]">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                    <p className="text-slate-400 italic">Ingesting Turkish demand signals...</p>
                </div>
            ) : (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                >
                    {/* Left Column: Compression Pulse */}
                    <div className="lg:col-span-2 space-y-8">
                        <CompressionCalendar data={data} />
                        <div className="relative">
                            <IntensityBubbleChart data={data} />
                            <div className="absolute top-6 right-6">
                                <Tooltip 
                                    content={
                                        <div className="max-w-xs space-y-1">
                                            <p className="font-bold border-b border-white/10 pb-1 mb-1">Market Intensity Signals</p>
                                            <p>Clusters of dots indicate high-density market events.</p>
                                            <p className="text-blue-400">Blue: Trade Fairs (TOBB)</p>
                                            <p className="text-amber-400">Orange: Tourism Announcements (TGA)</p>
                                            <p className="pt-1 italic">Closer clusters = Higher risk of demand compression.</p>
                                        </div>
                                    }
                                    side="left"
                                >
                                    <div className="p-1 rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-help">
                                        <Info className="w-4 h-4 text-slate-400" />
                                    </div>
                                </Tooltip>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Strategic Insight */}
                    <div className="space-y-8">
                        <OpportunityMatrix city={city} />

                        <BentoTile className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                            <div className="mb-4">
                                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                                    Strategic Rationale
                                </h3>
                            </div>
                            <div>
                                {currentDay ? (
                                    <div className="space-y-4">
                                        <p className="text-slate-300 leading-relaxed text-sm italic border-l-2 border-blue-500 pl-4 py-1">
                                            "{currentDay.rationale}"
                                        </p>
                                        <div className="pt-4 border-t border-white/5">
                                            <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2">Detected Signals</h4>
                                            <div className="space-y-2">
                                                {currentDay.signals.map((s, i) => (
                                                    <div key={i} className="flex justify-between items-center bg-white/5 p-2 rounded">
                                                        <span className="text-xs text-white">{s.name}</span>
                                                        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase">
                                                            {s.type}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-slate-500 text-sm italic">No signals detected for the selection.</p>
                                )}
                            </div>
                        </BentoTile>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
