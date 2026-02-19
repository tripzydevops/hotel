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
  readonly sentimentHistory?: Record<string, any[]>;
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
  competitors,
  sentimentHistory = {}
}: SentimentBattlefieldProps) {
  const { t } = useI18n();

  // Categories to compare
  const pillars = ["Cleanliness", "Service", "Location", "Value"];

  // Helper to extract rating for a pillar from a hotel
  const getPillarRating = (hotel: Hotel, pillarName: string): number => {
    const breakdown = hotel.sentiment_breakdown || [];
    
    // Normalize pillar name
    const target = pillarName.toLowerCase();
    
    const aliases: Record<string, string[]> = {
      cleanliness: ["temizlik", "clean", "room", "cleanliness", "odalar", "oda"],
      service: ["hizmet", "staff", "personel", "service"],
      location: ["konum", "neighborhood", "mevki", "location"],
      value: ["değer", "fiyat", "price", "comfort", "kalite", "value", "cost", "money"],
    };

    // Find the item in the breakdown that matches the target category or one of its aliases
    const pillarData = breakdown.find(p => {
      const name = (p.name || p.category || "").toLowerCase().trim();
      if (name === target) return true;
      return aliases[target]?.some(alias => name.includes(alias));
    });

    if (!pillarData) {
        // KAİZEN: 1st Fallback - Check History for "Last Known Good"
        const history = sentimentHistory[hotel.id];
        if (history && history.length > 0) {
            const sortedHistory = [...history].sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
            for (const record of sortedHistory) {
                const histBreakdown = record.sentiment_breakdown || record.breakdown || [];
                const histItem = histBreakdown.find((s: any) => {
                    const name = (s.name || s.category || "").toLowerCase().trim();
                    if (name === target) return true;
                    return aliases[target]?.some(alias => name.includes(alias));
                });
                
                if (histItem) {
                    if (histItem.rating) return Number(histItem.rating);
                    
                    const pos = Number(histItem.positive) || 0;
                    const neu = Number(histItem.neutral) || 0;
                    const neg = Number(histItem.negative) || 0;
                    const total = pos + neu + neg;
                    
                    if (total > 0) return (pos * 5 + neu * 3 + neg * 1) / total;
                }
            }
        }
        return 0;
    }

    // Use existing rating if available
    let rating = Number(pillarData.rating);
    if (!isNaN(rating) && rating > 0) return rating;

    // KAİZEN: Fallback to guest_mentions if breakdown missing
    if (hotel.guest_mentions && hotel.guest_mentions.length > 0) {
        const target = pillarName.toLowerCase();
        const aliases: Record<string, string[]> = {
            cleanliness: ["temizlik", "clean", "room", "cleanliness", "odalar", "oda"],
            service: ["hizmet", "staff", "personel", "service"],
            location: ["konum", "neighborhood", "mevki", "location"],
            value: ["değer", "fiyat", "price", "comfort", "kalite", "value", "cost", "money"],
        };

        const relevantMentions = hotel.guest_mentions?.filter((m: any) => {
            const text = (m.keyword || m.text || "").toLowerCase();
            return aliases[target]?.some(alias => text.includes(alias));
        });

        if (relevantMentions && relevantMentions.length > 0) {
            let weightedSum = 0;
            let totalCount = 0;
            relevantMentions.forEach((m: any) => {
                const count = Number(m.count) || 1;
                totalCount += count;
                const score = m.sentiment === 'positive' ? 5 : m.sentiment === 'negative' ? 1 : 3;
                weightedSum += score * count;
            });
            if (totalCount > 0) return weightedSum / totalCount;
        }
    }
    
    // Fallback: Calculate from sentiment counts
    const pos = Number(pillarData.positive) || 0;
    const neu = Number(pillarData.neutral) || 0;
    const neg = Number(pillarData.negative) || 0;
    const total = pos + neu + neg;

    if (total > 0) {
      return (pos * 5 + neu * 3 + neg * 1) / total;
    }
    
    return 0;
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
