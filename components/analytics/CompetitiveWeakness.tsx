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
          keyword: s.description || s.summary, // Use description as primary feedback source
        });
      }
    });

    const negMentions =
      hotel.guest_mentions?.filter((m) => m.sentiment === "negative") || [];
    negMentions.slice(0, 3).forEach((m) => {
      const keyword = (m.keyword || m.text || "").toLowerCase();

      // Determine category based on keyword
      let category = "Problem Area";
      if (
        ["temizlik", "banyo", "oda", "hijyen", "uyku", "yatak", "cleanliness", "bathroom", "room", "hygiene", "sleep", "bed"].some(
          (k) => keyword.includes(k)
        )
      )
        category = "Cleanliness Issue";
      else if (
        ["hizmet", "personel", "ilgi", "reception", "kahvaltı", "servis", "service", "staff", "welcoming", "dining"].some((k) =>
          keyword.includes(k)
        )
      )
        category = "Service Issue";
      else if (
        ["konum", "market", "yer", "ulaşım", "location", "neighborhood", "parking", "view"].some((k) =>
          keyword.includes(k)
        )
      )
        category = "Location Issue";
      else if (
        ["fiyat", "pahalı", "değer", "kalite", "maliyet", "price", "value", "cost", "quality"].some((k) =>
          keyword.includes(k)
        )
      )
        category = "Value Issue";

      weaknesses.push({
        category: category,
        rating: 0,
        keyword: m.keyword || m.text,
        count: m.count,
      });
    });

    return weaknesses
      .sort((a, b) => (a.rating || 0) - (b.rating || 0))
      .slice(0, 3);
  };

  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-6">
        <ShieldAlert className="w-6 h-6 text-red-500" />
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-[var(--overlay-text)]">
            {t("sentiment.competitiveVulnerabilities")}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {t("sentiment.vulnerabilityDesc")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-5">
        {competitors.map((comp, idx) => {
          const weaknesses = getWeaknesses(comp);
          const isSecure = weaknesses.length === 0;

          // Determine Opportunity Level
          let opportunityLevel = "Low";
          let opportunityColor = "text-slate-500 dark:text-slate-400";

          if (weaknesses.length >= 2) {
            opportunityLevel = "High";
            opportunityColor = "text-emerald-600 dark:text-emerald-400";
          } else if (weaknesses.length === 1) {
            opportunityLevel = "Medium";
            opportunityColor = "text-amber-600 dark:text-amber-400";
          }

          return (
            <motion.div
              key={comp.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className={`rounded-xl p-5 border transition-all duration-300 group relative overflow-hidden flex flex-col h-full ${
                isSecure
                  ? "bg-slate-900/20 dark:bg-slate-900/40 border-emerald-500/20 hover:border-emerald-500/40 shadow-md shadow-emerald-500/[0.02]"
                  : "bg-slate-900/20 dark:bg-slate-900/40 border-rose-500/20 hover:border-rose-500/40 shadow-md shadow-rose-500/[0.02]"
              }`}
            >
              {!isSecure ? (
                <div className="absolute top-0 right-0 px-2.5 py-1 bg-rose-500/10 text-rose-600 dark:text-rose-300 text-[9px] font-black uppercase tracking-wider rounded-bl border-l border-b border-rose-500/20">
                  {t("sentiment.threatDetected") || "THREAT DETECTED"}
                </div>
              ) : (
                <div className="absolute top-0 right-0 px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 text-[9px] font-black uppercase tracking-wider rounded-bl border-l border-b border-emerald-500/20">
                  {t("sentiment.secure") || "SECURE"}
                </div>
              )}

              <div className="flex items-center gap-3 mb-5 mt-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isSecure ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                }`}>
                  {isSecure ? <ShieldAlert className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate" title={comp.name}>
                    {comp.name}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                      {t("sentiment.opportunity")}:
                    </span>
                    <span className={`text-[10px] font-black ${opportunityColor}`}>
                      {t(`sentiment.${opportunityLevel.toLowerCase()}`) || opportunityLevel}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 flex-1 flex flex-col justify-between">
                {isSecure ? (
                  /* Secure State: No vulnerabilities found */
                  <div className="flex-1 flex flex-col items-center justify-center py-6">
                    <ShieldAlert className="w-9 h-9 text-emerald-500/60 dark:text-emerald-400/50 mb-2" />
                    <p className="text-[11px] text-center text-slate-500 dark:text-slate-300 font-medium">
                      {t("sentiment.noVulnerabilities") || "No critical vulnerabilities detected."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {weaknesses.map((w, wIdx) => (
                      <div
                        key={wIdx}
                        className="p-3 rounded-lg bg-slate-950/20 dark:bg-black/35 border border-slate-200 dark:border-[var(--overlay-border)] group-hover:border-rose-500/20 transition-all duration-300"
                      >
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                            {w.category}
                          </span>
                          {w.rating > 0 && (
                            <span className="text-[11px] font-black text-rose-600 dark:text-rose-400">
                              {w.rating.toFixed(1)}/5.0
                            </span>
                          )}
                        </div>
                        {w.keyword && (
                          <div className="flex items-start gap-1.5 mt-1">
                            <TrendingDown className="w-3.5 h-3.5 text-rose-500/70 mt-0.5 flex-shrink-0" />
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-normal" title={w.keyword}>
                              {t("sentiment.guestComplaint") || "Guest Insight"}:{" "}
                              <span className="text-rose-700 dark:text-rose-200/90 font-medium italic">
                                "{w.keyword}"
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
