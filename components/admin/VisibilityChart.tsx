"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";

interface DataPoint {
  date: string;
  rank: number | null;
  price: number;
}

interface VisibilityChartProps {
  data: DataPoint[];
  color?: string;
}

export default function VisibilityChart({
  data,
  color = "#3b82f6",
}: VisibilityChartProps) {
  // Process data to handle null ranks (maybe treat as > 20 or gap)
  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      // KAİZEN: Defensive date parsing and rank normalization
      rank: typeof d.rank === 'number' ? d.rank : null,
      formattedDate: d.date ? format(new Date(d.date), "MMM d") : "N/A",
    }));
  }, [data]);

  return (
  return (
    <div className="relative h-[300px] min-h-[300px] w-full bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm overflow-hidden">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/80">
          Search Visibility (Rank)
        </h3>
        <div className="text-xs text-white/50">Lower # is better</div>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.1)"
            vertical={false}
          />
          <XAxis
            dataKey="formattedDate"
            stroke="rgba(255,255,255,0.4)"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="rgba(255,255,255,0.4)"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            reversed={true} // Rank 1 is top
            domain={[1, (dataMax: number) => Math.max(dataMax + 5, 20)]} // Ensure predictable range
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e293b",
              borderColor: "rgba(255,255,255,0.1)",
              borderRadius: "8px",
              color: "#fff",
            }}
            itemStyle={{ color: "#fff" }}
            labelStyle={{ color: "rgba(255,255,255,0.5)" }}
            formatter={(value: any) => [`#${value}`, "Rank"]}
          />
          <ReferenceLine y={1} stroke="#10b981" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="rank"
            stroke={color}
            strokeWidth={3}
            dot={{ r: 4, fill: "#1e293b", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: color }}
            connectNulls={true} // Connect points even if some scans were rankless (optional)
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
