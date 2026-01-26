"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { useI18n } from "@/lib/i18n";

interface MarketPositionChartProps {
  data: {
    min: number;
    avg: number;
    max: number;
    myPrice: number | null;
  };
  currency: string;
}

export default function MarketPositionChart({
  data,
  currency,
}: MarketPositionChartProps) {
  const { t } = useI18n();

  const chartData = [
    { name: t("reports.marketMin"), price: data.min, color: "#10B981" }, // Green
    {
      name: t("reports.myHotel"),
      price: data.myPrice || 0,
      color: "#D4AF37", // Gold
      isTarget: true,
    },
    { name: t("reports.marketAvg"), price: data.avg, color: "#94A3B8" }, // Gray
    { name: t("reports.marketMax"), price: data.max, color: "#EF4444" }, // Red
  ];

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.1)"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            stroke="#94A3B8"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#94A3B8"
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
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.05)" }}
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
          />
          <Bar dataKey="price" radius={[4, 4, 0, 0]} barSize={60}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                stroke={entry.isTarget ? "#D4AF37" : "none"}
                strokeWidth={entry.isTarget ? 0 : 0}
                className="hover:opacity-80 transition-opacity"
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
