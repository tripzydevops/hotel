"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  ReferenceLine,
} from "recharts";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface DailyPrice {
  date: string;
  price: number;
  comp_avg: number;
  vs_comp: number;
  competitors: { name: string; price: number }[];
}

interface RateSpreadChartProps {
  dailyPrices: DailyPrice[];
  targetHotelName: string;
  currency: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  TRY: "₺",
  GBP: "£",
};

export default function RateSpreadChart({
  dailyPrices,
  targetHotelName,
  currency,
}: RateSpreadChartProps) {
  const symbol = CURRENCY_SYMBOLS[currency] || "$";

  // Group by month for navigation
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (dailyPrices.length === 0) return new Date();
    const latestDate = new Date(dailyPrices[dailyPrices.length - 1].date);
    return new Date(latestDate.getFullYear(), latestDate.getMonth(), 1);
  });

  const monthLabel = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Filter data for current month
  const filteredData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    return dailyPrices.filter((d) => {
      // Parse date string (YYYY-MM-DD) safely
      const [dYear, dMonth] = d.date.split("-").map(Number);
      // JS months are 0-indexed, but split gives 1-indexed. Adjust accordingly if needed.
      // Actually standard ISO date YYYY-MM-DD:
      // new Date(d.date) is reliable, but let's be explicit to avoid timezone shifts
      const date = new Date(d.date);
      return date.getFullYear() === year && date.getMonth() === month;
    });
  }, [dailyPrices, currentMonth]);

  // Process data for chart
  const chartData = useMemo(() => {
    return filteredData.map((day) => {
      const prices = day.competitors.map((c) => c.price);
      const allPrices = [...prices, day.price];
      const minPrice = Math.min(...allPrices);
      const maxPrice = Math.max(...allPrices);
      const medianPrice =
        prices.length > 0
          ? prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)]
          : day.comp_avg;

      return {
        date: day.date,
        day: new Date(day.date).getDate(),
        yourPrice: day.price,
        medianPrice: medianPrice,
        minPrice: minPrice,
        maxPrice: maxPrice,
        spreadRange: [minPrice, maxPrice],
        competitors: day.competitors,
        vsComp: day.vs_comp,
      };
    });
  }, [filteredData]);

  const navigateMonth = (direction: number) => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    const dateStr = new Date(data.date).toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Sort competitors by price
    const sortedCompetitors = [...(data.competitors || [])].sort(
      (a, b) => a.price - b.price,
    );

    return (
      <div className="bg-[#0a0a14] border border-white/10 rounded-xl shadow-2xl p-4 min-w-[280px]">
        {/* Date Header */}
        <div className="text-xs text-white/50 mb-3">{dateStr}</div>

        {/* Stats Row */}
        <div className="flex justify-between mb-3 pb-3 border-b border-white/10">
          <div>
            <div className="text-[9px] text-white/40 uppercase">Your Rate</div>
            <div className="text-lg font-black text-[var(--soft-gold)]">
              {symbol}
              {data.yourPrice?.toFixed(0)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-white/40 uppercase">
              Median Comp
            </div>
            <div className="text-lg font-black text-white">
              {symbol}
              {data.medianPrice?.toFixed(0)}
            </div>
          </div>
        </div>

        {/* Competitor Table */}
        <div className="text-[9px] text-white/40 uppercase mb-2">
          Competitors
        </div>
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {/* Your hotel first, highlighted */}
          <div className="flex items-center justify-between py-1.5 px-2 rounded bg-[var(--soft-gold)]/10 border-l-2 border-[var(--soft-gold)]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--soft-gold)]"></span>
              <span className="text-xs text-[var(--soft-gold)] font-bold truncate max-w-[140px]">
                {targetHotelName}
              </span>
            </div>
            <span className="text-sm font-black text-[var(--soft-gold)]">
              {symbol}
              {data.yourPrice?.toFixed(0)}
            </span>
          </div>

          {/* Competitors */}
          {sortedCompetitors.map((comp: any, i: number) => (
            <div
              key={i}
              className="flex items-center justify-between py-1.5 px-2 rounded bg-white/[0.02]"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white/30"></span>
                <span className="text-xs text-white/70 truncate max-w-[140px]">
                  {comp.name}
                </span>
              </div>
              <span className="text-sm font-bold text-white/70">
                {symbol}
                {comp.price?.toFixed(0)}
              </span>
            </div>
          ))}
        </div>

        {/* Position indicator */}
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
          <span className="text-xs text-white/50">vs Market</span>
          <span
            className={`text-sm font-black ${
              data.vsComp < 0
                ? "text-[var(--optimal-green)]"
                : data.vsComp > 5
                  ? "text-[var(--alert-red)]"
                  : "text-[var(--soft-gold)]"
            }`}
          >
            {data.vsComp > 0 ? "+" : ""}
            {data.vsComp?.toFixed(1)}%
          </span>
        </div>
      </div>
    );
  };

  if (chartData.length === 0) {
    return (
      <div className="glass-card p-6">
        {/* Header with navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--soft-gold)]" />
            <span className="text-sm font-black text-white uppercase tracking-wider">
              Rate Spread
            </span>
          </div>

          {/* Month Navigation - always shown */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-white min-w-[120px] text-center">
              {monthLabel}
            </span>
            <button
              onClick={() => navigateMonth(1)}
              className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="text-center py-12 text-white/40">
          No price data available for this period
        </div>
      </div>
    );
  }

  const yDomain = [
    Math.min(...chartData.map((d) => d.minPrice)) * 0.9,
    Math.max(...chartData.map((d) => d.maxPrice)) * 1.1,
  ];

  return (
    <div className="glass-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[var(--soft-gold)]" />
          <span className="text-sm font-black text-white uppercase tracking-wider">
            Rate Spread
          </span>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-white min-w-[120px] text-center">
            {monthLabel}
          </span>
          <button
            onClick={() => navigateMonth(1)}
            className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            {/* Shaded spread zone */}
            <defs>
              <linearGradient id="spreadGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#f97316" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
            />
            <YAxis
              domain={yDomain}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
              tickFormatter={(value) => `${symbol}${value.toFixed(0)}`}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Spread area (min to max) */}
            <Area
              type="monotone"
              dataKey="maxPrice"
              stroke="none"
              fill="url(#spreadGradient)"
            />
            <Area
              type="monotone"
              dataKey="minPrice"
              stroke="none"
              fill="var(--deep-ocean)"
            />

            {/* Median line (dashed) */}
            <Line
              type="monotone"
              dataKey="medianPrice"
              stroke="rgba(34, 197, 94, 0.6)"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 4, fill: "#22c55e" }}
            />

            {/* Your hotel line (prominent) */}
            <Line
              type="monotone"
              dataKey="yourPrice"
              stroke="var(--soft-gold)"
              strokeWidth={3}
              dot={{ r: 4, fill: "var(--soft-gold)", strokeWidth: 0 }}
              activeDot={{
                r: 6,
                fill: "var(--soft-gold)",
                strokeWidth: 2,
                stroke: "#fff",
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <span className="w-3 h-0.5 bg-[var(--soft-gold)]"></span>
          <span className="text-[10px] text-white/50">{targetHotelName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-0.5 bg-[#22c55e] opacity-60"
            style={{ borderStyle: "dashed" }}
          ></span>
          <span className="text-[10px] text-white/50">Median Comp Rate</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-orange-500/20 rounded"></span>
          <span className="text-[10px] text-white/50">Market Spread</span>
        </div>
      </div>
    </div>
  );
}
