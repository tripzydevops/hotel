"use client";

/**
 * =====================================================================
 * REPORTS PAGE — Executive Briefing Redesign (Phase 1)
 * =====================================================================
 *
 * Visual Design: Deep Ocean + Soft Gold, Glassmorphism cards
 * Skills Applied: frontend-design, animation-guide, vercel-react-best-practices
 *
 * Architecture:
 *   - KPI Strip: 6 executive KPI cards with micro-sparklines
 *   - Strategic Map: Reused AdvisorQuadrant component
 *   - Charts: Market Position + Price Trend (dynamic imported)
 *   - Experience Scorecard: Sentiment bars (Cleanliness, Service, Location, Value)
 *   - Competitive Battlefield: Weak-point matrix per competitor
 *   - Scan History: Collapsible accordion (demoted from primary)
 *
 * Data Flow:
 *   - useDashboard() → target_hotel, competitors (sentiment data)
 *   - api.getReports() → scan sessions
 *   - api.getAnalysis() → ARI, GRI, pricing, market data
 * =====================================================================
 */

import { useEffect, useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useDashboard } from "@/hooks/useDashboard";
import { useAnalysisStream } from "@/hooks/useAnalysisStream";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  History,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileType,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Radar,
  Shield,
  Target,
  Trophy,
  Swords,
  Sparkles,
  Brain,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useModalContext } from "@/components/ui/ModalContext";
import { ScanSession, MarketAnalysis } from "@/types";
import { createClient } from "@/utils/supabase/client";
import dynamic from "next/dynamic";
import { PaywallOverlay } from "@/components/ui/PaywallOverlay";
import { motion } from "framer-motion";
import { getCurrencySymbol } from "@/lib/utils";

// Dynamic imports for heavy chart components (bundle-dynamic-imports)
const MarketPositionChart = dynamic(
  () => import("@/components/analytics/MarketPositionChart"),
  { ssr: false }
);
const PriceTrendChart = dynamic(
  () => import("@/components/analytics/PriceTrendChart"),
  { ssr: false }
);
const AdvisorQuadrant = dynamic(
  () => import("@/components/analytics/AdvisorQuadrant"),
  { ssr: false }
);

/* ── Stagger animation variants (per animation-guide skill) ── */
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};
const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0, 0, 0.58, 1] as const },
  },
};
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

/* ── Translation map for sentiment keywords (TR → EN) ── */
const KEYWORD_TRANSLATIONS: Record<string, string> = {
  hizmet: "Service", temizlik: "Cleanliness", konum: "Location", oda: "Room",
  kahvaltı: "Breakfast", fiyat: "Price", yemek: "Food", havuz: "Pool",
  personel: "Staff", sessizlik: "Quietness", konfor: "Comfort", banyo: "Bathroom",
};

/* ── Category aliases for multi-language matching ── */
const CATEGORY_ALIASES: Record<string, string[]> = {
  cleanliness: ["temizlik", "clean", "room", "cleanliness", "oda", "odalar"],
  service: ["hizmet", "staff", "personel", "service"],
  location: ["konum", "neighborhood", "mevki", "location"],
  value: ["değer", "fiyat", "price", "comfort", "kalite", "value", "fiyat/performans", "cost", "money"],
};

/**
 * ParityHealthSection - Intelligence Layer Pillar
 * Visualizes rate integrity and revenue leakage risks.
 */
function ParityHealthSection({
  targetHotel,
  competitors = [],
  currency = "TRY",
}: {
  targetHotel?: any;
  competitors?: any[];
  currency?: string;
}) {
  const targetPrice = targetHotel?.price_info?.current_price || 0;
  const undercuts = competitors.filter(
    (c) => c.price_info?.current_price && c.price_info.current_price < targetPrice
  );
  
  const parityScore = competitors.length > 0
    ? Math.round(((competitors.length - undercuts.length) / competitors.length) * 100)
    : 100;

  const revenueRisk = undercuts.reduce((acc, c) => {
    const diff = targetPrice - (c.price_info?.current_price || 0);
    return acc + diff;
  }, 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: currency,
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
      <div className="glass-card p-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Shield className="w-16 h-16 text-[#F6C344]" />
        </div>
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
          Parity Health
        </h3>
        <div className="flex flex-col">
          <span className="text-4xl font-black text-white">{parityScore}%</span>
          <span className="text-[10px] text-emerald-400 font-bold mt-1">Live Market Integrity</span>
        </div>
      </div>

      <div className="glass-card p-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <AlertCircle className="w-16 h-16 text-rose-500" />
        </div>
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
          Discrepancies
        </h3>
        <div className="flex flex-col">
          <span className="text-4xl font-black text-white">{undercuts.length}</span>
          <span className="text-[10px] text-rose-400 font-bold mt-1">Active Undercuts Detected</span>
        </div>
      </div>

      <div className="glass-card p-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Activity className="w-16 h-16 text-blue-400" />
        </div>
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
          Revenue Leakage
        </h3>
        <div className="flex flex-col">
          <span className="text-4xl font-black text-white">{formatCurrency(revenueRisk)}</span>
          <span className="text-[10px] text-slate-400 font-bold mt-1">Est. Daily Parity Risk</span>
        </div>
      </div>
    </div>
  );
}

/**
 * PricingDNAProfileCard - Intelligence Layer Pillar
 * Surfaces the AI-generated pricing personality.
 */
function PricingDNAProfileCard({ 
  dnaText, 
  streamingNarrative,
  isStreaming,
  hotelName,
  isLocked 
}: { 
  dnaText?: string; 
  streamingNarrative?: string;
  isStreaming?: boolean;
  hotelName: string;
  isLocked: boolean;
}) {
  return (
    <motion.div
      variants={fadeInUp}
      className={`glass-card p-6 border-l-4 border-l-[var(--soft-gold)] relative overflow-hidden ${isLocked ? 'grayscale opacity-50' : ''}`}
    >
      {isLocked && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--deep-ocean)]/40 backdrop-blur-[2px]">
           <div className="flex flex-col items-center gap-2">
             <Shield className="w-6 h-6 text-[var(--soft-gold)]" />
             <span className="text-[10px] font-black uppercase tracking-widest text-[var(--soft-gold)]">Upgrade to Pro</span>
           </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--soft-gold)]/10 flex items-center justify-center">
            <Brain className="w-5 h-5 text-[var(--soft-gold)]" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white">Strategic Personality</h3>
            <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">
              Pricing DNA Profile
            </p>
          </div>
        </div>
        {isStreaming && (
          <div className="flex items-center gap-2 bg-[var(--soft-gold)]/10 px-2 py-1 rounded-md">
            <div className="w-1.5 h-1.5 bg-[var(--soft-gold)] rounded-full animate-pulse" />
            <span className="text-[8px] font-black text-[var(--soft-gold)] uppercase tracking-tighter">AI Reasoning</span>
          </div>
        )}
      </div>
      <p className="text-sm text-white/80 leading-relaxed italic font-medium">
        &quot;{streamingNarrative || dnaText || `Analyzing ${hotelName}'s market footprint to determine strategic intent...`}&quot;
      </p>
    </motion.div>
  );
}

