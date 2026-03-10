"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Search, Loader2, RefreshCw } from "lucide-react";
import { useMarketForecast } from "@/hooks/useMarketForecast";
import { CompressionCalendar } from "@/components/market/CompressionCalendar";
import { IntensityBubbleChart } from "@/components/market/IntensityBubbleChart";
import { OpportunityMatrix } from "@/components/market/OpportunityMatrix";
import { BentoTile } from "@/components/ui/BentoGrid";

export default function MarketIntelligencePage() {
    const [city, setCity] = useState("Istanbul");
    const [searchInput, setSearchInput] = useState("Istanbul");
    const { data, loading, error } = useMarketForecast(city, 60);

    const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setCity(searchInput);
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

                <form onSubmit={handleSearch} className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            value={searchInput}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchInput(e.target.value)}
                            placeholder="Enter city..."
                            className="pl-10 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)] w-64"
                        />
                    </div>
                    <button
                        type="submit"
                        className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[var(--soft-gold)] text-[var(--deep-ocean)] text-sm font-bold hover:brightness-110 transition-all"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Sync
                    </button>
                </form>
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
                        <IntensityBubbleChart data={data} />
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
