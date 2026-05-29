"use client";

import React, { useMemo } from "react";
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    ZAxis,
    Tooltip,
    ResponsiveContainer,
    Cell
} from "recharts";
import { MarketEvent } from "@/hooks/useMarketEvents";

interface IntensityBubbleChartProps {
    events: MarketEvent[];
}

export const IntensityBubbleChart: React.FC<IntensityBubbleChartProps> = ({ events }) => {
    // Build scatter points directly from events
    const points = useMemo(() => {
        if (!events || events.length === 0) return [];

        return events
            .filter(e => (e.intensity_score ?? e.compression_score) && ((e.intensity_score ?? e.compression_score) ?? 0) > 0)
            .map(e => ({
                dateNum: new Date(e.start_date).getTime(),
                score: (e.intensity_score ?? e.compression_score) || 1,
                intensity: e.expected_attendees
                    ? Math.min(Math.max(Math.log10(e.expected_attendees) * 2, 1), 10)
                    : ((e.intensity_score ?? e.compression_score) || 3),
                name: e.name,
                type: e.type,
                city: e.city
            }));
    }, [events]);

    const formatXAxis = (tick: number) => {
        return new Date(tick).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    return (
        <div className="h-full w-full p-5 bg-[var(--deep-ocean-card)] border border-[var(--glass-border)] rounded-xl backdrop-blur-sm relative overflow-hidden flex flex-col">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 uppercase tracking-wider">Market Intensity Signals</h3>
            
            <div className="flex-1 min-h-[200px]">
                {points.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] italic">
                        <p className="text-sm">No significant market signals detected in this period.</p>
                    </div>
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 15, bottom: 15, left: 15 }}>
                        <XAxis
                            type="number"
                            dataKey="dateNum"
                            name="Date"
                            tickFormatter={formatXAxis}
                            domain={['auto', 'auto']}
                            stroke="rgba(255,255,255,0.2)"
                            fontSize={9}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            type="number"
                            dataKey="score"
                            name="Impact Score"
                            stroke="rgba(255,255,255,0.2)"
                            fontSize={9}
                            domain={[0, 10]}
                            tickLine={false}
                            axisLine={false}
                        />
                        <ZAxis type="number" dataKey="intensity" range={[40, 300]} name="Scale" />
                        <Tooltip
                            cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.1)' }}
                            contentStyle={{ 
                                backgroundColor: 'rgba(5, 10, 30, 0.95)', 
                                border: '1px solid rgba(255,255,255,0.1)', 
                                borderRadius: '12px',
                                backdropFilter: 'blur(12px)',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                            }}
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const dp = payload[0].payload;
                                    return (
                                        <div className="p-3 space-y-1.5 max-w-[200px]">
                                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                {new Date(dp.dateNum).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </div>
                                            <div className="text-[11px] font-bold text-white leading-tight truncate">
                                                {dp.name}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px]">
                                                <span className="text-slate-400">{dp.city}</span>
                                                <span className="text-slate-600">•</span>
                                                <span className={dp.type === 'fair' ? 'text-purple-400' : 'text-orange-400'}>
                                                    {dp.type === 'fair' ? 'Trade Fair' : 'Tourism Announcement'}
                                                </span>
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-400">
                                                Impact: <span className="text-white">{dp.score}/10</span>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Scatter name="Market Events" data={points}>
                            {points.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.type === "fair" ? "#A855F7" : "#F97316"}
                                    fillOpacity={0.8}
                                    stroke={entry.type === "fair" ? "#A855F7" : "#F97316"}
                                    strokeWidth={1}
                                    strokeOpacity={0.3}
                                />
                            ))}
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            )}
            </div>
            <div className="flex justify-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#A855F7]" />
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">Fairs (TOBB)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#F97316]" />
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">Announcements (TGA)</span>
                </div>
            </div>
        </div>
    );
};
