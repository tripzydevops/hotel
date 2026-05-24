"use client";

import React, { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";

interface HistoryRecord {
  date: string;
  rating?: number;
  breakdown: Array<{
    name: string;
    positive?: number;
    negative?: number;
    neutral?: number;
    total_mentioned?: number;
    rating?: number;
  }>;
}

interface KeywordTrendsChartProps {
  readonly history: HistoryRecord[];
}

export default function KeywordTrendsChart({ history }: KeywordTrendsChartProps) {
  const { t, locale } = useI18n();

  const chartData = useMemo(() => {
    if (!history || history.length === 0) return [];
    
    // Sort history chronologically (ascending date)
    const sorted = [...history].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateA - dateB;
    });

    return sorted.map((record) => {
      const point: any = {
        date: new Date(record.date).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", {
          month: "short",
          day: "numeric",
        }),
        Cleanliness: 0,
        Service: 0,
        Location: 0,
        Value: 0,
      };

      if (Array.isArray(record.breakdown)) {
        record.breakdown.forEach((item) => {
          const name = item.name;
          if (
            name === "Cleanliness" ||
            name === "Service" ||
            name === "Location" ||
            name === "Value"
          ) {
            point[name] = Number(item.negative) || 0;
          }
        });
      }

      return point;
    });
  }, [history, locale]);

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 py-16 rounded-xl bg-[var(--deep-ocean-card)] border border-[var(--glass-border)] text-center">
        <p className="text-sm font-bold text-slate-400 mb-2">
          {locale === "tr" ? "Yetersiz Geçmiş Verisi" : "Insufficient Historical Data"}
        </p>
        <p className="text-xs text-[var(--text-muted-foreground)] max-w-sm">
          {locale === "tr"
            ? "Zaman içindeki olumsuz anahtar kelime eğilimlerini grafiklendirmek için daha fazla tarama geçmişi gerekmektedir."
            : "More scan history is required to graph negative keyword trends over time."}
        </p>
      </div>
    );
  }

  // Restrained premium color palette matching standard layout theme
  const categories = [
    { key: "Cleanliness", color: "#f43f5e", fill: "rgba(244, 63, 94, 0.15)" }, // Rose/Red
    { key: "Service", color: "#6366f1", fill: "rgba(99, 102, 241, 0.15)" },     // Indigo/Blue
    { key: "Location", color: "#f59e0b", fill: "rgba(245, 158, 11, 0.15)" },    // Amber/Orange
    { key: "Value", color: "#8b5cf6", fill: "rgba(139, 92, 246, 0.15)" },       // Violet/Purple
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full h-[400px] bg-[var(--deep-ocean-card)] rounded-xl border border-[var(--glass-border)] p-4 shadow-sm"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
        >
          <defs>
            {categories.map((cat) => (
              <linearGradient key={cat.key} id={`grad-${cat.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={cat.color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={cat.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--glass-border)"
            opacity={0.3}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--text-muted-foreground)", fontSize: 11, fontWeight: 600 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--text-muted-foreground)", fontSize: 11 }}
            label={{
              value: locale === "tr" ? "Şikayet Sayısı (Olumsuz Mentions)" : "Complaints (Negative Mentions)",
              angle: -90,
              position: "insideLeft",
              style: { fill: "var(--text-muted-foreground)", fontSize: 11, fontWeight: 600 },
              offset: 0,
              dy: 40,
            }}
          />
          <Tooltip
            cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
            contentStyle={{
              backgroundColor: "var(--deep-ocean-card)",
              border: "1px solid var(--glass-border)",
              borderRadius: "12px",
              boxShadow: "var(--glass-shadow)",
              color: "var(--text-primary)",
            }}
            itemStyle={{ fontSize: "12px", padding: "2px 0", color: "inherit" }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{ paddingBottom: "20px", fontSize: "12px", color: "var(--text-muted-foreground)" }}
            formatter={(value) => {
              const key = `sentiment.${value.toLowerCase()}`;
              const translated = t(key);
              return (
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {!translated || translated === key || translated.includes("sentiment.") ? value : translated}
                </span>
              );
            }}
          />
          {categories.map((cat) => (
            <Area
              key={cat.key}
              type="monotone"
              dataKey={cat.key}
              stackId="1"
              stroke={cat.color}
              strokeWidth={2}
              fill={`url(#grad-${cat.key})`}
              animationDuration={1500}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