/**
 * RecommendationCard - Phase 3 Action Layer
 * Displays suggested rate actions with animated impact indicators.
 */
function RecommendationCard({ 
  recommendation, 
  currency,
  isLocked 
}: { 
  recommendation: any; 
  currency: string;
  isLocked: boolean;
}) {
  if (!recommendation || recommendation.action === "no_data") return null;

  const isPositive = recommendation.action === "increase";
  const isNegative = recommendation.action === "decrease";

  return (
    <motion.div
      variants={fadeInUp}
      className={`glass-card p-6 border-l-4 ${isPositive ? 'border-l-emerald-500 bg-emerald-500/5' : isNegative ? 'border-l-rose-500 bg-rose-500/5' : 'border-l-blue-500 bg-blue-500/5'} relative overflow-hidden ${isLocked ? 'grayscale opacity-50' : ''}`}
    >
      {isLocked && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--deep-ocean)]/60 backdrop-blur-[4px]">
           <div className="flex flex-col items-center gap-2">
             <Trophy className="w-8 h-8 text-[#F6C344]" />
             <span className="text-xs font-black uppercase tracking-widest text-[#F6C344]">Enterprise Feature</span>
             <Link href="/billing" className="mt-2 px-4 py-1.5 rounded-full bg-[#F6C344] text-[var(--deep-ocean)] text-[10px] font-black uppercase tracking-tighter hover:scale-105 transition-transform">
                Upgrade Now
             </Link>
           </div>
        </div>
      )}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isPositive ? 'bg-emerald-500/20 text-emerald-400' : isNegative ? 'bg-rose-500/20 text-rose-400' : 'bg-blue-500/20 text-blue-400'}`}>
            {isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-sm font-black text-white">Strategic Recommendation</h3>
            <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">
              Actionable AI Layer
            </p>
          </div>
        </div>
        {recommendation.amount !== 0 && (
          <div className={`px-3 py-1 rounded-full text-xs font-black ${isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
            {isPositive ? '+' : ''}{recommendation.amount}%
          </div>
        )}
      </div>
      
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
          <p className="text-lg font-black text-white mb-1">
            {recommendation.action === "increase" ? "Increase Rates" : recommendation.action === "decrease" ? "Decrease Rates" : "Maintain Rates"}
          </p>
          <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed">
            {recommendation.reason}
          </p>
        </div>

        {recommendation.new_price && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
            <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Target ADR</span>
            <span className="text-base font-black text-white">
               {getCurrencySymbol(currency)}{recommendation.new_price.toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * OperationalAuditChecklist - Phase 3 Action Layer
 * Specific tasks to improve hotel performance.
 */
function OperationalAuditChecklist({ checklist, isLocked }: { checklist: any[]; isLocked: boolean }) {
  return (
    <motion.div
      variants={fadeInUp}
      className={`glass-card p-6 border border-white/10 relative overflow-hidden ${isLocked ? 'grayscale opacity-50' : ''}`}
    >
      {isLocked && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--deep-ocean)]/60 backdrop-blur-[4px]">
           <div className="flex flex-col items-center gap-2">
             <Trophy className="w-8 h-8 text-[#F6C344]" />
             <span className="text-xs font-black uppercase tracking-widest text-[#F6C344]">Enterprise Feature</span>
           </div>
        </div>
      )}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-sm font-black text-white">Operational Audit</h3>
          <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">
            Kaizen Priority Tasks
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {checklist.map((item, idx) => (
          <div key={idx} className="flex gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.05] transition-colors group">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-indigo-500/20 transition-colors">
              <span className="text-[10px] font-black text-indigo-400">{idx + 1}</span>
            </div>
            <div>
              <p className="text-xs font-black text-white/90 mb-1">{item.pillar}</p>
              <p className="text-[11px] text-[var(--text-muted)] font-medium leading-relaxed mb-2">
                {item.issue}
              </p>
              <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-400">
                <ArrowRight className="w-3 h-3" />
                {item.action}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/**
 * getCategoryScore - Multi-layered score resolver
 * Attempts to find a score for a specific category using:
 * 1. Current breakdown (live data)
 * 2. Guest mentions (weighted keyword average)
 */
function getCategoryScore(hotel: any, category: string): number {
  if (!hotel?.sentiment_breakdown) return 0;
  const target = category.toLowerCase();
  const aliases = CATEGORY_ALIASES[target] || [];

  const item = hotel.sentiment_breakdown.find((s: any) => {
    const name = (s.name || s.category || "").toLowerCase().trim();
    if (name === target) return true;
    return aliases.some((alias) => name.includes(alias));
  });

  if (!item) {
    // Fallback: guest_mentions weighted average
    if (hotel.guest_mentions?.length > 0) {
      const relevant = hotel.guest_mentions.filter((m: any) => {
        const text = (m.keyword || m.text || "").toLowerCase();
        return aliases.some((alias) => text.includes(alias));
      });
      if (relevant.length > 0) {
        let weightedSum = 0;
        let totalCount = 0;
        relevant.forEach((m: any) => {
          const count = Number(m.count) || 1;
          totalCount += count;
          const score = m.sentiment === "positive" ? 5 : m.sentiment === "negative" ? 1 : 3;
          weightedSum += score * count;
        });
        if (totalCount > 0) return weightedSum / totalCount;
      }
    }
    return 0;
  }

  if (item.rating !== undefined && item.rating !== null) return Number(item.rating);
  const pos = Number(item.positive) || 0;
  const neu = Number(item.neutral) || 0;
  const neg = Number(item.negative) || 0;
  const total = pos + neu + neg;
  return total > 0 ? (pos * 5 + neu * 3 + neg * 1) / total : 0;
}

// ═══════════════════════════════════════════════════════
// ──── KPI CARD COMPONENT ────
// ═══════════════════════════════════════════════════════
function KpiCard({
  label,
  value,
  suffix,
  icon,
  accentColor = "var(--soft-gold)",
  trend,
  trendLabel,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  icon: React.ReactNode;
  accentColor?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
}) {
  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="glass-card p-5 border border-white/[0.08] hover:border-white/15 transition-all duration-300 cursor-default group relative overflow-hidden"
    >
      {/* Subtle gradient overlay on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(circle at top right, ${accentColor}08, transparent 70%)`,
        }}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div
            className="p-2 rounded-lg"
            style={{ background: `${accentColor}15` }}
          >
            <div style={{ color: accentColor }}>{icon}</div>
          </div>
          {trend && (
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                trend === "up"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : trend === "down"
                    ? "bg-red-500/10 text-red-400"
                    : "bg-white/5 text-gray-500"
              }`}
            >
              {trend === "up" ? (
                <TrendingUp className="w-3 h-3" />
              ) : trend === "down" ? (
                <TrendingDown className="w-3 h-3" />
              ) : null}
              {trendLabel}
            </div>
          )}
        </div>
        <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1.5">
          {label}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-black text-white">{value}</span>
          {suffix && (
            <span className="text-xs font-bold text-[var(--text-muted)]">
              {suffix}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════
// ──── EXPERIENCE BAR COMPONENT ────
// ═══════════════════════════════════════════════════════
function ExperienceBar({
  category,
  myScore,
  marketAvg,
  leaderScore,
  leaderName,
  t,
}: {
  category: string;
  myScore: number;
  marketAvg: number;
  leaderScore: number;
  leaderName?: string;
  t: (key: string) => string;
}) {
  const categoryKey = category.toLowerCase();
  const localizedCategory =
    t(`sentiment.${categoryKey}`) !== `sentiment.${categoryKey}`
      ? t(`sentiment.${categoryKey}`)
      : category;

  const diff = myScore - marketAvg;
  const isAhead = diff > 0.1;
  const isBehind = diff < -0.1;

  return (
    <div className="flex flex-col">
      <div className="flex justify-between items-end mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white/80">{localizedCategory}</span>
          {isAhead && (
            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              +{diff.toFixed(1)}
            </span>
          )}
          {isBehind && (
            <span className="text-[9px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
              {diff.toFixed(1)}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-black text-white/90">
            {myScore > 0 ? myScore.toFixed(1) : "N/A"}
          </span>
          <span className="text-[10px] text-gray-600 font-semibold">/ 5.0</span>
        </div>
      </div>

      {/* My Hotel bar */}
      <div className="h-[6px] bg-white/[0.06] rounded-full overflow-hidden relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(Math.max(myScore, 0.5) / 5) * 100}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
        />
      </div>

      {/* Comparison rows */}
      <div className="mt-2 space-y-1">
        {leaderName && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 w-20 truncate font-medium">
              {leaderName}
            </span>
            <div className="flex-1 h-[3px] bg-white/[0.04] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(leaderScore / 5) * 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                className="h-full bg-gradient-to-r from-amber-500/60 to-amber-400/40 rounded-full"
              />
            </div>
            <span className="text-[10px] text-amber-400/80 font-bold w-7 text-right">
              {leaderScore.toFixed(1)}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-20 font-medium">
            {t("sentiment.avgComp") !== "sentiment.avgComp" ? t("sentiment.avgComp") : "Market Avg"}
          </span>
          <div className="flex-1 h-[3px] bg-white/[0.04] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(marketAvg / 5) * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
              className="h-full bg-gradient-to-r from-gray-500/40 to-gray-400/30 rounded-full"
            />
          </div>
          <span className="text-[10px] text-gray-400 w-7 text-right">
            {marketAvg.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ──── COMPETITIVE BATTLEFIELD TABLE ────
// ═══════════════════════════════════════════════════════
function CompetitiveBattlefield({
  targetHotel,
  competitors,
  currency,
  t,
}: {
  targetHotel: any;
  competitors: any[];
  currency: string;
  t: (key: string) => string;
}) {
  const categories = ["cleanliness", "service", "location", "value"];

  const getWeakestCategory = (hotel: any) => {
    let weakest = { category: "", score: Infinity };
    for (const cat of categories) {
      const score = getCategoryScore(hotel, cat);
      if (score > 0 && score < weakest.score) {
        weakest = { category: cat, score };
      }
    }
    return weakest;
  };

  const myScores: Record<string, number> = {};
  categories.forEach((c) => {
    myScores[c] = getCategoryScore(targetHotel, c);
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="px-4 py-3 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
              {t("sentiment.competitor") !== "sentiment.competitor" ? t("sentiment.competitor") : "Competitor"}
            </th>
            <th className="px-4 py-3 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
              Rating
            </th>
            <th className="px-4 py-3 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
              Price
            </th>
            <th className="px-4 py-3 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
              {t("reports.weakestArea") !== "reports.weakestArea" ? t("reports.weakestArea") : "Weakest Area"}
            </th>
            <th className="px-4 py-3 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest text-right">
              {t("reports.yourEdge") !== "reports.yourEdge" ? t("reports.yourEdge") : "Your Edge"}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {competitors.map((comp: any) => {
            const weak = getWeakestCategory(comp);
            const myScoreInWeakArea = myScores[weak.category] || 0;
            const edge = myScoreInWeakArea - weak.score;
            const localizedCat =
              t(`sentiment.${weak.category}`) !== `sentiment.${weak.category}`
                ? t(`sentiment.${weak.category}`)
                : weak.category;

            return (
              <tr
                key={comp.id}
                className="hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-4 py-3">
                  <span className="text-sm font-bold text-white/90 line-clamp-1">
                    {comp.name}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-sm font-black ${
                      (comp.rating || 0) >= 4.0
                        ? "text-emerald-400"
                        : (comp.rating || 0) >= 3.5
                          ? "text-amber-400"
                          : "text-red-400"
                    }`}
                  >
                    {(comp.rating || 0).toFixed(1)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm font-bold text-white/80">
                    {comp.price_info?.current_price
                      ? `${getCurrencySymbol(currency)}${comp.price_info.current_price.toLocaleString()}`
                      : "N/A"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {weak.category ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded capitalize">
                        {localizedCat}
                      </span>
                      <span className="text-[10px] text-gray-500 font-bold">
                        ({weak.score.toFixed(1)})
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {edge > 0 ? (
                    <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">
                      +{edge.toFixed(1)}
                    </span>
                  ) : edge < 0 ? (
                    <span className="text-xs font-black text-red-400 bg-red-500/10 px-2 py-1 rounded-lg">
                      {edge.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ──── MAIN REPORTS PAGE ────
// ═══════════════════════════════════════════════════════
export default function ReportsPage() {
  const { t, locale } = useI18n();
  const { userId } = useAuth();
  const supabase = createClient();
  const { data: dashboardData, loading: dashLoading } = useDashboard(userId, t);

  const [currency, setCurrency] = useState("TRY");
  const { 
    data: analysisData, 
    narrative: streamingNarrative, 
    isStreaming, 
    error: streamError 
  } = useAnalysisStream(userId || undefined, "Standard");

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [scanHistoryOpen, setScanHistoryOpen] = useState(false);

  // Use either streaming data or static analytical data
  const analysis = analysisData;

  const {
    setIsProfileOpen,
    setIsSettingsOpen,
    setIsAlertsOpen,
    setIsBillingOpen,
    setIsSessionModalOpen,
    setSelectedSession,
  } = useModalContext();

  // ── Data fetching (Reports history only, analysis handled by stream hook) ──
  useEffect(() => {
    async function loadReports() {
      if (!userId) return;
      setLoading(true);
      try {
        const reportsResult = await api.getReports(userId);
        setData(reportsResult);
      } catch (err) {
        console.error("Failed to load reports:", err);
      } finally {
        setLoading(false);
      }
    }
    loadReports();
  }, [userId]);

  // ── Derived state (rerender-derived-state, no useEffect) ──
  const targetHotel = useMemo(
    () => dashboardData?.target_hotel,
    [dashboardData?.target_hotel]
  );
  const competitors = useMemo(
    () => dashboardData?.competitors || [],
    [dashboardData?.competitors]
  );

  const allHotels = useMemo(
    () =>
      [
        ...(targetHotel ? [{ ...targetHotel, isTarget: true }] : []),
        ...competitors.map((c: any) => ({ ...c, isTarget: false })),
      ].sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0)),
    [targetHotel, competitors]
  );

  const leader = useMemo(() => allHotels[0], [allHotels]);

  const marketAvgRating = useMemo(
    () =>
      allHotels.length > 0
        ? allHotels.reduce((sum, h) => sum + (Number(h.rating) || 0), 0) /
          allHotels.length
        : 0,
    [allHotels]
  );

  // Strategic Map computation
  const strategicMap = useMemo(() => {
    if (!targetHotel || !analysis) return null;
    const myPrice = Number(targetHotel.price_info?.current_price) || 0;
    const myRating = Number(targetHotel.rating) || 0;
    const validCompetitors = competitors.filter(
      (c: any) => c.price_info?.current_price
    );

    const avgMarketPrice =
      validCompetitors.length > 0
        ? validCompetitors.reduce(
            (sum: number, c: any) =>
              sum + (Number(c.price_info?.current_price) || 0),
            0
          ) / validCompetitors.length
        : myPrice;

    const ari = avgMarketPrice > 0 ? (myPrice / avgMarketPrice) * 100 : 100;
    const sentimentIndex =
      marketAvgRating > 0 ? (myRating / marketAvgRating) * 100 : 100;

    const x = Math.min(Math.max(sentimentIndex - 100, -50), 50);
    const y = Math.min(Math.max(ari - 100, -50), 50);

    let label = "Standard";
    if (x > 2 && y > 2) label = "Premium King";
    else if (x > 2 && y < -2) label = "Value Leader";
    else if (x < -2 && y < -2) label = "Budget / Economy";
    else if (x < -2 && y > 2) label = "Danger Zone";

    return {
      x,
      y,
      label,
      ari,
      sentiment: sentimentIndex,
      targetRating: myRating,
      marketRating: marketAvgRating,
    };
  }, [targetHotel, competitors, marketAvgRating, analysis]);

  const handleExport = async (format: string) => {
    if (!userId) return;
    setExporting(format);

    try {
      if (format === "pdf") {
        const { default: jsPDF } = await import("jspdf");
        const { default: autoTable } = await import("jspdf-autotable");

        const doc = new jsPDF();

        doc.setFontSize(20);
        doc.setTextColor(40, 40, 40);
        doc.text("Hotel Rate Sentinel - Executive Report", 14, 22);

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
        doc.text(`Currency: ${currency}`, 14, 32);

        // KPI Summary
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text("Executive Summary", 14, 45);

        const kpiData = [
          ["Your Rate", analysis?.target_price ? `${getCurrencySymbol(currency)}${analysis.target_price.toLocaleString()}` : "N/A"],
          ["Market Average", analysis?.market_average ? `${getCurrencySymbol(currency)}${analysis.market_average.toLocaleString()}` : "N/A"],
          ["ARI (Avg Rate Index)", analysis?.ari?.toFixed(1) || "N/A"],
          ["GRI (Guest Rating Index)", analysis?.sentiment_index?.toFixed(1) || "N/A"],
          ["Parity Score", targetHotel ? `${Math.round(((competitors.length - competitors.filter(c => c.price_info?.current_price && c.price_info.current_price < (targetHotel.price_info?.current_price || 0)).length) / (competitors.length || 1)) * 100)}%` : "N/A"],
          ["Competitive Rank", analysis?.competitive_rank ? `#${analysis.competitive_rank} of ${(analysis.competitors?.length || 0) + 1}` : "N/A"],
          ["Strategic Personality", analysis?.pricing_dna_text || "Standard Positioning"],
        ];

        autoTable(doc, {
          startY: 50,
          head: [["Metric", "Value"]],
          body: kpiData,
          theme: "grid",
          headStyles: { fillColor: [212, 175, 55], textColor: [0, 0, 0] },
          styles: { fontSize: 10 },
        });

        // Sessions
        const lastY = (doc as any).lastAutoTable.finalY || 100;
        doc.setFontSize(14);
        doc.text("Scan Activity Log", 14, lastY + 15);

        const tableData =
          data?.sessions?.slice(0, 10).map((s: any) => [
            new Date(s.created_at).toLocaleString(),
            s.session_type?.toUpperCase(),
            s.status?.toUpperCase(),
            s.hotels_count,
          ]) || [];

        autoTable(doc, {
          startY: lastY + 20,
          head: [["Timestamp", "Type", "Status", "Hotels"]],
          body: tableData,
          theme: "striped",
          headStyles: { fillColor: [40, 40, 40] },
        });

        doc.save(
          `executive-report-${currency}-${new Date().toISOString().split("T")[0]}.pdf`
        );
      } else {
        await api.exportReport(userId, format);
      }
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(null);
    }
  };

  const handleOpenSession = (session: ScanSession) => {
    setSelectedSession(session);
    setIsSessionModalOpen(true);
  };

  const isLocked =
    profile?.subscription_status === "past_due" ||
    profile?.subscription_status === "canceled" ||
    profile?.subscription_status === "unpaid";

  const isDataReady = !loading || data;
  const hasSentiment = (targetHotel?.sentiment_breakdown?.length ?? 0) > 0;

  if (loading && !data && dashLoading) {
    return (
      <div className="min-h-screen bg-[var(--deep-ocean)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-[var(--soft-gold)] border-t-transparent rounded-full animate-spin" />
            <div className="absolute inset-0 animate-ping w-12 h-12 border border-[var(--soft-gold)]/20 rounded-full" />
          </div>
          <p className="text-[var(--soft-gold)] font-black uppercase tracking-widest text-[10px]">
            {t("reports.compiling")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12 transition-all">
      {isLocked && (
        <PaywallOverlay
          reason={
            profile?.subscription_status === "canceled"
              ? "Subscription Canceled"
              : "Trial Expired"
          }
        />
      )}

      <main className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* ═══════════════════════════════════════════════ */}
        {/* ── PAGE HEADER ──                              */}
        {/* ═══════════════════════════════════════════════ */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-blue-300 tracking-tight mb-1">
              {t("reports.title") !== "reports.title" ? t("reports.title") : "Executive Report"}
            </h1>
            <p className="text-sm text-[var(--text-muted)] font-medium">
              Comprehensive performance, sentiment & competitive intelligence
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Currency Selector */}
            <div className="glass px-3 py-1.5 rounded-lg flex items-center gap-2 border border-white/10">
              <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">
                {t("reports.currencyLabel")}
              </span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="bg-transparent text-xs font-bold text-white border-none focus:ring-0 cursor-pointer"
              >
                <option value="USD" className="bg-[var(--deep-ocean)]">USD ($)</option>
                <option value="EUR" className="bg-[var(--deep-ocean)]">EUR (€)</option>
                <option value="TRY" className="bg-[var(--deep-ocean)]">TRY (₺)</option>
                <option value="GBP" className="bg-[var(--deep-ocean)]">GBP (£)</option>
              </select>
            </div>

            {/* Export Buttons */}
            <button
              onClick={() => handleExport("csv")}
              disabled={!!exporting}
              className="btn-ghost flex items-center gap-2 group"
            >
              <FileSpreadsheet className="w-4 h-4 group-hover:text-[var(--soft-gold)] transition-colors" />
              <span className="text-xs font-black uppercase tracking-widest">
                {exporting === "csv" ? t("reports.exporting") : t("reports.exportCsv")}
              </span>
            </button>
            <button
              onClick={() => handleExport("pdf")}
              disabled={!!exporting}
              className="btn-gold flex items-center gap-2"
            >
              <FileType className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-widest">
                {exporting === "pdf" ? t("reports.exporting") : t("reports.exportPdf")}
              </span>
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════ */}
        {/* ── SECTION 1: EXECUTIVE KPI SNAPSHOT ──        */}
        {/* ═══════════════════════════════════════════════ */}
        {analysis && (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10"
          >
            <KpiCard
              label={t("reports.yourRate") !== "reports.yourRate" ? t("reports.yourRate") : "Your Rate"}
              value={
                analysis.target_price
                  ? `${getCurrencySymbol(currency)}${analysis.target_price.toLocaleString()}`
                  : "N/A"
              }
              icon={<Target className="w-4 h-4" />}
              accentColor="#D4AF37"
              trend={
                analysis.target_price && analysis.market_average
                  ? analysis.target_price < analysis.market_average
                    ? "down"
                    : "up"
                  : undefined
              }
              trendLabel={
                analysis.target_price && analysis.market_average
                  ? `${Math.abs(((analysis.target_price - analysis.market_average) / analysis.market_average) * 100).toFixed(0)}%`
                  : undefined
              }
            />
            <KpiCard
              label={t("reports.marketAvg") !== "reports.marketAvg" ? t("reports.marketAvg") : "Market Avg"}
              value={
                analysis.market_average
                  ? `${getCurrencySymbol(currency)}${Math.round(analysis.market_average).toLocaleString()}`
                  : "N/A"
              }
              icon={<BarChart3 className="w-4 h-4" />}
              accentColor="#94A3B8"
            />
            <KpiCard
              label={t("reports.ariLabel")}
              value={analysis.ari?.toFixed(1) || "100.0"}
              icon={<Activity className="w-4 h-4" />}
              accentColor={
                (analysis.ari || 100) > 105
                  ? "#EF4444"
                  : (analysis.ari || 100) < 95
                    ? "#10B981"
                    : "#D4AF37"
              }
              trend={
                (analysis.ari || 100) > 105
                  ? "up"
                  : (analysis.ari || 100) < 95
                    ? "down"
                    : "neutral"
              }
              trendLabel={
                (analysis.ari || 100) > 105
                  ? t("reports.overpriced") !== "reports.overpriced" ? t("reports.overpriced") : "High"
                  : (analysis.ari || 100) < 95
                    ? t("reports.underpriced") !== "reports.underpriced" ? t("reports.underpriced") : "Low"
                    : "Balanced"
              }
            />
            <KpiCard
              label={t("reports.sentimentLabel")}
              value={analysis.sentiment_index?.toFixed(1) || "100.0"}
              icon={<Sparkles className="w-4 h-4" />}
              accentColor={
                (analysis.sentiment_index || 100) > 105
                  ? "#10B981"
                  : (analysis.sentiment_index || 100) < 95
                    ? "#EF4444"
                    : "#3B82F6"
              }
              trend={
                (analysis.sentiment_index || 100) > 105
                  ? "up"
                  : (analysis.sentiment_index || 100) < 95
                    ? "down"
                    : "neutral"
              }
              trendLabel={
                (analysis.sentiment_index || 100) > 105
                  ? t("reports.valuePremium") !== "reports.valuePremium" ? t("reports.valuePremium") : "Strong"
                  : (analysis.sentiment_index || 100) < 95
                    ? t("reports.lostValue") !== "reports.lostValue" ? t("reports.lostValue") : "Weak"
                    : "Balanced"
              }
            />
            <KpiCard
              label={t("reports.competitiveRank")}
              value={
                analysis.competitive_rank
                  ? `#${analysis.competitive_rank}`
                  : "—"
              }
              suffix={
                analysis.competitors
                  ? `of ${analysis.competitors.length + 1}`
                  : undefined
              }
              icon={<Trophy className="w-4 h-4" />}
              accentColor="#F59E0B"
            />
            <KpiCard
              label={t("reports.marketSpread") !== "reports.marketSpread" ? t("reports.marketSpread") : "Market Spread"}
              value={
                analysis.market_max && analysis.market_min
                  ? `${getCurrencySymbol(currency)}${Math.round(analysis.market_max - analysis.market_min).toLocaleString()}`
                  : "—"
              }
              icon={<Shield className="w-4 h-4" />}
              accentColor="#8B5CF6"
            />
          </motion.div>
        )}

        {/* ── INTELLIGENCE LAYER: PARITY & PERSISTENCE ── */}
        <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="mb-10">
          <ParityHealthSection 
            targetHotel={targetHotel} 
            competitors={competitors} 
            currency={currency} 
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PricingDNAProfileCard
              dnaText={analysis?.pricing_dna_text}
              streamingNarrative={streamingNarrative}
              isStreaming={isStreaming}
              hotelName={targetHotel?.name || "Target Hotel"}
              isLocked={isLocked}
            />
            <div className="glass-card p-6 bg-blue-500/5 border border-blue-500/10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Target className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">Market Sentiment Match</h4>
                <p className="text-sm text-white/80 font-medium">
                  {analysis?.sentiment_index && analysis.sentiment_index > 100 
                    ? "Your brand reputation is outperforming market baseline. You have pricing power." 
                    : "Sentiment is currently below market par. Focus on Cleanliness and Service pillars to regain leverage."}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── ACTION LAYER: RECOMMENDATIONS & AUDIT ── */}
        {analysis && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
             <RecommendationCard 
               recommendation={analysis.recommendation} 
               currency={currency}
               isLocked={profile?.plan_type !== 'enterprise'}
             />
             <OperationalAuditChecklist 
               checklist={analysis.audit_checklist || []}
               isLocked={profile?.plan_type !== 'enterprise'}
             />
          </div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* ── SO WHAT? INSIGHT CARD ──                    */}
        {/* ═══════════════════════════════════════════════ */}
        {analysis && (
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="glass-card p-6 bg-gradient-to-br from-[var(--soft-gold)]/10 to-transparent border border-white/[0.08] relative mb-10 overflow-hidden"
          >
            <div className="absolute -right-4 -bottom-4 opacity-[0.05]">
              <Sparkles className="w-32 h-32 text-[var(--soft-gold)]" />
            </div>
            <div className="flex gap-5 items-start relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-[var(--soft-gold)]/20 flex items-center justify-center flex-shrink-0">
                <Brain className="w-7 h-7 text-[var(--soft-gold)]" />
              </div>
              <div>
                <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--soft-gold)] mb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--soft-gold)] animate-pulse" />
                  Synthetic AI Narrative
                </h5>
                <p className="text-base text-white/95 font-semibold leading-relaxed tracking-tight">
                  {analysis.synthetic_narrative || analysis.advisory_msg || "Synthesizing market intelligence..."}
                </p>
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                    <Activity className="w-3 h-3" />
                    ARI: {analysis.ari?.toFixed(1)}
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                    <Shield className="w-3 h-3" />
                    Market Pulse: {analysis.quadrant_label}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* ── SECTION 2: STRATEGIC MAP ──                 */}
        {/* ═══════════════════════════════════════════════ */}
        {strategicMap && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-10 glass-card border border-white/[0.08] relative overflow-hidden group min-h-[400px]"
          >
            <div className="absolute top-0 right-0 p-4 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity duration-500">
              <Brain className="w-16 h-16 text-blue-300" />
            </div>
            <div className="p-6 pb-0">
              <h3 className="text-lg font-bold text-white/90 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                </div>
                {t("reports.quadrantTitle")}
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 ml-11">
                {t("reports.quadrantDesc")}
              </p>
            </div>
            <AdvisorQuadrant
              x={strategicMap.x}
              y={strategicMap.y}
              label={strategicMap.label}
              ari={strategicMap.ari}
              sentiment={strategicMap.sentiment}
              targetRating={strategicMap.targetRating}
              marketRating={strategicMap.marketRating}
              compact
            />
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* ── SECTION 3: CHARTS (Market Position + Trend) */}
        {/* ═══════════════════════════════════════════════ */}
        {analysis && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            {/* Market Position */}
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="lg:col-span-1 glass-card p-6 flex flex-col"
            >
              <div className="mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[var(--soft-gold)]" />
                  {t("reports.marketPosition")}
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {t("reports.positionDesc")}
                </p>
              </div>
              <div className="flex-1 min-h-[250px]">
                <MarketPositionChart
                  data={{
                    min: analysis.market_min,
                    avg: analysis.market_average,
                    max: analysis.market_max,
                    myPrice: analysis.target_price || null,
                  }}
                  currency={analysis.display_currency || currency || "USD"}
                />
              </div>
            </motion.div>

            {/* Price Trend */}
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="lg:col-span-2 glass-card p-6 flex flex-col"
            >
              <div className="mb-6 flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[var(--soft-gold)]" />
                    {t("reports.priceVelocity")}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {t("reports.velocityDesc")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-white">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency:
                        analysis.display_currency || currency || "USD",
                      minimumFractionDigits: 0,
                    }).format(analysis.target_price || 0)}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest">
                    {t("hotelDetails.current")}
                  </p>
                </div>
              </div>
              <div className="flex-1 min-h-[250px]">
                <PriceTrendChart
                  history={analysis.price_history}
                  currency={
                    analysis.display_currency || currency || "USD"
                  }
                />
              </div>
            </motion.div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* ── SECTION 4: EXPERIENCE SCORECARD ──          */}
        {/* ═══════════════════════════════════════════════ */}
        {hasSentiment && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="glass-card p-6 md:p-8 mb-10 border border-white/[0.06]"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-white/90 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Radar className="w-4 h-4 text-blue-400" />
                </div>
                Experience Scorecard
              </h3>
              {leader?.isTarget && (
                <div className="flex items-center gap-2 bg-amber-500/10 text-amber-400 px-3 py-1.5 rounded-xl text-xs font-bold border border-amber-500/15">
                  <Trophy className="w-3 h-3" />
                  Market Leader
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              {["Cleanliness", "Service", "Location", "Value"].map((cat) => (
                <ExperienceBar
                  key={cat}
                  category={cat}
                  myScore={getCategoryScore(targetHotel, cat.toLowerCase())}
                  leaderScore={leader ? getCategoryScore(leader, cat.toLowerCase()) : 0}
                  marketAvg={marketAvgRating || 3}
                  leaderName={leader?.name}
                  t={t}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* ── SECTION 5: COMPETITIVE BATTLEFIELD ──       */}
        {/* ═══════════════════════════════════════════════ */}
        {competitors.length > 0 && hasSentiment && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="glass-card mb-10 border border-white/[0.06] overflow-hidden"
          >
            <div className="p-6 border-b border-white/[0.06]">
              <h3 className="text-lg font-bold text-white/90 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Swords className="w-4 h-4 text-red-400" />
                </div>
                Competitive Battlefield
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 ml-11">
                Each competitor&apos;s weakest area &amp; your advantage
              </p>
            </div>

            <CompetitiveBattlefield
              targetHotel={targetHotel}
              competitors={competitors}
              currency={currency}
              t={t}
            />
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* ── SECTION 6: SCAN HISTORY (Collapsible) ──    */}
        {/* ═══════════════════════════════════════════════ */}
        <div className="glass-card overflow-hidden border border-white/[0.06]">
          <button
            onClick={() => setScanHistoryOpen(!scanHistoryOpen)}
            className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-[var(--soft-gold)]" />
              <h2 className="text-base font-bold text-white">
                {t("reports.fullHistoryLog")}
              </h2>
              <span className="text-[10px] font-bold text-[var(--text-muted)] bg-white/5 px-2 py-0.5 rounded-full">
                {data?.sessions?.length || 0} sessions
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest italic">
                {scanHistoryOpen ? "Collapse" : "Expand"}
              </span>
              {scanHistoryOpen ? (
                <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
              )}
            </div>
          </button>

          {scanHistoryOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="overflow-x-auto border-t border-white/[0.06]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/[0.02] border-b border-white/5">
                      <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                        {t("reports.timestamp")}
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                        {t("reports.sessionType")}
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                        {t("reports.status")}
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                        {t("reports.hotelsScanned")}
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest text-right">
                        {t("reports.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data?.sessions?.map((session: any) => (
                      <tr
                        key={session.id}
                        className="hover:bg-white/[0.02] transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-white">
                            {new Date(session.created_at).toLocaleDateString(
                              locale === "en" ? "en-US" : "tr-TR"
                            )}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] font-medium">
                            {new Date(session.created_at).toLocaleTimeString(
                              locale === "en" ? "en-US" : "tr-TR"
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-white/5 text-white">
                            {session.session_type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {session.status === "completed" ? (
                              <CheckCircle2 className="w-4 h-4 text-[var(--optimal-green)]" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-amber-500" />
                            )}
                            <span className="text-xs font-bold text-white capitalize">
                              {session.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-black text-white">
                            {session.hotels_count}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] ml-1 font-bold uppercase">
                            {t("reports.propertiesLabel")}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleOpenSession(session)}
                            className="p-2 rounded-lg bg-white/5 group-hover:bg-[var(--soft-gold)] group-hover:text-[var(--deep-ocean)] transition-all"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
