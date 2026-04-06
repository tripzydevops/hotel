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
  AreaChart,
} from "recharts";
import { useI18n } from "@/lib/i18n";
import { PricePoint } from "@/types";

interface PriceTrendChartProps {
  history: PricePoint[];
  currency: string;
}

export default function PriceTrendChart({
  history,
  currency,
}: PriceTrendChartProps) {
  const { t, locale } = useI18n();

  // 1. Group data by local date string
  const groupedData = history.reduce((acc, p) => {
    const d = new Date(p.recorded_at);
    const dateKey = d.toLocaleDateString(locale === "en" ? "en-US" : "tr-TR", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(p);
    return acc;
  }, {} as Record<string, PricePoint[]>);

  // 2. Transform into chart points (one per day)
  const data = Object.entries(groupedData)
    .map(([dateKey, points]) => {
      // Sort points in this day by recorded_at (latest first)
      const sortedPoints = [...points].sort(
        (a, b) =>
          new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
      );

      const latest = sortedPoints[0];
      const prices = points.map((p) => p.price);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

      return {
        date: dateKey.replace(/, \d{4}/, ""), // Remove year for cleaner X-axis
        fullDate: dateKey,
        price: latest.price,
        min,
        max,
        avg,
        count: points.length,
        latestCheckIn: latest.check_in_date,
      };
    })
    .sort(
      (a, b) =>
        new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime(),
    );

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[var(--deep-ocean-card)] border border-[var(--glass-border)] p-4 rounded-xl shadow-2xl backdrop-blur-xl min-w-[200px]">
          <p className="text-[var(--text-muted)] text-xs font-medium mb-3 border-b border-[var(--glass-border)] pb-2 flex justify-between">
            <span>{data.fullDate}</span>
            <span className="bg-[var(--deep-ocean-accent)]/20 px-2 rounded-full">
              {data.count} {data.count === 1 ? t("common.scan") || "scan" : t("common.scans") || "scans"}
            </span>
          </p>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)] text-xs">{t("common.latest") || "Latest"}</span>
              <span className="text-[#D4AF37] font-bold text-lg">{formatPrice(data.price)}</span>
            </div>
            
            {data.count > 1 && (
              <div className="pt-2 mt-2 border-t border-[var(--glass-border)]/50 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">{t("common.high") || "Daily High"}</span>
                  <span className="text-red-400 font-medium">{formatPrice(data.max)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">{t("common.low") || "Daily Low"}</span>
                  <span className="text-green-400 font-medium">{formatPrice(data.min)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">{t("common.average") || "Average"}</span>
                  <span className="text-[var(--text-primary)] font-medium">{formatPrice(data.avg)}</span>
                </div>
              </div>
            )}
            
            {data.latestCheckIn && (
              <div className="mt-2 pt-2 border-t border-[var(--glass-border)]/30">
                <p className="text-[10px] text-[var(--text-muted)] italic">
                  {t("hotelDetails.checkIn") || "Stay Date"}: {data.latestCheckIn}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center text-[var(--text-muted)] italic text-sm border border-[var(--glass-border)] bg-[var(--deep-ocean-accent)]/5 rounded-xl">
        {t("reports.noHistoryData")}
      </div>
    );
  }

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--glass-border)"
            strokeOpacity={0.5}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            stroke="currentColor"
            className="text-[var(--text-muted)]"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            minTickGap={20}
          />
          <YAxis
            stroke="currentColor"
            className="text-[var(--text-muted)]"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) =>
              new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: currency,
                notation: "compact",
                compactDisplay: "short",
              }).format(value)
            }
            domain={["auto", "auto"]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="price"
            stroke="#D4AF37"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorPrice)"
            animationDuration={1000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
