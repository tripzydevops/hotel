"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, RefreshCw, Info } from "lucide-react";
import { useMarketForecast } from "@/hooks/useMarketForecast";
import { api } from "@/lib/api";
import { Tooltip } from "@/components/ui/Tooltip";
import { CompressionCalendar } from "@/components/market/CompressionCalendar";
import { IntensityBubbleChart } from "@/components/market/IntensityBubbleChart";
import { OpportunityMatrix } from "@/components/market/OpportunityMatrix";
import { GlobalEventCalendar } from "@/components/market/GlobalEventCalendar";
import { BentoTile } from "@/components/ui/BentoGrid";

export default function MarketIntelligencePage() {
    const [city, setCity] = useState("Istanbul");
    const [cities, setCities] = useState<string[]>(["Istanbul"]);
    const [days, setDays] = useState(60);
    const [loadingCities, setLoadingCities] = useState(true);
    const [selectedDayIdx, setSelectedDayIdx] = useState(0);
    
    const { data, metadata, loading, error } = useMarketForecast(city, days);

    useEffect(() => {
        async function fetchCities() {
            try {
                const data = await api.getMarketCities();
                if (data && data.length > 0) {
                    setCities(data);
                    if (!data.includes(city)) {
                        setCity(data[0]);
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
        setSelectedDayIdx(0);
    };

    const currentDay = data.length > 0 ? data[selectedDayIdx] : null;

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#020617] p-6 text-center">
                <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-2xl max-w-md">
                    <h2 className="text-xl font-bold text-white mb-2">Market Data Unavailable</h2>
                    <p className="text-slate-400 mb-6">{error}</p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-2 mx-auto px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Retry Connection
                    </button>
                </div>
            </div>
        );
    }

    const handleExportCSV = () => {
        if (!data || data.length === 0) return;
        
        // Simple CSV generation
        const headers = ["Date", "City", "Score", "Level", "Signals", "Rationale"];
        const rows = data.map(day => [
            day.date,
            day.city,
            day.compression_score,
            day.level,
            day.signals.map(s => `${s.name} (${s.type})`).join("; "),
            `"${day.rationale.replace(/"/g, '""')}"`
        ]);
        
        const csvContent = [headers, ...rows].map(r => r.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `market_forecast_${city.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="container mx-auto p-6 space-y-8 min-h-screen bg-[#020617]">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Market Intelligence</h1>
                    <p className="text-slate-400">Localized demand signals & predictive compression.</p>
                    {!loading && metadata?.last_synced && (
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                            <RefreshCw className="w-2.5 h-2.5" />
                            <span>Last Synced: {new Date(metadata.last_synced).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={handleExportCSV}
                        disabled={loading || data.length === 0}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-lg border border-white/10 transition-all disabled:opacity-50"
                    >
                        <Search className="w-3.5 h-3.5" />
                        Download CSV
                    </button>

                    {/* Date Selector */}
                    <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                        {[30, 60, 90].map(d => (
                            <button
                                key={d}
                                onClick={() => setDays(d)}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                                    days === d ? "bg-[var(--soft-gold)] text-black" : "text-slate-400 hover:text-white"
                                }`}
                            >
                                {d}D
                            </button>
                        ))}
                    </div>

                    <div className="relative">
                        <select
                            value={city}
                            onChange={handleCityChange}
                            disabled={loadingCities}
                            className="appearance-none pl-3 pr-10 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)] w-60 cursor-pointer disabled:opacity-50"
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

            {/* KPI Summary Row */}
            {!loading && metadata && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: "Avg Compression", value: metadata.avg_compression_score, sub: "/ 10", color: "text-blue-400" },
                        { label: "Peak Date", value: metadata.peak_date ? new Date(metadata.peak_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "--", sub: "Score: " + metadata.peak_score, color: "text-red-400" },
                        { label: "Critical Days", value: metadata.critical_days_count, sub: "High Risk", color: "text-orange-400" },
                        { label: "Total Signals", value: metadata.total_signals, sub: "Market Events", color: "text-[#A855F7]" },
                    ].map((kpi, i) => (
                        <BentoTile key={i} className="bg-white/5 border-white/10 p-4">
                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider ">{kpi.label}</span>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</span>
                                <span className="text-xs text-slate-500">{kpi.sub}</span>
                            </div>
                        </BentoTile>
                    ))}
                </div>
            )}

            {/* Strategic Executive Summary (Moved from Sidebar) */}
            <AnimatePresence mode="wait">
                {currentDay && (
                    <motion.div
                        key={`rationale-${currentDay.date}`}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="w-full"
                    >
                        <BentoTile className="bg-gradient-to-r from-blue-500/10 to-transparent border-blue-500/20 backdrop-blur-sm p-6 relative overflow-hidden group">
                            <div className="flex flex-col md:flex-row md:items-center gap-6">
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 rounded-lg bg-blue-500/20">
                                            <Info className="w-4 h-4 text-blue-400" />
                                        </div>
                                        <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">
                                            Strategic Market Rationale
                                        </h3>
                                        <span className="text-[10px] text-slate-500 font-mono ml-auto">
                                            Analysis for {new Date(currentDay.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    </div>
                                    <p className="text-slate-200 leading-relaxed text-sm italic font-medium">
                                        "{currentDay.rationale}"
                                    </p>
                                </div>
                                
                                <div className="flex flex-wrap gap-2 md:w-64 shrink-0">
                                    {currentDay.signals.length > 0 ? (
                                        currentDay.signals.map((s, i) => (
                                            <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border transition-all hover:scale-105 ${
                                                s.type === 'fair' ? 'bg-[#A855F7]/10 border-[#A855F7]/30 text-[#A855F7]' : 'bg-[#F97316]/10 border-[#F97316]/30 text-[#F97316]'
                                            }`}>
                                                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                                                    s.type === 'fair' ? 'bg-[#A855F7]' : 'bg-[#F97316]'
                                                }`} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">{s.name}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-[10px] text-slate-600 italic">No significant demand signals detected.</p>
                                    )}
                                </div>
                            </div>
                        </BentoTile>
                    </motion.div>
                )}
            </AnimatePresence>

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
                        <CompressionCalendar 
                            data={data} 
                            selectedDate={currentDay?.date}
                            onSelectDay={(date) => {
                                const idx = data.findIndex(d => d.date === date);
                                if (idx !== -1) setSelectedDayIdx(idx);
                            }}
                        />
                        <div className="relative">
                            <IntensityBubbleChart data={data} />
                            <div className="absolute top-6 right-6">
                                <Tooltip 
                                    content={
                                        <div className="max-w-xs space-y-1">
                                            <p className="font-bold border-b border-white/10 pb-1 mb-1">Market Intensity Signals</p>
                                            <p>Clusters of dots indicate high-density market events.</p>
                                            <p className="text-[#A855F7] font-medium">Purple: Trade Fairs (TOBB)</p>
                                            <p className="text-[#F97316] font-medium">Orange: Tourism Announcements (TGA)</p>
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

                    {/* Right Column: Strategic Insight (Simplified) */}
                    <div className="space-y-8">
                        <OpportunityMatrix 
                            city={city} 
                            intensity={metadata?.market_stats?.avg_tga_intensity || 0}
                            priceGap={2.5} // Still static until combined with real hotel context
                        />
                        
                        {/* Summary Stats / Mini-Card */}
                        <div className="p-6 rounded-2xl bg-gradient-to-br from-[#F6C344]/5 to-transparent border border-[#F6C344]/10">
                            <h4 className="text-[10px] font-black text-[#F6C344] uppercase tracking-widest mb-4">Market Risk Analysis</h4>
                            <div className="space-y-4">
                                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                                    <span className="text-[10px] text-slate-500 uppercase font-bold">Recommended Action</span>
                                    <span className="text-sm font-black text-white">{metadata?.market_stats?.avg_tga_intensity > 3 ? 'Aggressive ADR' : 'Hold Rates'}</span>
                                </div>
                                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                                    <span className="text-[10px] text-slate-500 uppercase font-bold">System Confidence</span>
                                    <span className="text-sm font-black text-emerald-400">High (92%)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Global Event Calendar - Always Visible */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="pt-4"
            >
                <GlobalEventCalendar />
            </motion.div>
        </div>
    );
}
