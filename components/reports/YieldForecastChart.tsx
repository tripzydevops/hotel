"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from "recharts";

const data = [
  { name: "Week 1", actual: 4000, forecast: 4000, confidence: [3800, 4200] },
  { name: "Week 2", actual: 3000, forecast: 3000, confidence: [2800, 3200] },
  { name: "Week 3", actual: 2000, forecast: 2000, confidence: [1800, 2200] },
  { name: "Week 4", actual: 2780, forecast: 2780, confidence: [2500, 3000] },
  { name: "Week 5", actual: 1890, forecast: 1890, confidence: [1600, 2100] },
  { name: "Week 6", actual: 2390, forecast: 2390, confidence: [2100, 2600] },
  { name: "Week 7", forecast: 3490, confidence: [3000, 4000] }, // Future
  { name: "Week 8", forecast: 4000, confidence: [3500, 4500] }, // Future
];

export default function YieldForecastChart() {
  return (
    <div className="glass-panel-premium p-6 rounded-2xl h-[400px] w-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-white">
            Yield Forecast (30 Day)
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            AI Confidence Interval:{" "}
            <span className="text-optimal-green">94%</span>
          </p>
        </div>
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-1 bg-[var(--soft-gold)] rounded-full"></span>
            <span className="text-[var(--text-secondary)]">Actual Revenue</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-1 bg-purple-500 border border-purple-400 border-dashed rounded-full"></span>
            <span className="text-[var(--text-secondary)]">AI Projection</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height="85%">
        <ComposedChart data={data}>
          <defs>
            <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--soft-gold)"
                stopOpacity={0.3}
              />
              <stop offset="95%" stopColor="var(--soft-gold)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            stroke="var(--text-muted)"
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            stroke="var(--text-muted)"
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f172a",
              borderColor: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
            }}
            itemStyle={{ color: "#fff", fontSize: "12px" }}
            cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 2 }}
          />

          <Area
            type="monotone"
            dataKey="actual"
            stroke="var(--soft-gold)"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorActual)"
          />

          <Line
            type="monotone"
            dataKey="forecast"
            stroke="#a855f7"
            strokeWidth={3}
            strokeDasharray="5 5"
            dot={{ r: 4, fill: "#a855f7", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
