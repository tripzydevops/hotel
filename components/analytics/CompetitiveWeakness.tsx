"use client";

import React from "react";
import { motion } from "framer-motion";
import { AlertCircle, TrendingDown, ShieldAlert, ShieldCheck, ChevronRight } from "lucide-react";
import { HotelWithPrice } from "@/types";

interface CompetitiveWeaknessProps {
  competitors: HotelWithPrice[];
  t: (key: string) => string;
}

/**
 * Component to display competitive vulnerabilities.
 * Analyzes competitors' sentiment data to find weak points (rating < 3.8 or negative mentions).
 * Consolidated into a premium unified card matching the Experience Core styling.
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
          keyword: s.description || s.summary,
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
    <div className="bg-[var(--bg-accent)] backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-[var(--glass-border)] h-full flex flex-col justify-between">
      {/* Header Info */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {t("sentiment.competitiveVulnerabilities")}
          </h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pl-11">
          {t("sentiment.vulnerabilityDesc")}
        </p>
      </div>

      {/* Competitors Stack */}
      <div className="space-y-4">
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className={`p-4 rounded-xl border transition-all duration-300 ${
                isSecure
                  ? "bg-emerald-500/[0.02] border-emerald-500/10 hover:border-emerald-500/20"
                  : "bg-rose-500/[0.02] border-rose-500/10 hover:border-rose-500/20"
              }`}
            >
              {/* Hotel Row Header */}
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 mb-1">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate" title={comp.name}>
                      {comp.name}
                    </h4>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                      ({comp.rating?.toFixed(2) || "N/A"})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                      {t("sentiment.opportunity")}:
                    </span>
                    <span className={`text-[9px] font-black uppercase tracking-wider ${opportunityColor}`}>
                      {t(`sentiment.${opportunityLevel.toLowerCase()}`) || opportunityLevel}
                    </span>
                  </div>
                </div>

                {isSecure ? (
                  <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/15">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {t("sentiment.secure") || "SECURE"}
                  </span>
                ) : (
                  <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/15 animate-pulse-subtle">
                    <AlertCircle className="w-3.5 h-3.5 animate-bounce-subtle" />
                    {t("sentiment.threatDetected") || "VULNERABLE"}
                  </span>
                )}
              </div>

              {/* Weaknesses List */}
              <div className="space-y-2 mt-2">
                {isSecure ? (
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-emerald-500/[0.03] border border-emerald-500/5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/60" />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                      {t("sentiment.noVulnerabilities") || "No critical vulnerabilities detected."}
                    </p>
                  </div>
                ) : (
                  weaknesses.map((w, wIdx) => (
                    <div
                      key={wIdx}
                      className="p-3 rounded-lg bg-slate-950/20 dark:bg-black/35 border border-slate-200 dark:border-[var(--overlay-border)] hover:border-rose-500/20 transition-all duration-300"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                          <ChevronRight className="w-3.5 h-3.5 text-rose-500" />
                          {w.category}
                        </span>
                        {w.rating > 0 && (
                          <span className="text-[11px] font-black text-rose-600 dark:text-rose-400">
                            {w.rating.toFixed(1)}/5.0
                          </span>
                        )}
                      </div>
                      {w.keyword && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-normal pl-4.5 mt-1" title={w.keyword}>
                          {t("sentiment.guestComplaint") || "Guest Insight"}:{" "}
                          <span className="text-rose-700 dark:text-rose-200/90 font-medium italic">
                            "{w.keyword}"
                          </span>
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
