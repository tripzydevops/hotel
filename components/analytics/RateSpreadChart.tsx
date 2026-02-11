"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  defs,
  linearGradient,
  stop,
} from "recharts";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
    // Default to current month of the last data point
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
        fullDate: new Date(day.date),
        yourPrice: day.price,
        medianPrice: medianPrice,
        minPrice: minPrice,
        maxPrice: maxPrice,
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

  // Premium Custom Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    const dateStr = data.fullDate.toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

    // Sort competitors by price for the tooltip table
    const sortedCompetitors = [...(data.competitors || [])].sort(
      (a, b) => b.price - a.price, // Highest price first
    );

    return (
      <div className="backdrop-blur-md bg-black/80 border border-white/10 rounded-xl shadow-2xl p-4 min-w-[260px] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
          <span className="text-sm font-medium text-white/90">{dateStr}</span>
          <div
            className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${data.vsComp < 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}
          >
            {data.vsComp < 0 ? (
              <TrendingDown className="w-3 h-3" />
            ) : (
              <TrendingUp className="w-3 h-3" />
            )}
            {Math.abs(data.vsComp).toFixed(1)}% vs Mkt
          </div>
        </div>

        <div className="space-y-3">
          {/* Your Hotel Hero */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--soft-gold)] shadow-[0_0_8px_var(--soft-gold)]"></div>
              <span className="text-xs text-white/70">Your Rate</span>
            </div>
            <span className="text-lg font-black text-[var(--soft-gold)]">
              {symbol}
              {data.yourPrice?.toFixed(0)}
            </span>
          </div>

          {/* Competitor List */}
          <div className="space-y-1 pt-2 border-t border-white/10">
            <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
              Market Snapshot
            </div>
            {sortedCompetitors.slice(0, 5).map((comp: any, i: number) => (
              <div key={i} className="flex justify-between text-xs py-0.5">
                <span className="text-white/60 truncate max-w-[140px]">
                  {comp.name}
                </span>
                <span className="font-medium text-white/80">
                  {symbol}
                  {comp.price?.toFixed(0)}
                </span>
              </div>
            ))}
            {sortedCompetitors.length > 5 && (
              <div className="text-[10px] text-white/30 pt-1">
                +{sortedCompetitors.length - 5} more...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const yDomain =
    chartData.length > 0
      ? [
          Math.min(...chartData.map((d) => d.minPrice)) * 0.85,
          Math.max(...chartData.map((d) => d.maxPrice)) * 1.1,
        ]
      : [0, 100];

  return (
    <div className="glass-card p-6 relative overflow-hidden group">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[var(--soft-gold)]/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--soft-gold)]/10 text-[var(--soft-gold)]">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">
              Rate Spread Analysis
            </h3>
            <p className="text-xs text-white/40">Daily competitive position</p>
          </div>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center bg-white/5 rounded-lg p-1 border border-white/5">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-all active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-white min-w-[100px] text-center select-none">
            {monthLabel}
          </span>
          <button
            onClick={() => navigateMonth(1)}
            className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-all active:scale-95"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[350px] w-full relative z-10">
        {chartData.length === 0 ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-white/30 gap-3">
            <Minus className="w-8 h-8 opacity-50" />
            <span className="text-sm">
              No rate data available for this month
            </span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                {/* Your Price Gradient */}
                <linearGradient id="colorYourPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--soft-gold)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--soft-gold)"
                    stopOpacity={0}
                  />
                </linearGradient>

                {/* Market Spread Gradient (Subtle Background) */}
                <linearGradient id="colorSpread" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#64748b" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#64748b" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="rgba(255,255,255,0.05)"
              />

              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: "rgba(255,255,255,0.3)",
                  fontSize: 11,
                  fontWeight: 500,
                }}
                dy={10}
              />

              <YAxis
                domain={yDomain}
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: "rgba(255,255,255,0.3)",
                  fontSize: 11,
                  fontWeight: 500,
                }}
                tickFormatter={(val) => `${symbol}${val}`}
                width={45}
              />

              <Tooltip
                content={<CustomTooltip />}
                cursor={{
                  stroke: "white",
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                  opacity: 0.3,
                }}
              />

              {/* Market Range (Min/Max) Area */}
              {/* We stack two areas to simulate a range: one transparent up to min, then colored to max? 
                Actually recharts Area isn't great for range. Better to use ComposedChart with Area only for 'Your Price'.
                Let's stick to the previous 'Area' trick effectively or use a 'Range' if we had it.
                Standard workaround: Stacked area? No.
                Let's use a specialized Area for the 'Spread' if possible. 
                Actually, simpler: Just show Median + Your Price as areas/lines. Min/Max as a light band.
            */}

              {/* The "Spread" - we use two areas to create a floating band effect (visual trick) */}
              {/* Actually simpler: Just render Min/Max as a subtle area? 
                Let's render a single Area for the "Market Spread" using a custom shape or just the 'Max' with a gradient and 'Min' as another to mask? 
                Easier: Just use Area for 'Max' with a very light fill, and Area for 'Min' with the BACKGROUND color fill to cut it out.
                But we have a gradient background.
                Correct approach for 'Spread' in Recharts: use two areas, one for max, one for min (hidden/white?).
                Standard approach: Just show Median and Your Price. The 'Spread' can be noisy. 
                Let's show: 
                1. Your Price (Area + Line) - Hero
                2. Median Price (Line) - Context
                3. Market Max (Line - subtle) 
                
                User wanted 'Premium'. Clear signals are premium.
            */}

              <Area
                type="monotone"
                dataKey="yourPrice"
                stroke="var(--soft-gold)"
                strokeWidth={3}
                fill="url(#colorYourPrice)"
                animationDuration={1500}
              />

              <Area
                type="monotone"
                dataKey="medianPrice"
                stroke="#64748b"
                strokeWidth={2}
                strokeDasharray="4 4"
                fill="none" // No fill for median, just line
                fillOpacity={0}
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Custom Legend */}
      <div className="flex items-center justify-center gap-6 mt-2">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--soft-gold)]/5 border border-[var(--soft-gold)]/20">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--soft-gold)]"></div>
          <span className="text-xs font-bold text-[var(--soft-gold)]">
            Your Rate
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
          <div className="w-4 h-0.5 border-t-2 border-dashed border-slate-400"></div>
          <span className="text-xs text-white/50">Market Median</span>
        </div>
      </div>
    </div>
  );
}
