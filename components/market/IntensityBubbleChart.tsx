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
        <div className="h-[300px] w-full p-6 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-white mb-6">Market Intensity Signals</h3>
            <ResponsiveContainer width="100%" height="80%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <XAxis
                        type="number"
                        dataKey="dateNum"
                        name="Date"
                        tickFormatter={formatXAxis}
                        domain={['auto', 'auto']}
                        stroke="#475569"
                        fontSize={10}
                    />
                    <YAxis
                        type="number"
                        dataKey="score"
                        name="Market Score"
                        stroke="#475569"
                        fontSize={10}
                        domain={[0, 10]}
                    />
                    <ZAxis type="number" dataKey="intensity" range={[50, 400]} name="Intensity" />
                    <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff', borderRadius: '8px' }}
                        itemStyle={{ color: '#94a3b8' }}
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
                                fill={entry.type === "fair" ? "#3b82f6" : "#f59e0b"}
                                fillOpacity={0.6}
                            />
                        ))}
                    </Scatter>
                </ScatterChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500/60" />
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Fairs (TOBB)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Announcements (TGA)</span>
                </div>
            </div>
        </div>
    );
};
