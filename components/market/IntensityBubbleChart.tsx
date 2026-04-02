"use client";

import React from "react";
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
import { ForecastDay } from "@/hooks/useMarketForecast";

interface IntensityBubbleChartProps {
    data: ForecastDay[];
}

export const IntensityBubbleChart: React.FC<IntensityBubbleChartProps> = ({ data }) => {
    // Flatten events into scatter points
    const points = data.flatMap(day =>
        day.signals.map(s => ({
            date: day.date,
            dateNum: new Date(day.date).getTime(),
            score: day.compression_score,
            intensity: s.score,
            name: s.name,
            type: s.type
        }))
    );

    const formatXAxis = (tick: number) => {
        return new Date(tick).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    return (
        <div className="h-full w-full p-6 bg-[var(--deep-ocean-card)] border border-[var(--glass-border)] rounded-xl backdrop-blur-sm relative overflow-hidden flex flex-col">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-6">Market Intensity Signals</h3>
            
            <div className="flex-1 min-h-[220px]">
                {points.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] italic">
                        <p className="text-sm">No significant market signals detected in this period.</p>
                    </div>
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <XAxis
                            type="number"
                            dataKey="dateNum"
                            name="Date"
                            tickFormatter={formatXAxis}
                            domain={['auto', 'auto']}
                            stroke="currentColor"
                            className="text-[var(--text-muted)]"
                            fontSize={10}
                        />
                        <YAxis
                            type="number"
                            dataKey="score"
                            name="Market Score"
                            stroke="currentColor"
                            className="text-[var(--text-muted)]"
                            fontSize={10}
                            domain={[0, 10]}
                        />
                        <ZAxis type="number" dataKey="intensity" range={[50, 400]} name="Intensity" />
                        <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            contentStyle={{ 
                                backgroundColor: 'var(--deep-ocean-card)', 
                                borderColor: 'var(--glass-border)', 
                                color: 'var(--text-primary)', 
                                borderRadius: '8px' 
                            }}
                            itemStyle={{ color: 'var(--text-secondary)' }}
                            formatter={(value: any, name: any) => {
                                if (name === "Date" || name === "dateNum") {
                                    return [new Date(value).toLocaleDateString(), "Date"];
                                }
                                return [value, name];
                            }}
                        />
                        <Scatter name="Market Events" data={points}>
                            {points.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.type === "fair" ? "#A855F7" : "#F97316"}
                                    fillOpacity={0.85}
                                    stroke="var(--deep-ocean-card)"
                                    strokeWidth={0.5}
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
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Fairs (TOBB)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#F97316]" />
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Announcements (TGA)</span>
                </div>
            </div>
        </div>
    );
};
