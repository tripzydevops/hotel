"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  TrendingDown,
  ThumbsDown,
  ShieldAlert,
} from "lucide-react";
import { HotelWithPrice } from "@/types";

interface CompetitiveWeaknessProps {
  competitors: HotelWithPrice[];
  t: (key: string) => string;
}

export const CompetitiveWeakness: React.FC<CompetitiveWeaknessProps> = ({
  competitors,
  t,
}) => {
  if (!competitors || competitors.length === 0) return null;

  // EXPLANATION: Weakness Identification Logic
  // We identify a "Weakness" as a sentiment category where:
  // 1. The rating is below 3.5 (Threshold for concerns)
  // 2. Or there are notable negative mentions in the guest_mentions array.
  const getWeaknesses = (hotel: HotelWithPrice) => {
    const weaknesses: Array<{
      category: string;
      rating: number;
      keyword?: string;
      count?: number;
    }> = [];

    // Check categories
    hotel.sentiment_breakdown?.forEach((s: any) => {
      const rating = Number(s.rating);
      if (!Number.isNaN(rating) && rating < 3.8) {
        weaknesses.push({
          category: s.name || s.category || "General",
          rating: rating,
        });
      }
    });

    // Check negative keywords
    const negMentions =
      hotel.guest_mentions?.filter((m) => m.sentiment === "negative") || [];
    negMentions.slice(0, 2).forEach((m) => {
      // Only add if not already covered by a category, or to enrich a category
      const existing = weaknesses.find((w) =>
        w.category.toLowerCase().includes(m.keyword?.toLowerCase() || ""),
      );
      if (existing) {
        existing.keyword = m.keyword;
        existing.count = m.count;
      } else {
        weaknesses.push({
          category: "Service Issue",
          rating: 0,
          keyword: m.keyword || m.text,
          count: m.count,
        });
      }
    });

    return weaknesses
      .sort((a, b) => (a.rating || 0) - (b.rating || 0))
      .slice(0, 3);
  };

  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-6">
        <ShieldAlert className="w-6 h-6 text-red-400" />
        <div>
          <h3 className="text-xl font-bold text-white">
            Competitive Vulnerabilities
          </h3>
          <p className="text-xs text-gray-400">
            Identified areas where competitors are underperforming
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {competitors.map((comp, idx) => {
          const weaknesses = getWeaknesses(comp);
          if (weaknesses.length === 0) return null;

          return (
            <motion.div
              key={comp.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-[#15294A] rounded-xl p-5 border border-red-500/10 hover:border-red-500/30 transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="max-w-[70%]">
                  <h4 className="text-sm font-bold text-white truncate">
                    {comp.name}
                  </h4>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider italic">
                    Vulnerable Set
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-4">
                {weaknesses.map((w, wIdx) => (
                  <div
                    key={wIdx}
                    className="relative pl-4 border-l-2 border-red-500/20 group-hover:border-red-500/40 transition-colors"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-gray-300">
                        {w.category}
                      </span>
                      {w.rating > 0 && (
                        <span className="text-[10px] font-black text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">
                          {w.rating.toFixed(1)} / 5.0
                        </span>
                      )}
                    </div>
                    {w.keyword && (
                      <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
                        <TrendingDown className="w-3 h-3 text-red-500/50" />
                        Frequent complaint:{" "}
                        <span className="text-red-300/80 font-bold">
                          "{w.keyword}"
                        </span>
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-gray-500 font-bold">
                  Win Opportunity:
                </span>
                <span className="text-[10px] text-green-400 font-bold bg-green-400/10 px-2 py-1 rounded-full">
                  High
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
