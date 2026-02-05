"use client";

import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface DailyPrice {
  date: string;
  price: number;
  comp_avg: number;
  vs_comp: number;
  competitors: { name: string; price: number }[];
}

interface CalendarHeatmapProps {
  dailyPrices: DailyPrice[];
  targetHotelName: string;
  currency: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  TRY: "₺",
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarHeatmap({
  dailyPrices,
  targetHotelName,
  currency,
}: CalendarHeatmapProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const symbol = CURRENCY_SYMBOLS[currency] || "$";

  // Create a map for quick lookup
  const priceMap = useMemo(() => {
    const map: Record<string, DailyPrice> = {};
    dailyPrices.forEach((dp) => {
      map[dp.date] = dp;
    });
    return map;
  }, [dailyPrices]);

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Adjust for Monday start (getDay() returns 0 for Sunday)
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6;

    const days: {
      date: string;
      day: number | null;
      isCurrentMonth: boolean;
    }[] = [];

    // Add empty cells for days before the first
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ date: "", day: null, isCurrentMonth: false });
    }

    // Add days of the month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({ date: dateStr, day: d, isCurrentMonth: true });
    }

    return days;
  }, [currentMonth]);

  const goToPrevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1),
    );
  };

  const goToNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
    );
  };

  const getColorClass = (vsComp: number): string => {
    if (vsComp <= -10) return "bg-green-500/80";
    if (vsComp <= -5) return "bg-green-400/60";
    if (vsComp < 5) return "bg-yellow-400/50";
    if (vsComp < 10) return "bg-orange-400/60";
    return "bg-red-500/70";
  };

  const hoveredData = hoveredDate ? priceMap[hoveredDate] : null;

  const monthName = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="glass-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[var(--soft-gold)]" />
          <h3 className="text-sm font-black text-white uppercase tracking-widest">
            Rate Calendar
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={goToPrevMonth}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-white/70" />
          </button>
          <span className="text-sm font-bold text-white min-w-[140px] text-center">
            {monthName}
          </span>
          <button
            onClick={goToNextMonth}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-white/70" />
          </button>
        </div>
      </div>

      <div className="relative">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAYS.map((day) => (
            <div
              key={day}
              className="text-center text-[10px] font-bold text-[var(--text-muted)] uppercase py-1"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((cell, idx) => {
            if (!cell.isCurrentMonth || cell.day === null) {
              return (
                <div key={idx} className="h-16 rounded-lg bg-white/[0.02]" />
              );
            }

            const data = priceMap[cell.date];
            const hasData = !!data;

            return (
              <div
                key={idx}
                className={`relative h-16 rounded-lg p-2 transition-all cursor-pointer border border-transparent ${
                  hasData
                    ? `${getColorClass(data.vs_comp)} hover:border-white/30`
                    : "bg-white/[0.03] hover:bg-white/[0.05]"
                }`}
                onMouseEnter={() => hasData && setHoveredDate(cell.date)}
                onMouseLeave={() => setHoveredDate(null)}
              >
                <div className="text-[10px] font-bold text-white/50">
                  {cell.day}
                </div>
                {hasData && (
                  <>
                    <div className="text-sm font-black text-white">
                      {symbol}
                      {data.price}
                    </div>
                    <div
                      className={`text-[9px] font-bold ${
                        data.vs_comp > 0 ? "text-white/90" : "text-white/90"
                      }`}
                    >
                      {data.vs_comp > 0 ? "+" : ""}
                      {data.vs_comp.toFixed(0)}% vs Comp
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Hover Popup */}
        {hoveredData && (
          <div className="absolute top-0 right-0 z-50 w-72 bg-[#0a0a14] border border-white/10 rounded-xl shadow-2xl p-4">
            <div className="text-xs font-bold text-[var(--text-muted)] mb-2">
              {new Date(hoveredData.date).toLocaleDateString("en-US", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10">
              <div className="text-center">
                <div className="text-2xl font-black text-white">
                  {symbol}
                  {hoveredData.price}
                </div>
                <div className="text-[9px] text-[var(--text-muted)] uppercase">
                  Your Rate
                </div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-[var(--text-muted)]">
                  {symbol}
                  {hoveredData.comp_avg.toFixed(0)}
                </div>
                <div className="text-[9px] text-[var(--text-muted)] uppercase">
                  Comp Avg
                </div>
              </div>
              <div
                className={`text-center px-3 py-1 rounded-lg ${
                  hoveredData.vs_comp > 0
                    ? "bg-red-500/20 text-red-400"
                    : "bg-green-500/20 text-green-400"
                }`}
              >
                <div className="text-sm font-black">
                  {hoveredData.vs_comp > 0 ? "+" : ""}
                  {hoveredData.vs_comp.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Competitor list */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[9px] font-bold text-[var(--text-muted)] uppercase">
                <span>Property</span>
                <span>Rate</span>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2 rounded bg-[var(--soft-gold)]/10 border-l-2 border-[var(--soft-gold)]">
                <span className="text-xs font-bold text-[var(--soft-gold)]">
                  {targetHotelName}
                </span>
                <span className="text-xs font-black text-[var(--soft-gold)]">
                  {symbol}
                  {hoveredData.price}
                </span>
              </div>
              {hoveredData.competitors.slice(0, 5).map((comp, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-1.5 px-2 rounded bg-white/[0.02]"
                >
                  <span className="text-xs text-white/70 truncate max-w-[180px]">
                    {comp.name}
                  </span>
                  <span className="text-xs font-bold text-white/70">
                    {symbol}
                    {comp.price.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-500/80" />
          <span className="text-[9px] text-[var(--text-muted)]">
            Below Comp
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-yellow-400/50" />
          <span className="text-[9px] text-[var(--text-muted)]">Near Comp</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-500/70" />
          <span className="text-[9px] text-[var(--text-muted)]">
            Above Comp
          </span>
        </div>
      </div>
    </div>
  );
}
