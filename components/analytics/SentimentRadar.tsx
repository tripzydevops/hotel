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

interface SentimentRadarProps {
  data: any[];
}

export const SentimentRadar: React.FC<SentimentRadarProps> = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="w-full h-full relative min-h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="#374151" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "#9CA3AF", fontSize: 12, fontWeight: "bold" }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 5]}
            tick={{ fill: "#6B7280", fontSize: 10 }}
            tickCount={6}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1F2937",
              borderColor: "#374151",
              color: "#F3F4F6",
            }}
            itemStyle={{ color: "#E5E7EB" }}
            formatter={(value: number | string | undefined) =>
              typeof value === "number" ? value.toFixed(2) : value
            }
          />
          <Legend
            wrapperStyle={{ paddingTop: "20px" }}
            verticalAlign="bottom"
            height={36}
          />
          <Radar
            name="My Hotel"
            dataKey="A"
            stroke="#3B82F6"
            strokeWidth={3}
            fill="#3B82F6"
            fillOpacity={0.3}
          />
          <Radar
            name="Market Leader"
            dataKey="B"
            stroke="#D4AF37"
            strokeWidth={2}
            fill="#D4AF37"
            fillOpacity={0.1}
          />
          <Radar
            name="Market Avg"
            dataKey="C"
            stroke="#9CA3AF"
            strokeWidth={2}
            fill="#9CA3AF"
            fillOpacity={0.1}
            strokeDasharray="4 4"
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
