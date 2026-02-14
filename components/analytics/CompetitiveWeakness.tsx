"use client";

import React from "react";
import { motion } from "framer-motion";
import { AlertCircle, TrendingDown, ShieldAlert } from "lucide-react";
import { HotelWithPrice } from "@/types";

interface CompetitiveWeaknessProps {
  competitors: HotelWithPrice[];
  t: (key: string) => string;
}

/**
 * Component to display competitive vulnerabilities.
 * Analyzes competitors' sentiment data to find weak points (rating < 3.8 or negative mentions).
 * Now displays a "Secure" state if no vulnerabilities are found, ensuring the user knows the competitor was analyzed.
 */
export const CompetitiveWeakness: React.FC<CompetitiveWeaknessProps> = ({
  competitors,
  t,
}) => {
  if (!competitors || competitors.length === 0) return null;

  const getWeaknesses = (hotel: HotelWithPrice) => {
    const weaknesses: Array<{
      category: string;
      rating: number;
      keyword?: string;
      count?: number;
    }> = [];

    hotel.sentiment_breakdown?.forEach((s: any) => {
      const rating = Number(s.rating);
      if (!Number.isNaN(rating) && rating < 3.8) {
        weaknesses.push({
          category: s.name || s.category || "General",
          rating: rating,
        });
      }
    });

    const negMentions =
      hotel.guest_mentions?.filter((m) => m.sentiment === "negative") || [];
    negMentions.slice(0, 2).forEach((m) => {
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
            {t("sentiment.competitiveVulnerabilities")}
          </h3>
          <p className="text-xs text-gray-400">
            {t("sentiment.vulnerabilityDesc")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {competitors.map((comp, idx) => {
          const weaknesses = getWeaknesses(comp);
          // Removed: if (weaknesses.length === 0) return null; 
          // Logic update: Show "Secure" card if no weaknesses found.
          
          const isSecure = weaknesses.length === 0;

          return (
            <motion.div
              key={comp.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-[#15294A] rounded-xl p-4 border border-red-500/10 hover:border-red-500/30 transition-all group relative overflow-hidden flex flex-col h-full"
            >
              <div className="absolute top-0 right-0 px-2 py-0.5 bg-red-500/10 text-red-400/50 text-[7px] font-black uppercase tracking-widest rounded-bl border-l border-b border-red-500/10">
                {t("sentiment.threatDetected")}
              </div>

              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 flex-shrink-0">
                  <AlertCircle className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[11px] font-bold text-white truncate pr-6">
                    {comp.name}
                  </h4>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">
                      {t("sentiment.opportunity")}:
                    </span>
                    <span className="text-[8px] text-green-400 font-bold">
                      {t("sentiment.high")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 flex-1">
                {isSecure ? (
                   /* Secure State: No vulnerabilities found */
                  <div className="h-full flex flex-col items-center justify-center opacity-50 py-4">
                    <ShieldAlert className="w-8 h-8 text-green-500/50 mb-2 grayscale" />
                    <p className="text-[10px] text-center text-gray-500 font-medium">
                      {t("sentiment.noVulnerabilities") || "No critical vulnerabilities detected."}
                    </p>
                  </div>
                ) : (
                  weaknesses.map((w, wIdx) => (
                  <div
                    key={wIdx}
                    className="p-2 rounded-lg bg-black/20 border border-white/5 group-hover:border-red-500/10 transition-colors"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-gray-300">
                        {w.category}
                      </span>
                      {w.rating > 0 && (
                        <span className="text-[9px] font-black text-red-400">
                          {w.rating.toFixed(1)}/5.0
                        </span>
                      )}
                    </div>
                    {w.keyword && (
                      <div className="flex items-start gap-1">
                        <TrendingDown className="w-2.5 h-2.5 text-red-500/50 mt-0.5" />
                        <p className="text-[10px] text-gray-500 leading-tight">
                          {t("sentiment.guestComplaint")}:{" "}
                          <span className="text-red-300 font-bold italic">
                            "{w.keyword}"
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                )))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
