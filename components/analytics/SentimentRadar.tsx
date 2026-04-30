"use client";

import React from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

interface SentimentDataPoint {
  subject: string;
  myHotel: number;
  marketLeader: number;
  marketAvg: number;
  fullMark?: number;
}

interface SentimentRadarProps {
  data: SentimentDataPoint[];
}

export const SentimentRadar: React.FC<SentimentRadarProps> = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="w-full h-full relative min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="var(--glass-border)" opacity={0.4} />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "var(--text-muted-foreground)", fontSize: 11, fontWeight: "600" }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 5]}
            tick={{ fill: "var(--text-muted-foreground)", fontSize: 9 }}
            tickCount={6}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(10, 15, 30, 0.9)",
              backdropFilter: "blur(12px)",
              borderColor: "var(--glass-border)",
              borderRadius: "16px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              border: "1px solid rgba(255,255,255,0.1)",
              padding: "12px",
            }}
            itemStyle={{ fontSize: "12px", padding: "2px 0" }}
            cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
            formatter={(value: any) =>
              typeof value === "number" ? value.toFixed(2) : value
            }
          />
          <Legend
            wrapperStyle={{ paddingTop: "25px" }}
            verticalAlign="bottom"
            height={36}
            iconType="diamond"
            formatter={(value) => (
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {value === "myHotel" ? "My Hotel" : value === "marketLeader" ? "Market Leader" : "Market Average"}
              </span>
            )}
          />
          <Radar
            name="myHotel"
            dataKey="myHotel"
            stroke="var(--soft-gold)"
            strokeWidth={3}
            fill="var(--soft-gold)"
            fillOpacity={0.25}
            animationBegin={300}
            animationDuration={1500}
          />
          <Radar
            name="marketLeader"
            dataKey="marketLeader"
            stroke="var(--optimal-green)"
            strokeWidth={2}
            fill="var(--optimal-green)"
            fillOpacity={0.08}
            animationBegin={500}
            animationDuration={1500}
          />
          <Radar
            name="marketAvg"
            dataKey="marketAvg"
            stroke="var(--text-muted)"
            strokeWidth={1.5}
            fill="var(--text-muted)"
            fillOpacity={0.05}
            strokeDasharray="4 4"
            animationBegin={700}
            animationDuration={1500}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
