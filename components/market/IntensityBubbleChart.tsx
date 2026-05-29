"use client";

import React, { useMemo } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell,
    CartesianGrid,
    ReferenceLine
} from "recharts";
import { MarketEvent } from "@/hooks/useMarketEvents";
import { Info, TrendingUp } from "lucide-react";

interface IntensityBubbleChartProps {
    events: MarketEvent[];
}

// Group events by week and compute aggregated intensity per type
function groupEventsByWeek(events: MarketEvent[]) {
    const weekMap = new Map<string, {
        weekLabel: string;
        weekStart: Date;
        fairCount: number;
        announcementCount: number;
        fairIntensity: number;
        announcementIntensity: number;
        totalIntensity: number;
        events: { name: string; type: string; score: number; date: string }[];
    }>();

    for (const e of events) {
        const d = new Date(e.start_date);
        // Get the Monday of the week
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setDate(diff);
        monday.setHours(0, 0, 0, 0);

        const weekKey = monday.toISOString().split("T")[0];
        const weekLabel = monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

        if (!weekMap.has(weekKey)) {
            weekMap.set(weekKey, {
                weekLabel,
                weekStart: monday,
                fairCount: 0,
                announcementCount: 0,
                fairIntensity: 0,
                announcementIntensity: 0,
                totalIntensity: 0,
                events: [],
            });
        }

        const week = weekMap.get(weekKey)!;
        const score = (e.intensity_score ?? e.compression_score) || 1;
        const type = e.type?.toLowerCase() || "other";

        if (type === "fair") {
            week.fairCount++;
            week.fairIntensity += score;
        } else {
            week.announcementCount++;
            week.announcementIntensity += score;
        }
        week.totalIntensity += score;
        week.events.push({
            name: e.name,
            type,
            score,
            date: new Date(e.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        });
    }

    return Array.from(weekMap.values())
        .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
}

export const IntensityBubbleChart: React.FC<IntensityBubbleChartProps> = ({ events }) => {
    const weeklyData = useMemo(() => {
        if (!events || events.length === 0) return [];
        const filtered = events.filter(
            e => (e.intensity_score ?? e.compression_score ?? 0) > 0
        );
        return groupEventsByWeek(filtered);
    }, [events]);

    // Calculate summary stats
    const stats = useMemo(() => {
        if (weeklyData.length === 0) return null;

        const totalEvents = weeklyData.reduce((sum, w) => sum + w.fairCount + w.announcementCount, 0);
        const totalFairs = weeklyData.reduce((sum, w) => sum + w.fairCount, 0);
        const totalAnnouncements = weeklyData.reduce((sum, w) => sum + w.announcementCount, 0);
        const peakWeek = weeklyData.reduce((max, w) => w.totalIntensity > max.totalIntensity ? w : max, weeklyData[0]);
        const avgIntensity = weeklyData.length > 0
            ? Math.round((weeklyData.reduce((s, w) => s + w.totalIntensity, 0) / weeklyData.length) * 10) / 10
            : 0;

        return { totalEvents, totalFairs, totalAnnouncements, peakWeek, avgIntensity };
    }, [weeklyData]);

    return (
        <div className="w-full p-5 bg-[var(--deep-ocean-card)] border border-[var(--glass-border)] rounded-xl backdrop-blur-sm relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#A855F7]" />
                    Market Intensity Signals
                </h3>
                <div className="group relative">
                    <div className="p-1 rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-help">
                        <Info className="w-4 h-4 text-[var(--text-muted)]" />
                    </div>
                    <div className="absolute right-0 top-8 z-50 hidden group-hover:block w-64 p-3 rounded-xl bg-[#050A1E]/95 border border-white/10 backdrop-blur-xl shadow-2xl text-[10px] space-y-1.5">
                        <p className="font-bold text-white border-b border-white/10 pb-1 mb-1">How to Read This Chart</p>
                        <p className="text-slate-300">Each bar shows weekly event intensity. Taller bars = higher demand compression risk.</p>
                        <p className="text-[#A855F7] font-medium">■ Purple: Trade Fairs (TOBB)</p>
                        <p className="text-[#F97316] font-medium">■ Orange: Tourism Announcements (TGA)</p>
                        <p className="text-slate-400 italic pt-1 border-t border-white/5">Weeks above the dashed line indicate elevated risk.</p>
                    </div>
                </div>
            </div>

            {/* Summary Stats Row */}
            {stats && (
                <div className="flex items-center gap-4 mb-4 text-[10px]">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/[0.06]">
                        <span className="text-slate-500 uppercase font-bold tracking-wider">Events</span>
                        <span className="text-white font-black">{stats.totalEvents}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#A855F7]/5 border border-[#A855F7]/10">
                        <span className="text-[#A855F7] font-bold">{stats.totalFairs} Fairs</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#F97316]/5 border border-[#F97316]/10">
                        <span className="text-[#F97316] font-bold">{stats.totalAnnouncements} Announcements</span>
                    </div>
                    <div className="flex items-center gap-1.5 ml-auto">
                        <span className="text-slate-500 uppercase font-bold tracking-wider">Avg/Wk</span>
                        <span className="text-white font-black">{stats.avgIntensity}</span>
                    </div>
                </div>
            )}

            {/* Chart */}
            <div className="h-[240px]">
                {weeklyData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] italic">
                        <p className="text-sm">No significant market signals detected in this period.</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }} barGap={2}>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="rgba(255,255,255,0.03)"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="weekLabel"
                                stroke="rgba(255,255,255,0.2)"
                                fontSize={9}
                                tickLine={false}
                                axisLine={false}
                                interval={0}
                                angle={-35}
                                textAnchor="end"
                                height={40}
                            />
                            <YAxis
                                stroke="rgba(255,255,255,0.15)"
                                fontSize={9}
                                tickLine={false}
                                axisLine={false}
                                width={28}
                                label={{
                                    value: 'Intensity',
                                    angle: -90,
                                    position: 'insideLeft',
                                    style: { fontSize: 8, fill: 'rgba(255,255,255,0.3)', textAnchor: 'middle' }
                                }}
                            />
                            <ReferenceLine
                                y={stats?.avgIntensity ?? 5}
                                stroke="rgba(255,255,255,0.15)"
                                strokeDasharray="4 4"
                                label={{
                                    value: "avg",
                                    position: "right",
                                    style: { fontSize: 8, fill: 'rgba(255,255,255,0.3)' }
                                }}
                            />
                            <Tooltip
                                cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                                contentStyle={{
                                    backgroundColor: 'rgba(5, 10, 30, 0.95)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                    backdropFilter: 'blur(12px)',
                                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                                }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const week = payload[0].payload;
                                        return (
                                            <div className="p-3 space-y-2 max-w-[260px]">
                                                <div className="text-[10px] font-black text-white uppercase tracking-widest border-b border-white/10 pb-1">
                                                    Week of {week.weekLabel}
                                                </div>
                                                <div className="flex gap-4 text-[10px]">
                                                    <div>
                                                        <span className="text-slate-400 block">Fairs</span>
                                                        <span className="text-[#A855F7] font-black">{week.fairCount} ({week.fairIntensity} pts)</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 block">Announcements</span>
                                                        <span className="text-[#F97316] font-black">{week.announcementCount} ({week.announcementIntensity} pts)</span>
                                                    </div>
                                                </div>
                                                {week.events.length > 0 && (
                                                    <div className="border-t border-white/5 pt-1.5 space-y-1">
                                                        {week.events.slice(0, 4).map((evt: any, i: number) => (
                                                            <div key={i} className="flex items-center gap-1.5 text-[9px]">
                                                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${evt.type === 'fair' ? 'bg-[#A855F7]' : 'bg-[#F97316]'}`} />
                                                                <span className="text-slate-300 truncate">{evt.name}</span>
                                                                <span className="text-slate-600 ml-auto flex-shrink-0">{evt.score}/10</span>
                                                            </div>
                                                        ))}
                                                        {week.events.length > 4 && (
                                                            <div className="text-[8px] text-slate-600 italic">
                                                                +{week.events.length - 4} more events
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar
                                dataKey="fairIntensity"
                                stackId="intensity"
                                fill="#A855F7"
                                radius={[0, 0, 0, 0]}
                                fillOpacity={0.85}
                            />
                            <Bar
                                dataKey="announcementIntensity"
                                stackId="intensity"
                                fill="#F97316"
                                radius={[4, 4, 0, 0]}
                                fillOpacity={0.85}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-6 mt-3 pt-3 border-t border-white/[0.03]">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-2 rounded-sm bg-[#A855F7]" />
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">Fairs (TOBB)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-2 rounded-sm bg-[#F97316]" />
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">Announcements (TGA)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-0 border-t border-dashed border-white/20" />
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">Avg Line</span>
                </div>
            </div>
        </div>
    );
};
