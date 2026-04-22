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
  A: number;
  B: number;
  C: number;
  fullMark?: number;
}

interface SentimentRadarProps {
  data: SentimentDataPoint[];
}

export const SentimentRadar: React.FC<SentimentRadarProps> = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="w-full h-full relative min-h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="var(--glass-border)" opacity={0.6} />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "var(--text-muted-foreground)", fontSize: 12, fontWeight: "bold" }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 5]}
            tick={{ fill: "var(--text-muted-foreground)", fontSize: 10 }}
            tickCount={6}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--deep-ocean-card)",
              borderColor: "var(--glass-border)",
              borderRadius: "12px",
              boxShadow: "var(--glass-shadow)",
              color: "var(--text-primary)",
            }}
            itemStyle={{ color: "inherit" }}
            formatter={(value) =>
              typeof value === "number" ? value.toFixed(2) : value
            }
          />
          <Legend
            wrapperStyle={{ paddingTop: "20px", color: "var(--text-muted-foreground)" }}
            verticalAlign="bottom"
            height={36}
          />
          <Radar
            name="My Hotel"
            dataKey="A"
            stroke="var(--soft-gold)"
            strokeWidth={3}
            fill="var(--soft-gold)"
            fillOpacity={0.3}
          />
          <Radar
            name="Market Leader"
            dataKey="B"
            stroke="var(--optimal-green)"
            strokeWidth={2}
            fill="var(--optimal-green)"
            fillOpacity={0.1}
          />
          <Radar
            name="Market Avg"
            dataKey="C"
            stroke="var(--text-muted)"
            strokeWidth={2}
            fill="var(--text-muted)"
            fillOpacity={0.1}
            strokeDasharray="4 4"
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
