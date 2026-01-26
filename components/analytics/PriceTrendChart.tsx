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

  const data = [...history]
    .sort(
      (a, b) =>
        new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    )
    .map((p) => ({
      date: new Date(p.recorded_at).toLocaleDateString(
        locale === "en" ? "en-US" : "tr-TR",
        { month: "short", day: "numeric" },
      ),
      fullDate: new Date(p.recorded_at).toLocaleString(),
      price: p.price,
    }));

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (data.length === 0) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center text-[var(--text-muted)] italic text-sm border border-white/5 bg-white/[0.02] rounded-xl">
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
            stroke="rgba(255,255,255,0.05)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            stroke="#64748B"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            minTickGap={30}
          />
          <YAxis
            stroke="#64748B"
            fontSize={12}
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
          <Tooltip
            cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
            contentStyle={{
              backgroundColor: "#0F172A", // var(--deep-ocean)
              borderColor: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
              color: "#fff",
            }}
            formatter={(value: number) => [
              formatPrice(value),
              t("hotelDetails.price"),
            ]}
            labelFormatter={(label) => label}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="#D4AF37"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorPrice)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
