"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { Hotel } from "@/types";

interface SentimentBattlefieldProps {
  readonly targetHotel: Hotel;
  readonly competitors: Hotel[];
}

/**
 * SentimentBattlefield Component
 * 
 * Provides an "Instant Structural Truth" view by comparing the 4 core sentiment pillars
 * across the target hotel and its competitors using a grouped bar chart.
 * 
 * KAİZEN: Replaces empty timeline for new users with actionable competitive benchmarking.
 */
export default function SentimentBattlefield({ 
  targetHotel, 
  competitors 
}: SentimentBattlefieldProps) {
  const { t } = useI18n();

  // Categories to compare
  const pillars = ["Cleanliness", "Service", "Location", "Value"];

  // Helper to extract rating for a pillar from a hotel
  const getPillarRating = (hotel: Hotel, pillarName: string): number => {
    const breakdown = hotel.sentiment_breakdown || [];
    
    // The backend now provides standardized pillar names: 
    // "Cleanliness", "Service", "Location", "Value"
    // We look for them directly to avoid matching raw items from other sources.
    const pillarData = breakdown.find(p => p.name === pillarName);

    // Ensure we return a number and handle NaN/undefined
    const rating = pillarData ? Number(pillarData.rating) : 0;
    return isNaN(rating) ? 0 : rating;
  };

  // Transform data for Recharts
  const data = pillars.map(pillar => {
    // KAİZEN: Robust i18n mapping
    // If t() doesn't have the key, it often returns the key itself or path.
    const key = `sentiment.${pillar.toLowerCase()}`;
    const translatedName = t(key);
    
    // Explicitly check for translation failure
    const displayCategory = (!translatedName || translatedName === key || translatedName.includes('sentiment.')) 
      ? pillar 
      : translatedName;

    const entry: any = { 
      category: displayCategory 
    };
    
    // Add target hotel
    entry[targetHotel.name] = getPillarRating(targetHotel, pillar);
    
    // Add competitors
    competitors.forEach(comp => {
      entry[comp.name] = getPillarRating(comp, pillar);
    });
    
    return entry;
  });

  // Color Palette - Restrained & Premium
  const colors = [
    "#3b82f6", // Target Hotel (Blue)
    "#F59E0B", // Comp 1 (Amber)
    "#10B981", // Comp 2 (Emerald)
    "#8B5CF6", // Comp 3 (Violet)
    "#EC4899", // Comp 4 (Pink)
    "#64748B", // Others (Slate)
  ];

  const allHotels = [targetHotel, ...competitors];

  // Dynamically calculate bar size based on number of hotels
  const barSize = allHotels.length > 5 ? 15 : allHotels.length > 3 ? 20 : 30;
  const targetBarSize = barSize + 5;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full h-[400px] bg-white/[0.02] rounded-xl border border-white/5 p-4"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          barGap={2}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="rgba(255,255,255,0.05)" 
            vertical={false} 
          />
          <XAxis 
            dataKey="category" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#94a3b8", fontSize: 13, fontWeight: 500 }}
            dy={10}
          />
          <YAxis 
            domain={[0, 5]} 
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#64748b", fontSize: 12 }}
            ticks={[0, 1, 2, 3, 4, 5]}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
            contentStyle={{
              backgroundColor: "#0F172A",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
              color: "#fff",
            }}
            itemStyle={{ fontSize: "12px", padding: "2px 0" }}
          />
          <Legend 
            verticalAlign="top" 
            align="right" 
            iconType="circle"
            wrapperStyle={{ paddingBottom: "20px", fontSize: "12px", color: "#94a3b8" }}
          />
          
          {allHotels.map((hotel, index) => (
            <Bar
              key={hotel.id}
              dataKey={hotel.name}
              fill={colors[index % colors.length]}
              radius={[4, 4, 0, 0]}
              barSize={index === 0 ? targetBarSize : barSize}
              animationBegin={index * 100}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
