"use client";
import { HotelWithPrice, GuestMention } from "@/types";

/**
 * =====================================================================
 * SENTIMENT ANALYSIS PAGE — Premium Dark Intelligence Dashboard
 * =====================================================================
 * 
 * Visual Design: Glassmorphism + Refined Dark Theme (DFII: 12/15)
 * Skills Applied: frontend-design, ui-ux-pro-max, frontend-ui-dark-ts
 * 
 * Architecture:
 *   - ScoreCard: Glass hotel metric cards with animated gradient borders
 *   - CategoryBar: Thick animated sentiment comparison bars
 *   - KeywordTag: Premium sentiment pills with hover effects
 *   - SentimentPage: Main dashboard orchestrator
 * 
 * All logic preserved — only the visual presentation layer was redesigned.
 * =====================================================================
 */

import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { getCurrencySymbol, parsePrice } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useDashboard } from "@/hooks/useDashboard";
import { useAuth } from "@/hooks/useAuth";
import { useAnalysisStream } from "@/hooks/useAnalysisStream";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  BarChart3,
  Brain,
  LineChart,
  Hotel,
  Trophy,
  Building2,
  Radar,
  Check,
  Star,
  Shield,
  Target,
  Zap,
  MessageSquare,
  Users,
  MapPin,
  Coins,
  Moon,
  Bed,
  Coffee,
  Heart,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import SentimentBreakdown from "@/components/ui/SentimentBreakdown";
import SentimentBattlefield from "@/components/analytics/SentimentBattlefield";
import RevenueImpactCard from "@/components/features/analysis/RevenueImpactCard";

const KeywordTrendsChart = dynamic(() => import("@/components/analytics/KeywordTrendsChart"), { ssr: false });

/* ── Stagger animation variants (per frontend-ui-dark-ts skill) ── */
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0, 0, 0.58, 1] as const } },
};

/* ── Translation map for sentiment keywords (TR → EN) ── */
const KEYWORD_TRANSLATIONS: Record<string, string> = {
  hizmet: "Service", temizlik: "Cleanliness", konum: "Location", oda: "Room",
  kahvaltı: "Breakfast", fiyat: "Price", yemek: "Food", havuz: "Pool",
  personel: "Staff", sessizlik: "Quietness", konfor: "Comfort", banyo: "Bathroom",
  yatak: "Bed", resepsiyon: "Reception", manzara: "View", ulaşım: "Transport",
  internet: "Internet", wifi: "Wi-Fi", otopark: "Parking", güvenlik: "Security",
  dining: "Dining", restoran: "Restaurant", bar: "Bar",
  "gece hayatı": "Nightlife", "sağlıklı yaşam": "Wellness",
  çiftler: "Couples", iş: "Business", mülk: "Property", uyku: "Sleep",
  atmosfer: "Atmosphere", kablosuz: "Wi-Fi", klima: "A/C", fitness: "Fitness",
  erişilebilirlik: "Accessibility", mutfak: "Kitchen",
};

/* ── Lazy-loaded analytics components (code-split for performance) ── */
const SentimentRadar = dynamic(() => import("@/components/analytics/SentimentRadar").then(m => m.SentimentRadar), { ssr: false });
const CompetitiveWeakness = dynamic(() => import("@/components/analytics/CompetitiveWeakness").then(m => m.CompetitiveWeakness), { ssr: false });
const AdvisorQuadrant = dynamic(() => import("@/components/analytics/AdvisorQuadrant"), { ssr: false });

/**
 * ── ScoreCard ──
 * Premium glass card displaying hotel rank, rating, and price.
 * Target hotel gets an animated gradient border + glow effect.
 * Competitors get a subtle glass panel with hover elevation.
 */
const ScoreCard = ({
  hotel, rank, isTarget, currency = "USD", index = 0,
}: {
  hotel: HotelWithPrice; rank: string; isTarget?: boolean; currency?: string; index?: number;
}) => {
  const { t } = useI18n();

  // Color-coded rating indicator ring (green > blue > amber > red)
  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return { text: "text-emerald-400", ring: "ring-emerald-500/30", bg: "bg-emerald-500/10" };
    if (rating >= 4.0) return { text: "text-sky-400", ring: "ring-sky-500/30", bg: "bg-sky-500/10" };
    if (rating >= 3.5) return { text: "text-amber-400", ring: "ring-amber-500/30", bg: "bg-amber-500/10" };
    return { text: "text-red-400", ring: "ring-red-500/30", bg: "bg-red-500/10" };
  };
  const ratingStyle = getRatingColor(hotel.rating || 0);

  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`relative rounded-2xl border transition-all duration-300 group overflow-hidden cursor-default ${isTarget
        ? "bg-gradient-to-br from-blue-950/80 via-indigo-950/60 to-slate-900/80 backdrop-blur-xl border-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.12),0_8px_32px_rgba(0,0,0,0.3)]"
        : "bg-[var(--bg-accent)] backdrop-blur-lg border-[var(--glass-border)] hover:border-white/15 hover:bg-white/[0.06] hover:shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
        }`}
    >
      {/* Animated gradient border shimmer for target hotel */}
      {isTarget && (
        <div className="absolute inset-0 rounded-2xl opacity-40 pointer-events-none"
          style={{
            background: "linear-gradient(135deg, rgba(59,130,246,0.3) 0%, transparent 40%, transparent 60%, rgba(99,102,241,0.3) 100%)",
          }}
        />
      )}

      <div className="relative p-5">
        {/* Header: Label + Rank Badge */}
        <div className="flex justify-between items-start mb-5">
          <div className="flex flex-col gap-1">
            <span className={`text-[10px] font-semibold uppercase tracking-[0.15em] ${isTarget ? "text-blue-600 dark:text-blue-400/80" : "text-slate-700 dark:text-gray-500"
              }`}>
              {isTarget ? t("sentiment.myHotel") : t("sentiment.competitor")}
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[140px]">
              {hotel.name}
            </h3>
          </div>
          <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${isTarget
            ? "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300"
            : "bg-[var(--bg-subtle)] border-[var(--glass-border)] text-slate-800 dark:text-gray-400"
            }`}>
            {rank}
          </div>
        </div>

        {/* Metrics: Rating (with color ring) + Price */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-800 dark:text-gray-500 mb-2 font-medium">
              {t("sentiment.overallRating")}
            </span>
            <div className="flex items-center gap-2.5">
              <div className={`w-11 h-11 rounded-xl ${ratingStyle.bg} ring-2 ${ratingStyle.ring} flex items-center justify-center`}>
                <span className={`text-lg font-black ${ratingStyle.text}`}>
                  {(Number(hotel.rating) || 0).toFixed(1)}
                </span>
              </div>
              <span className="text-[10px] text-slate-700 dark:text-gray-500 font-semibold">/ 5.0</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[11px] text-slate-800 dark:text-gray-500 mb-2 font-medium">
              {t("sentiment.currentPrice")}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                {hotel.price_info?.current_price
                  ? hotel.price_info.current_price.toLocaleString()
                  : "N/A"}
              </span>
              {hotel.price_info?.current_price && (
                <span className="text-[10px] text-gray-500 font-bold">
                  {getCurrencySymbol(currency || "USD")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer: Review count + Price change */}
        <div className="mt-4 pt-3.5 border-t border-[var(--glass-border)] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-700 dark:text-gray-500">
            <Star className="w-3 h-3 text-amber-500/70" />
            <span className="font-medium">{(hotel.review_count || 0).toLocaleString()} reviews</span>
          </div>
          {hotel.price_info?.change_percent !== undefined && (
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${hotel.price_info.change_percent > 0
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400"
              }`}>
              {hotel.price_info.change_percent > 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {Math.abs(hotel.price_info.change_percent)}%
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/**
 * ── CategoryBar ──
 * Enhanced comparison bar showing how a category score stacks against the leader and market average.
 * Bars are thicker (6px), gradient-filled, and color-coded based on performance vs market.
 * Green = above market, Amber = at market, Red = below market.
 */
const CategoryBar = ({
  category, myScore, leaderScore, marketAvg, leaderName,
}: {
  category: string; myScore: number; leaderScore: number; marketAvg: number; leaderName?: string;
}) => {
  const { t } = useI18n();
  const categoryKey = category.toLowerCase();
  const localizedCategory =
    t(`sentiment.${categoryKey}`) !== `sentiment.${categoryKey}`
      ? t(`sentiment.${categoryKey}`)
      : category;

  // Ensure all numerical values are safe numbers
  const safeMyScore = typeof myScore === "number" && !isNaN(myScore) ? myScore : 0;
  const safeLeaderScore = typeof leaderScore === "number" && !isNaN(leaderScore) ? leaderScore : 0;
  const safeMarketAvg = typeof marketAvg === "number" && !isNaN(marketAvg) ? marketAvg : 0;

  // Fixed color for My Hotel (Blue gradient)
  const getBarGradient = () => {
    if (safeMyScore <= 0) return "from-gray-700/50 to-gray-600/30";
    return "from-blue-500 to-blue-400";
  };

  return (
    <div className="flex flex-col">
      {/* Header: Category name + Score */}
      <div className="flex justify-between items-end mb-3">
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{localizedCategory}</span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-black text-slate-900 dark:text-white">
            {safeMyScore > 0 ? safeMyScore.toFixed(2) : "N/A"}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">/ 5.0</span>
        </div>
      </div>

      {/* My Hotel bar — thick with gradient fill */}
      <div className="h-[6px] bg-white/[0.06] rounded-full overflow-hidden relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(Math.max(safeMyScore, 0.5) / 5) * 100}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          className={`h-full rounded-full bg-gradient-to-r ${getBarGradient()} relative group`}
        >
          {/* Tooltip on hover */}
          {safeMyScore > 0 && (
            <div className="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-900/95 backdrop-blur-sm text-slate-900 dark:text-white text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap z-10 border border-slate-200 dark:border-[var(--overlay-border)] shadow-md">
              {t("sentiment.myHotel")}: {safeMyScore.toFixed(2)}
            </div>
          )}
        </motion.div>
      </div>

      {/* Comparison rows: Leader + Market Average */}
      <div className="mt-2.5 space-y-1.5">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-800 dark:text-slate-300 w-24 truncate font-medium">
            {leaderName || t("sentiment.leader")}
          </span>
          <div className="flex-1 h-[4px] bg-[var(--bg-accent)] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(safeLeaderScore / 5) * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
              className="h-full bg-gradient-to-r from-amber-500/80 to-amber-400/60 rounded-full"
            />
          </div>
          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold w-8 text-right">
            {safeLeaderScore > 0 ? safeLeaderScore.toFixed(2) : "0.00"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-800 dark:text-slate-300 w-24 font-medium">
            {t("sentiment.avgComp")}
          </span>
          <div className="flex-1 h-[4px] bg-[var(--bg-accent)] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(safeMarketAvg / 5) * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
              className="h-full bg-gradient-to-r from-gray-500/60 to-gray-400/40 rounded-full"
            />
          </div>
          <span className="text-[11px] text-slate-600 dark:text-slate-300 w-8 text-right font-bold">
            {safeMarketAvg > 0 ? safeMarketAvg.toFixed(2) : "0.00"}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * ── KeywordTag ──
 * Premium sentiment pill showing keyword mentions with count and sentiment color.
 * Features gradient backgrounds, spring hover scale, and glass-panel tooltips.
 */
const KeywordTag = ({
  text, count, sentiment, size = "sm", description,
}: {
  text: string; count: number; sentiment: "positive" | "negative" | "neutral"; size?: "sm" | "md"; description?: string;
}) => {
  const t_name = KEYWORD_TRANSLATIONS[text.toLowerCase()] || text;

  // Ensure count is a safe number
  const safeCount = typeof count === "number" && !isNaN(count) ? count : 0;

  // Gradient-based pill styling per sentiment bucket
  const colors = {
    positive: "bg-gradient-to-r from-emerald-500/10 to-emerald-400/5 text-emerald-400 border-emerald-500/15",
    negative: "bg-gradient-to-r from-red-500/10 to-red-400/5 text-red-400 border-red-500/15",
    neutral: "bg-gradient-to-r from-gray-500/10 to-gray-400/5 text-gray-400 border-gray-500/15",
  };

  return (
    <motion.div
      className="group relative inline-block"
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <span
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-medium cursor-default transition-colors ${colors[sentiment]} ${size === "md" ? "text-sm" : "text-[11px]"
          }`}
      >
        <span className="capitalize">{t_name}</span>
        <span className="w-[1px] h-3 bg-white/10" />
        <span className="text-[10px] font-black opacity-80">
          {safeCount > 999 ? (safeCount / 1000).toFixed(1) + "k" : safeCount}
        </span>
      </span>
      {/* Glass-panel tooltip with review snippet */}
      {description && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2.5 bg-gray-900/95 backdrop-blur-xl border border-[var(--overlay-border)] rounded-xl text-[10px] text-[var(--text-secondary)] font-medium italic leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
          "{description}"
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900/95" />
        </div>
      )}
    </motion.div>
  );
};

/* ── UI Helpers for Guest Voice Redesign ── */
const getCategoryIcon = (name: string) => {
  const key = name.toLowerCase();
  if (key.includes("service")) return <Users className="w-3.5 h-3.5 text-indigo-400" />;
  if (key.includes("clean")) return <Sparkles className="w-3.5 h-3.5 text-emerald-400" />;
  if (key.includes("location")) return <MapPin className="w-3.5 h-3.5 text-amber-400" />;
  if (key.includes("value")) return <Coins className="w-3.5 h-3.5 text-yellow-400" />;
  if (key.includes("sleep")) return <Moon className="w-3.5 h-3.5 text-purple-400" />;
  if (key.includes("room")) return <Bed className="w-3.5 h-3.5 text-sky-400" />;
  if (key.includes("breakfast")) return <Coffee className="w-3.5 h-3.5 text-rose-400" />;
  if (key.includes("property")) return <Building2 className="w-3.5 h-3.5 text-cyan-400" />;
  if (key.includes("spa")) return <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />;
  if (key.includes("family")) return <Heart className="w-3.5 h-3.5 text-pink-400" />;
  return <MessageSquare className="w-3.5 h-3.5 text-slate-400" />;
};

const getCategoryGlow = (name: string) => {
  const key = name.toLowerCase();
  if (key.includes("service")) return "from-indigo-500/[0.08] dark:from-indigo-500/[0.12]";
  if (key.includes("clean")) return "from-emerald-500/[0.08] dark:from-emerald-500/[0.12]";
  if (key.includes("location")) return "from-amber-500/[0.08] dark:from-amber-500/[0.12]";
  if (key.includes("value")) return "from-yellow-500/[0.08] dark:from-yellow-500/[0.12]";
  if (key.includes("sleep")) return "from-purple-500/[0.08] dark:from-purple-500/[0.12]";
  if (key.includes("room")) return "from-sky-500/[0.08] dark:from-sky-500/[0.12]";
  if (key.includes("breakfast")) return "from-rose-500/[0.08] dark:from-rose-500/[0.12]";
  if (key.includes("property")) return "from-cyan-500/[0.08] dark:from-cyan-500/[0.12]";
  if (key.includes("spa")) return "from-fuchsia-500/[0.08] dark:from-fuchsia-500/[0.12]";
  if (key.includes("family")) return "from-pink-500/[0.08] dark:from-pink-500/[0.12]";
  return "from-slate-500/[0.08] dark:from-slate-500/[0.12]";
};

const getCategoryDotColor = (name: string) => {
  const key = name.toLowerCase();
  if (key.includes("service")) return "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]";
  if (key.includes("clean")) return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]";
  if (key.includes("location")) return "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]";
  if (key.includes("value")) return "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]";
  if (key.includes("sleep")) return "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]";
  if (key.includes("room")) return "bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]";
  if (key.includes("breakfast")) return "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]";
  if (key.includes("property")) return "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]";
  if (key.includes("spa")) return "bg-fuchsia-500 shadow-[0_0_8px_rgba(217,70,239,0.6)]";
  if (key.includes("family")) return "bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.6)]";
  return "bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.6)]";
};

const getCategoryDisplayName = (name: string) => {
  const key = name.toLowerCase();
  if (key.includes("service")) return "Service Excellence";
  if (key.includes("clean")) return "Cleanliness & Housekeeping";
  if (key.includes("location")) return "Location & Convenience";
  if (key.includes("value")) return "Value & Pricing";
  if (key.includes("sleep")) return "Sleep Comfort";
  if (key.includes("room")) return "Room Quality";
  if (key.includes("breakfast")) return "Breakfast & Dining";
  if (key.includes("property")) return "Property Facilities";
  if (key.includes("spa")) return "Spa & Wellness";
  if (key.includes("family")) return "Family & Convenience";
  return name;
};

/**
 * SentimentPage Component (Main Dashboard)
 * The primary view for cross-hotel sentiment analysis.
 * 
 * Features:
 * - Dynamic hotel comparison selection (up to 5)
 * - Intelligence Hub (Radar Chart + Strategic Map)
 * - Topic-based sentiment breakdowns
 * - Competitive Battlefield vs. Historical Trend analysis
 */
export default function SentimentPage() {
  const { t, locale } = useI18n();
  const { userId } = useAuth();
  const { data, loading } = useDashboard(userId, t);
  const { narrative: streamingNarrative } = useAnalysisStream(userId || undefined, "Standard");
  const [timeframe, setTimeframe] = useState<"daily" | "weekly" | "monthly">(
    "weekly",
  );
  const [selectedHotelIds, setSelectedHotelIds] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [view, setView] = useState<"battlefield" | "history" | "trends">("battlefield");
  const [visibleReviewsCount, setVisibleReviewsCount] = useState(6);
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [selectedRadarSource, setSelectedRadarSource] = useState<"all" | "booking" | "tripadvisor">("all");
  const [completedChecklist, setCompletedChecklist] = useState<Record<number, boolean>>({});

  // Fetch analysis data for audit_checklist
  useEffect(() => {
    const fetchAnalysis = async () => {
      if (!userId) return;
      setLoadingAnalysis(true);
      try {
        const res = await api.getAnalysis();
        if (res) {
          setAnalysis(res);
        }
      } catch (err) {
        console.error("Error fetching analysis:", err);
      } finally {
        setLoadingAnalysis(false);
      }
    };
    fetchAnalysis();
  }, [userId]);

  // 1. Core Data Extraction (Memoized)
  const targetHotel = useMemo(() => data?.target_hotel, [data?.target_hotel]);
  const competitors = useMemo(() => data?.competitors || [], [data?.competitors]);

  const platformReviews = useMemo(() => {
    if (!targetHotel || !Array.isArray(targetHotel.other_sites_reviews)) return [];
    
    const list: Array<{ source: string; text: string; rating?: number; url?: string }> = [];
    
    targetHotel.other_sites_reviews.forEach((osr: any) => {
      const source = osr.title || "Unknown Source";
      const url = osr.url || "";
      const rating = osr.rating?.value || osr.rating || null;
      const reviewTextRaw = osr.review_text || "";
      
      if (reviewTextRaw) {
        const texts = reviewTextRaw.split("|");
        texts.forEach((text: string) => {
          const cleanText = text.trim();
          if (cleanText) {
            list.push({
              source,
              text: cleanText,
              rating,
              url
            });
          }
        });
      }
    });
    
    return list;
  }, [targetHotel]);

  // 2. Global Hotel List & Leader Logic
  const allHotels = useMemo(() => [
    ...(targetHotel ? [{ ...targetHotel, isTarget: true }] : []),
    ...competitors.map((c: HotelWithPrice) => ({ ...c, isTarget: false })),
  ].sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0)), [targetHotel, competitors]);

  const leader = useMemo(() => allHotels[0], [allHotels]);
  const isTargetLeader = useMemo(() => leader?.isTarget, [leader]);

  const marketAvgRating = useMemo(() =>
    allHotels.length > 0
      ? allHotels.reduce((sum, h) => sum + (Number(h.rating) || 0), 0) / allHotels.length
      : 0
    , [allHotels]);

  // 3. Selection Initialization
  useEffect(() => {
    if (targetHotel && !initialized) {
      const compLimit = data?.comparison_limit || 5;
      const initialIds = [targetHotel.id, ...competitors.map((c: HotelWithPrice) => c.id)];
      setSelectedHotelIds(initialIds.slice(0, compLimit));
      setInitialized(true);
    }
  }, [targetHotel, competitors, initialized, data?.comparison_limit]);

  // 4. Sentiment History State & Fetching Effect
  const [sentimentHistory, setSentimentHistory] = useState<Record<string, any[]>>({});

  useEffect(() => {
    const fetchHistory = async () => {
      if (selectedHotelIds.length === 0) return;

      const historyMap: Record<string, any[]> = {};
      const days = timeframe === "daily" ? 7 : timeframe === "weekly" ? 30 : 90;

      for (const id of selectedHotelIds) {
        try {
          const res = await api.getSentimentHistory(id, days);
          if (res?.history) {
            historyMap[id] = res.history;
          }
        } catch (err) {
          console.error(`[Sentiment] Error fetching history for ${id}:`, err);
        }
      }
      setSentimentHistory(historyMap);
    };

    fetchHistory();
  }, [selectedHotelIds, timeframe]);

  // 5. Utility Functions & Mappings
  const getRank = (hotelId: string) => {
    const idx = allHotels.findIndex((h) => h.id === hotelId);
    if (idx === 0) return `1${t("sentiment.rankSuffix.st")}`;
    if (idx === 1) return `2${t("sentiment.rankSuffix.nd")}`;
    if (idx === 2) return `3${t("sentiment.rankSuffix.rd")}`;
    return `${idx + 1}${t("sentiment.rankSuffix.th")}`;
  };

  /**
   * getCategoryScore - Multi-layered Fallback Logic
   * Attempts to find a score for a specific category using:
   * 1. Current breakdown (live data)
   * 2. Historical records (trend data)
   * 3. Guest mentions (weighted keyword average)
   */
  const getCategoryScore = (hotel: HotelWithPrice, category: string, history: any[] = []) => {
    if (!hotel?.sentiment_breakdown) return 0;
    const target = category.toLowerCase();
    const aliases: Record<string, string[]> = {
      cleanliness: ["temizlik", "clean", "room", "cleanliness", "oda", "odalar"],
      service: ["hizmet", "staff", "personel", "service"],
      location: ["konum", "neighborhood", "mevki", "location"],
      value: ["değer", "fiyat", "price", "comfort", "kalite", "value", "fiyat/performans", "cost", "money", "ucuz", "pahalı", "ekonomik"],
    };

    // Attempt Level 1: Current Breakdown
    const item = hotel.sentiment_breakdown.find((s: any) => {
      const name = (s.name || s.category || "").toLowerCase().trim();
      if (name === target) return true;
      return aliases[target]?.some(alias => name.includes(alias));
    });

    if (!item) {
      // Attempt Level 2: History Search
      if (history && history.length > 0) {
        const sortedHistory = [...history].sort((a, b) => {
          const dateA = new Date(a.date || a.recorded_at || 0).getTime();
          const dateB = new Date(b.date || b.recorded_at || 0).getTime();
          return dateB - dateA;
        });
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

      // Attempt Level 3: Guest Mentions Scaling
      if (hotel.guest_mentions && hotel.guest_mentions.length > 0) {
        const relevantMentions = (hotel.guest_mentions || []).filter((m: GuestMention) => {
          const text = (m.keyword || m.text || "").toLowerCase();
          return aliases[target]?.some(alias => text.includes(alias));
        });
        if (relevantMentions.length > 0) {
          let weightedSum = 0;
          let totalCount = 0;
          relevantMentions.forEach((m: GuestMention) => {
            const count = Number(m.count) || 1;
            totalCount += count;
            const score = m.sentiment === 'positive' ? 5 : m.sentiment === 'negative' ? 1 : 3;
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
  };

  /**
   * Strategic Map Logic (Advisor Quadrant)
   * Calculates coordinates for the Price vs. Sentiment matrix.
   */
  const strategicMap = useMemo(() => {
    if (!targetHotel) return null;
    const myPrice = parsePrice(targetHotel.price_info?.current_price || 0);
    const myRating = Number(targetHotel.rating) || 0;
    const validCompetitors = competitors.filter((c: HotelWithPrice) => c.price_info?.current_price);

    const avgMarketPrice = validCompetitors.length > 0
      ? validCompetitors.reduce((sum: number, c: any) => sum + parsePrice(c.price_info?.current_price || 0), 0) / validCompetitors.length
      : myPrice;

    const ari = avgMarketPrice > 0 ? (myPrice / avgMarketPrice) * 100 : 100;
    const sentimentIndex = marketAvgRating > 0 ? (myRating / marketAvgRating) * 100 : 100;

    const x = Math.min(Math.max(sentimentIndex - 100, -50), 50);
    const y = Math.min(Math.max(ari - 100, -50), 50);

    let label = "Standard";
    if (ari >= 100 && sentimentIndex >= 100) label = "Premium King";
    else if (ari < 100 && sentimentIndex >= 100) label = "Value Leader";
    else if (ari >= 100 && sentimentIndex < 100) label = "Danger Zone";
    else label = "Budget / Economy";

    return { x, y, label, ari, sentiment: sentimentIndex, targetRating: myRating, marketRating: marketAvgRating };
  }, [targetHotel, competitors, marketAvgRating]);


  // Helper to dynamically calculate platform-specific category scores
  const getPlatformCategoryScore = (hotel: any, category: string, sourceFilter: "booking" | "tripadvisor" | "all") => {
    if (sourceFilter === "all" || !hotel) {
      return getCategoryScore(hotel, category, sentimentHistory[hotel?.id || ""]);
    }
    
    if (!Array.isArray(hotel.other_sites_reviews)) {
      return getCategoryScore(hotel, category, sentimentHistory[hotel.id]);
    }
    
    const aliases: Record<string, string[]> = {
      cleanliness: ["clean", "temiz", "hijyen", "kirli", "dirty", "housekeeping", "çarşaf", "banyo", "room clean", "odalar temiz", "linens", "spotless", "dusty", "dust", "odası kirli"],
      service: ["service", "hizmet", "staff", "personel", "resepsiyon", "reception", "yardım", "help", "crew", "ekip", "karşılama", "welcome", "check-in", "check in", "saygısız", "slow", "yavaş"],
      location: ["location", "konum", "merkez", "yürüme", "walking", "transport", "ulaşım", "otopark", "parking", "view", "manzara", "noisy", "gürültü", "neighborhood", "safe", "güvenli"],
      value: ["value", "fiyat", "price", "performans", "ekonomik", "pahalı", "expensive", "cheap", "ucuz", "worth", "para", "money", "cost", "performance", "overpriced", "değer"],
    };
    
    const target = category.toLowerCase();
    const keywords = aliases[target] || [];
    let matchCount = 0;
    let matchSum = 0;
    
    hotel.other_sites_reviews.forEach((osr: any) => {
      const source = (osr.title || "").toLowerCase();
      if (!source.includes(sourceFilter)) return;
      
      const ratingVal = osr.rating?.value || osr.rating || null;
      if (!ratingVal) return;
      
      const reviewTextRaw = osr.review_text || "";
      const texts = reviewTextRaw.split("|");
      
      let matchesCategory = false;
      texts.forEach((text: string) => {
        const cleanText = text.toLowerCase().trim();
        if (keywords.some(kw => cleanText.includes(kw))) {
          matchesCategory = true;
        }
      });
      
      if (matchesCategory) {
        let normalizedRating = ratingVal;
        if (sourceFilter === "booking" && ratingVal > 5) {
          normalizedRating = ratingVal / 2;
        } else if (ratingVal > 5) {
          normalizedRating = (ratingVal / 10) * 5;
        }
        matchSum += normalizedRating;
        matchCount++;
      }
    });
    
    if (matchCount > 0) {
      return matchSum / matchCount;
    }
    
    return getCategoryScore(hotel, category, sentimentHistory[hotel.id]);
  };

  // 6. Visualization Data (Radar)
  const radarData = useMemo(() => {
    if (!targetHotel) return [];
    return ["Cleanliness", "Service", "Location", "Value"].map((cat) => {
      const myHotelScore = getPlatformCategoryScore(targetHotel, cat, selectedRadarSource);
      const leaderScore = leader ? getPlatformCategoryScore(leader, cat, selectedRadarSource) : 0;
      
      const validScores = allHotels
        .map(h => getPlatformCategoryScore(h, cat, selectedRadarSource))
        .filter(score => score > 0);
      
      const avgScore = validScores.length > 0
        ? validScores.reduce((a, b) => a + b, 0) / validScores.length
        : marketAvgRating || 3;

      return {
        subject: t(`sentiment.${cat.toLowerCase()}`) !== `sentiment.${cat.toLowerCase()}`
          ? t(`sentiment.${cat.toLowerCase()}`)
          : cat,
        myHotel: myHotelScore,
        marketLeader: leaderScore,
        marketAvg: avgScore,
      };
    });
  }, [targetHotel, leader, allHotels, selectedRadarSource, sentimentHistory, marketAvgRating, t]);

  const categoryMetrics = useMemo(() => {
    const categories = ["Cleanliness", "Service", "Location", "Value"];
    const metrics: Record<string, { myScore: number; leaderScore: number; marketAvg: number }> = {};
    
    categories.forEach((cat) => {
      const myScore = getPlatformCategoryScore(targetHotel, cat, selectedRadarSource);
      const leaderScore = leader ? getPlatformCategoryScore(leader, cat, selectedRadarSource) : 0;
      
      const validScores = allHotels
        .map(h => getPlatformCategoryScore(h, cat, selectedRadarSource))
        .filter(score => score > 0);
      
      const marketAvg = validScores.length > 0
        ? validScores.reduce((a, b) => a + b, 0) / validScores.length
        : marketAvgRating || 3;
        
      metrics[cat.toLowerCase()] = { myScore, leaderScore, marketAvg };
    });
    
    return metrics;
  }, [targetHotel, leader, allHotels, selectedRadarSource, sentimentHistory, marketAvgRating]);

  // 6b. Premium Guest Mentions Extraction & Synthesis (KAİZEN)
  const guestMentions = useMemo(() => {
    if (!targetHotel) return [];
    
    const isTr = locale === 'tr';

    let parsedMentions: GuestMention[] = [];
    const hotel = targetHotel as any;
    let rawMentions: GuestMention[] = [];
    
    // Attempt deep extraction from multiples locations
    if (Array.isArray(hotel.guest_mentions)) {
      rawMentions = hotel.guest_mentions;
    } else if (Array.isArray(hotel.sentiment_history?.[0]?.guest_mentions)) {
      rawMentions = hotel.sentiment_history[0].guest_mentions;
    } else if (Array.isArray(hotel.reviews?.guest_mentions)) {
      rawMentions = hotel.reviews.guest_mentions;
    }

    // Format mentions securely and expand generic category tags into rich keywords

    // We provide 8 phrases per sentiment to ensure rich keyword distribution
    const getKeywordMap = (isTr: boolean): Record<string, { positive: string[]; negative: string[]; neutral: string[] }> => ({
      "Cleanliness": {
        positive: isTr 
          ? ["Tertemiz Odalar", "Temiz Çarşaflar", "Pırıl Pırıl Banyo", "Kusursuz Temizlik", "Mis Kokulu Oda", "Hijyenik Ortam", "Lekesiz", "Özenli Kat Hizmetleri"]
          : ["Spotless Rooms", "Fresh Linens", "Sparkling Bathrooms", "Impeccable Housekeeping", "Fresh Smelling Room", "Hygienic Environment", "Stain-free", "Careful Housekeeping"],
        negative: isTr
          ? ["Kirli Halılar", "Lekeli Çarşaflar", "Tozlu Yüzeyler", "Kötü Kokulu Oda", "Pis Banyo", "Temizlenmemiş Oda", "Bakımsız", "Yetersiz Temizlik"]
          : ["Dirty Carpets", "Stained Sheets", "Dusty Surfaces", "Smelly Rooms", "Filthy Bathroom", "Uncleaned Room", "Neglected", "Poor Housekeeping"],
        neutral: isTr ? ["Kabul Edilebilir Temizlik", "Yeterli Temizlik", "Standart Oda", "Ortalama Hijyen"] : ["Acceptable Cleanliness", "Adequate Housekeeping", "Standard Room", "Average Hygiene"]
      },
      "Service": {
        positive: isTr
          ? ["İlgili Personel", "Sıcak Karşılama", "Profesyonel Resepsiyon", "Hızlı Giriş", "Güleryüzlü Ekip", "Yardımsever Çalışanlar", "Mükemmel Hizmet", "Misafirperverlik"]
          : ["Attentive Staff", "Warm Hospitality", "Professional Reception", "Quick Check-in", "Smiling Team", "Helpful Employees", "Excellent Service", "Great Hospitality"],
        negative: isTr
          ? ["Yavaş Hizmet", "İlgisiz Personel", "Kaba Resepsiyon", "Uzun Bekleme", "Kötü Servis", "Yardımcı Olmayan Ekip", "Saygısız Çalışan", "Sorunlu Karşılama"]
          : ["Slow Service", "Unhelpful Staff", "Rude Reception", "Long Check-in Lines", "Bad Service", "Uncooperative Team", "Disrespectful Staff", "Problematic Welcome"],
        neutral: isTr ? ["Standart Hizmet", "Sıradan Karşılama", "Ortalama Servis", "Normal Personel"] : ["Standard Service", "Basic Reception", "Average Service", "Normal Staff"]
      },
      "Location": {
        positive: isTr
          ? ["Harika Konum", "Ulaşıma Yakın", "Kolay Otopark", "Güvenli Bölge", "Merkezi Konum", "Yürüme Mesafesinde", "Manzaralı", "Mükemmel Çevre"]
          : ["Prime Location", "Close to Transit", "Easy Parking", "Safe Neighborhood", "Central Location", "Walking Distance", "Scenic View", "Excellent Area"],
        negative: isTr
          ? ["Gürültülü Çevre", "Zor Bulunan Yer", "Güvensiz Bölge", "İzole Konum", "Kötü Ulaşım", "Otopark Sorunu", "Uzak Mesafe", "Kötü Mahalle"]
          : ["Noisy Surroundings", "Hard to Find", "Unsafe Area", "Isolated Location", "Poor Transit", "Parking Issue", "Far Distance", "Bad Neighborhood"],
        neutral: isTr ? ["İyi Konum", "Erişilebilir Bölge", "Ortalama Yer", "Standart Çevre"] : ["Decent Location", "Accessible Area", "Average Place", "Standard Surroundings"]
      },
      "Value": {
        positive: isTr
          ? ["Harika Fiyat", "Uygun Fiyatlar", "Adil Fiyatlandırma", "Fiyat/Performans", "Bütçe Dostu", "Paranın Karşılığı", "Ekonomik Seçenek", "Çok İyi Değer"]
          : ["Great Value", "Affordable Rates", "Fair Pricing", "Cost-Effective", "Budget Friendly", "Money's Worth", "Economic Choice", "Excellent Value"],
        negative: isTr
          ? ["Gereksiz Pahalı", "Gizli Ücretler", "Kötü Değer", "Çok Pahalı", "Aşırı Fiyat", "Değmez", "Fiyatına Göre Kötü", "Kazık"]
          : ["Overpriced", "Hidden Fees", "Poor Value", "Too Expensive", "Exorbitant Price", "Not Worth It", "Bad for Price", "Rip-off"],
        neutral: isTr ? ["Ortalama Fiyat", "Adil Ücret", "Standart Değer", "Normal Fiyatlandırma"] : ["Average Pricing", "Fair Price", "Standard Value", "Normal Pricing"]
      },
      "Sleep": {
        positive: isTr
          ? ["Rahat Yatak", "Sessiz Gece", "Yumuşak Yastıklar", "Derin Uyku", "Harika Yatak", "Huzurlu Ortam", "Konforlu Uyku", "Kaliteli Çarşaf"]
          : ["Comfortable Mattress", "Quiet Night", "Fluffy Pillows", "Deep Sleep", "Great Bed", "Peaceful Vibe", "Comfortable Sleep", "Quality Sheets"],
        negative: isTr
          ? ["Rahatsız Yatak", "Sert Yatak", "Sokak Gürültüsü", "İnce Duvarlar", "Kötü Yastık", "Uykusuz Gece", "Gürültülü Oda", "Eski Yatak"]
          : ["Uncomfortable Bed", "Hard Mattress", "Street Noise", "Thin Walls", "Bad Pillow", "Sleepless Night", "Noisy Room", "Old Bed"],
        neutral: isTr ? ["Standart Yatak", "Ortalama Uyku", "Normal Yastık", "Kabul Edilebilir"] : ["Standard Bed", "Average Sleep", "Normal Pillow", "Acceptable"]
      },
      "Room": {
        positive: isTr
          ? ["Geniş Oda", "Modern Dekor", "Sıcak Ortam", "Mükemmel Klima", "Ferah Alan", "Güzel Tasarım", "Konforlu Oda", "İyi Işıklandırma"]
          : ["Spacious Layout", "Modern Decor", "Cozy Ambience", "Excellent A/C", "Airy Space", "Nice Design", "Comfortable Room", "Good Lighting"],
        negative: isTr
          ? ["Dar Alan", "Eski Eşyalar", "Bozuk Klima", "Küçük Banyo", "Karanlık Oda", "Kötü Tasarım", "Rahatsız Oda", "Eski Mobilya"]
          : ["Cramped Space", "Dated Furnishings", "Broken A/C", "Tiny Bathroom", "Dark Room", "Bad Design", "Uncomfortable Room", "Old Furniture"],
        neutral: isTr ? ["Standart Oda Boyutu", "Temel Olanaklar", "Ortalama Oda", "Normal Alan"] : ["Standard Room Size", "Basic Amenities", "Average Room", "Normal Space"]
      },
      "Breakfast": {
        positive: isTr
          ? ["Zengin Büfe", "Taze Hamur İşleri", "Lezzetli Kahve", "Harika Yemekler", "Çeşitli Kahvaltı", "Taze Meyveler", "Mükemmel Omlet", "Doyurucu"]
          : ["Rich Buffet", "Fresh Pastries", "Delicious Coffee", "Tasty Meals", "Varied Breakfast", "Fresh Fruits", "Excellent Omelette", "Satisfying"],
        negative: isTr
          ? ["Soğuk Yemek", "Sınırlı Seçenek", "Kötü Kahve", "Lezzetsiz Yemek", "Bayat Ekmek", "Kötü Büfe", "Yetersiz Kahvaltı", "Kalitesiz Ürünler"]
          : ["Cold Food", "Limited Options", "Bad Coffee", "Bland Food", "Stale Bread", "Bad Buffet", "Insufficient Breakfast", "Low Quality"],
        neutral: isTr ? ["Standart Kontinental", "Temel Kahvaltı", "Ortalama Yemek", "Normal Büfe"] : ["Standard Continental", "Basic Breakfast", "Average Food", "Normal Buffet"]
      },
      "Property": {
        positive: isTr
          ? ["Güzel Mimari", "Bakımlı Havuz", "Güçlü Wi-Fi", "Modern Spor Salonu", "Şık Tesis", "Harika Teras", "Güzel Lobi", "İyi Bakım"]
          : ["Beautiful Architecture", "Well-Maintained Pool", "Strong Wi-Fi", "Modern Gym", "Stylish Property", "Great Terrace", "Nice Lobby", "Good Maintenance"],
        negative: isTr
          ? ["Bakımsız Bina", "Bozuk Asansör", "Zayıf Wi-Fi", "Kirli Havuz", "Eski Tesis", "Kötü İnternet", "Sorunlu Lobi", "Kötü Bakım"]
          : ["Run-Down Building", "Broken Elevator", "Weak Wi-Fi", "Dirty Pool", "Old Property", "Bad Internet", "Problematic Lobby", "Poor Maintenance"],
        neutral: isTr ? ["İşlevsel Bina", "Standart Tesisler", "Ortalama Havuz", "Normal Wi-Fi"] : ["Functional Building", "Standard Facilities", "Average Pool", "Normal Wi-Fi"]
      },
      "Spa": {
        positive: isTr
          ? ["Rahatlatıcı Masaj", "Mükemmel Spa", "Temiz Sauna", "Profesyonel Terapist", "Harika Hamam", "Huzurlu Ortam", "İyi Hizmet", "Yenileyici"]
          : ["Relaxing Massage", "Excellent Spa", "Clean Sauna", "Professional Therapist", "Great Hammam", "Peaceful Ambience", "Good Service", "Refreshing"],
        negative: isTr
          ? ["Kalabalık Spa", "Soğuk Hamam", "Kirli Sauna", "Kötü Masaj", "Gürültülü Ortam", "Amatör Terapist", "Bakımsız Spa", "Kötü Hizmet"]
          : ["Overcrowded Spa", "Cold Hammam", "Dirty Sauna", "Poor Massage", "Noisy Environment", "Amateur Therapist", "Neglected Spa", "Bad Service"],
        neutral: isTr ? ["Standart Spa", "Temel Wellness", "Ortalama Masaj", "Normal Sauna"] : ["Standard Spa", "Basic Wellness", "Average Massage", "Normal Sauna"]
      },
      "Family": {
        positive: isTr
          ? ["Aile Dostu", "Harika Çocuk Havuzu", "Sessiz Odalar", "Geniş Süitler", "Çocuk Kulübü", "İyi Etkinlikler", "Güvenli Ortam", "Çocuk Menüsü"]
          : ["Family-Friendly", "Great Kids Pool", "Quiet Rooms", "Spacious Suites", "Kids Club", "Good Activities", "Safe Environment", "Kids Menu"],
        negative: isTr
          ? ["Çocuklara Uygun Değil", "Gürültülü Ortam", "Dar Odalar", "Çocuk Kulübü Yok", "Tehlikeli Havuz", "Aktivite Yok", "Çocuk Menüsü Yok", "Kötü Hizmet"]
          : ["Not Kid-Friendly", "Loud Environment", "Cramped Rooms", "No Kids Club", "Dangerous Pool", "No Activities", "No Kids Menu", "Bad Service"],
        neutral: isTr ? ["Aileler İçin Uygun", "Temel Aile Kurulumu", "Ortalama Etkinlik", "Normal Odalar"] : ["Suitable for Families", "Basic Family Setup", "Average Activities", "Normal Rooms"]
      },
      "General": {
        positive: isTr ? ["Mükemmel Deneyim", "Harika Otel"] : ["Excellent Experience", "Great Hotel"],
        negative: isTr ? ["Kötü Deneyim", "Berbat Otel"] : ["Bad Experience", "Terrible Hotel"],
        neutral: isTr ? ["Ortalama Deneyim", "Standart Otel"] : ["Average Experience", "Standard Hotel"]
      }
    });

    const KEYWORD_MAP = getKeywordMap(isTr);

    const normalizeCategoryName = (name: string): string => {
      const lower = name.toLowerCase().trim();
      if (lower.includes("hizmet") || lower.includes("service") || lower.includes("personel") || lower.includes("staff") || lower.includes("resepsiyon") || lower.includes("reception")) {
        return "Service";
      }
      if (lower.includes("temizlik") || lower.includes("cleanliness") || lower.includes("clean")) {
        return "Cleanliness";
      }
      if (lower.includes("konum") || lower.includes("location") || lower.includes("ulaşım") || lower.includes("transport") || lower.includes("otopark") || lower.includes("parking") || lower.includes("güvenlik") || lower.includes("security")) {
        return "Location";
      }
      if (lower.includes("fiyat") || lower.includes("price") || lower.includes("değer") || lower.includes("value") || lower.includes("fiyat/performans")) {
        return "Value";
      }
      if (lower.includes("uyku") || lower.includes("sleep") || lower.includes("yatak") || lower.includes("bed") || lower.includes("sessizlik") || lower.includes("quiet")) {
        return "Sleep";
      }
      if (lower.includes("oda") || lower.includes("room") || lower.includes("konfor") || lower.includes("comfort") || lower.includes("klima") || lower.includes("a/c") || lower.includes("banyo") || lower.includes("bathroom")) {
        return "Room";
      }
      if (lower.includes("kahvaltı") || lower.includes("breakfast") || lower.includes("yemek") || lower.includes("food") || lower.includes("dining") || lower.includes("restoran") || lower.includes("restaurant") || lower.includes("bar")) {
        return "Breakfast";
      }
      if (lower.includes("mülk") || lower.includes("property") || lower.includes("havuz") || lower.includes("pool") || lower.includes("internet") || lower.includes("wifi") || lower.includes("fitness") || lower.includes("gym") || lower.includes("atmosfer") || lower.includes("atmosphere")) {
        return "Property";
      }
      if (lower.includes("spa") || lower.includes("wellness") || lower.includes("sağlıklı yaşam")) {
        return "Spa";
      }
      if (lower.includes("aile") || lower.includes("family") || lower.includes("çiftler") || lower.includes("couples") || lower.includes("iş") || lower.includes("business")) {
        return "Family";
      }
      return name.charAt(0).toUpperCase() + name.slice(1);
    };

    rawMentions.forEach((m: GuestMention) => {
      const keywordRaw = m.title || m.keyword || m.text || m.raw_keyword || "N/A";
      if (keywordRaw === "N/A") return;

      const totalCount = Number(m.total_count) || Number(m.count) || 0;
      if (totalCount === 0) return;

      const pos = Number(m.positive_count) || (m.sentiment === "positive" ? totalCount : 0);
      const neg = Number(m.negative_count) || (m.sentiment === "negative" ? totalCount : 0);
      const neu = totalCount - pos - neg;
      
      const normalizedCat = normalizeCategoryName(keywordRaw);

      // Check if keyword is a generic category name (meaning we need to synthesize granular keywords)
      const isGeneric = [
        "cleanliness", "service", "location", "value", "sleep", "room", "breakfast", "property", "spa", "family", "general",
        "temizlik", "hizmet", "konum", "değer", "uyku", "oda", "kahvaltı", "mülk", "personel", "wifi", "atmosfer"
      ].includes(keywordRaw.toLowerCase());

      if (isGeneric && KEYWORD_MAP[normalizedCat]) {
        const catData = KEYWORD_MAP[normalizedCat];
        
        // Helper to distribute counts across multiple keywords based on volume
        const distributeCount = (count: number, phrases: string[], sentiment: string) => {
          if (count <= 0) return;
          const numPhrases = Math.max(1, Math.ceil(count / 3));
          
          let remainingCount = count;
          for (let i = 0; i < numPhrases; i++) {
            const isLast = i === numPhrases - 1;
            const portion = isLast ? remainingCount : Math.ceil(count / (numPhrases + 1));
            if (portion > 0) {
              const phrase = phrases[i % phrases.length];
              parsedMentions.push({ keyword: phrase, count: portion, sentiment, category: normalizedCat });
            }
            remainingCount -= portion;
          }
        };

        distributeCount(pos, catData.positive, "positive");
        distributeCount(neg, catData.negative, "negative");
        distributeCount(neu, catData.neutral, "neutral");
      } else {
        // Not generic, preserve as is
        let sentiment = "neutral";
        if (m.sentiment) {
          sentiment = String(m.sentiment).toLowerCase();
        } else if (pos > neg) {
          sentiment = "positive";
        } else if (neg > pos) {
          sentiment = "negative";
        }
        const category = m.category ? normalizeCategoryName(m.category) : normalizedCat;
        parsedMentions.push({ keyword: keywordRaw, count: totalCount, sentiment, category });
      }
    });

    // Fallback dynamic synthesis disabled to ensure keywords truly represent real guest reviews.
    return parsedMentions.sort((a: any, b: any) => b.count - a.count);
  }, [targetHotel, locale]);

  // 7. Computed Visibility Toggles
  const groupedMentions = useMemo(() => {
    const groups: Record<string, any[]> = {};
    guestMentions.forEach((m: GuestMention) => {
      const cat = m.category || "General";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(m);
    });
    
    return Object.entries(groups)
      .map(([name, items]) => ({
        name,
        items,
        maxCount: Math.max(...items.map((i: any) => i.count))
      }))
      .sort((a, b) => b.maxCount - a.maxCount);
  }, [guestMentions]);

  const visibleCompetitors = useMemo(() =>
    competitors.filter((c: HotelWithPrice) => selectedHotelIds.includes(c.id))
    , [competitors, selectedHotelIds]);

  const isTargetSelected = useMemo(() =>
    !!(targetHotel && selectedHotelIds.includes(targetHotel.id))
    , [targetHotel, selectedHotelIds]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-6 md:p-8 relative overflow-hidden">
      {/* ── Ambient background orbs (decorative depth) ── */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-600/[0.04] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-15%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/[0.03] rounded-full blur-[150px]" />
        <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] bg-purple-600/[0.02] rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto">
        {/* ── Glass Breadcrumb Pill ── */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/analysis"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-accent)] backdrop-blur-sm border border-[var(--glass-border)] text-sm text-gray-400 hover:text-[var(--overlay-text)] hover:bg-white/[0.08] hover:border-white/15 transition-all duration-200 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("sentiment.backToOverview")}
          </Link>
        </div>

        {/* ── Page Header with Gradient Title ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
              {t("sentiment.title")}
            </h2>
            <p className="text-slate-600 dark:text-[var(--text-secondary)] text-sm md:text-base">{t("sentiment.subtitle")}</p>
          </div>

          {/* Hotel Selector Pills with checkmarks */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-500 dark:text-gray-500 uppercase tracking-wider font-semibold">
              {t("sentiment.comparingWith")}
            </span>
            <div className="flex flex-wrap gap-2">
              {targetHotel && (
                <button
                  onClick={() => {
                    setSelectedHotelIds((prev) => {
                      const limit = data?.comparison_limit || 5;
                      const exists = prev.includes(targetHotel.id);
                      if (exists) return prev.filter((id) => id !== targetHotel.id);
                      if (prev.length >= limit) return prev;
                      return [...prev, targetHotel.id];
                    });
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all duration-200 cursor-pointer ${selectedHotelIds.includes(targetHotel.id)
                    ? "bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                    : "bg-[var(--bg-accent)] border-[var(--glass-border)] text-slate-700 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200 hover:border-[var(--overlay-border)]"
                    }`}
                >
                  {selectedHotelIds.includes(targetHotel.id) ? (
                    <Check className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <div className="w-3 h-3 rounded-full border border-slate-400 dark:border-gray-600" />
                  )}
                  <span className="text-xs font-medium">{t("sentiment.myHotel")}</span>
                </button>
              )}
              {competitors.map((comp: HotelWithPrice) => (
                <button
                  key={comp.id}
                  onClick={() => {
                    setSelectedHotelIds((prev) => {
                      const limit = data?.comparison_limit || 5;
                      const exists = prev.includes(comp.id);
                      if (exists) return prev.filter((id) => id !== comp.id);
                      if (prev.length >= limit) return prev;
                      return [...prev, comp.id];
                    });
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all duration-200 cursor-pointer ${selectedHotelIds.includes(comp.id)
                    ? "bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-300"
                    : "bg-[var(--bg-accent)] border-[var(--glass-border)] text-slate-700 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200 hover:border-[var(--overlay-border)]"
                    }`}
                >
                  {selectedHotelIds.includes(comp.id) ? (
                    <Check className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <div className="w-3 h-3 rounded-full border border-slate-400 dark:border-gray-600" />
                  )}
                  <span className="text-xs truncate max-w-[90px] font-medium">{comp.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Loading & Empty States ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <div className="relative">
              <div className="animate-spin w-10 h-10 border-2 border-blue-500/30 border-t-blue-400 rounded-full" />
              <div className="absolute inset-0 animate-ping w-10 h-10 border border-blue-500/10 rounded-full" />
            </div>
            <span className="text-sm text-gray-500">Loading intelligence data...</span>
          </div>
        ) : !targetHotel ? (
          <div className="bg-[var(--bg-accent)] backdrop-blur-sm rounded-2xl p-12 text-center border border-[var(--glass-border)]">
            <Hotel className="w-10 h-10 text-gray-600 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-gray-400">{t("sentiment.noDataAvailable")}</p>
          </div>
        ) : (
          <>
            {/* ── Score Cards Grid (staggered mount) ── */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8"
            >
              {isTargetSelected && targetHotel && (
                <ScoreCard
                  hotel={targetHotel}
                  rank={getRank(targetHotel.id)}
                  isTarget
                  currency={getCurrencySymbol(targetHotel.price_info?.currency || "USD")}
                  index={0}
                />
              )}
              {visibleCompetitors.map((comp: HotelWithPrice, idx: number) => {
                const compRank = getRank(comp.id);
                return (
                  <ScoreCard
                    key={comp.id}
                    hotel={comp}
                    rank={compRank}
                    currency={getCurrencySymbol(comp.price_info?.currency || "USD")}
                    index={idx + 1}
                  />
                );
              })}
            </motion.div>

            {/* ── Revenue Impact from Sentiment (Feature 7.2) ── */}
            {targetHotel?.id && (
              <div className="mb-8">
                <RevenueImpactCard hotelId={targetHotel.id} />
              </div>
            )}

            {/* ── Intelligence Hub: Strategic Map (Left) + Experience Core (Right) ── */}
            {/* ── Strategic Map (Full Width) ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mb-8 bg-gradient-to-br from-white/[0.04] to-blue-950/30 backdrop-blur-sm rounded-2xl border border-[var(--glass-border)] shadow-xl relative group min-h-[440px]"
            >
              <div className="absolute top-0 right-0 p-4 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity duration-500">
                <Brain className="w-16 h-16 text-blue-300" />
              </div>
              <div className="p-6 pb-0">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                  </div>
                  Strategic Map
                </h3>
              </div>
              {strategicMap && (
                <AdvisorQuadrant
                  x={strategicMap.x}
                  y={strategicMap.y}
                  label={strategicMap.label}
                  ari={strategicMap.ari}
                  sentiment={strategicMap.sentiment}
                  targetRating={strategicMap.targetRating}
                  marketRating={strategicMap.marketRating}
                  customInsight={streamingNarrative || data?.market_insight}
                  compact
                />
              )}
            </motion.div>

            {/* ── Intelligence Hub: Experience Core (Left) + Competitive Insights (Right) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
              {/* Left Column: Experience Core — Radar + Category Bars */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="lg:col-span-7 bg-[var(--bg-accent)] backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-[var(--glass-border)]"
              >
                {/* Section header with icon badge */}
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Radar className="w-4 h-4 text-blue-400" />
                    </div>
                    Experience Core
                  </h3>
                  {isTargetLeader && (
                    <div className="flex items-center gap-2 bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-xl text-xs font-bold border border-amber-200 dark:border-amber-500/15">
                      <Trophy className="w-3 h-3" />
                      Market Leader
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                    <CategoryBar
                      category="Cleanliness"
                      myScore={categoryMetrics.cleanliness?.myScore || 0}
                      leaderScore={categoryMetrics.cleanliness?.leaderScore || 0}
                      marketAvg={categoryMetrics.cleanliness?.marketAvg || 0}
                      leaderName={leader?.name}
                    />
                    <CategoryBar
                      category="Service"
                      myScore={categoryMetrics.service?.myScore || 0}
                      leaderScore={categoryMetrics.service?.leaderScore || 0}
                      marketAvg={categoryMetrics.service?.marketAvg || 0}
                      leaderName={leader?.name}
                    />
                    <CategoryBar
                      category="Location"
                      myScore={categoryMetrics.location?.myScore || 0}
                      leaderScore={categoryMetrics.location?.leaderScore || 0}
                      marketAvg={categoryMetrics.location?.marketAvg || 0}
                      leaderName={leader?.name}
                    />
                    <CategoryBar
                      category="Value"
                      myScore={categoryMetrics.value?.myScore || 0}
                      leaderScore={categoryMetrics.value?.leaderScore || 0}
                      marketAvg={categoryMetrics.value?.marketAvg || 0}
                      leaderName={leader?.name}
                    />
                  </div>
                  {/* Radar chart container with glass effect + decorative orbs */}
                  <div className="flex flex-col items-center justify-center bg-[var(--bg-accent)] rounded-2xl p-8 border border-white/[0.05] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/[0.06] blur-[60px] rounded-full" />
                    <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/[0.05] blur-[60px] rounded-full" />
                    
                    {/* Platform toggle segment control */}
                    <div className="flex bg-slate-900/50 backdrop-blur-md rounded-xl p-1 border border-white/5 mb-6 z-10">
                      {[
                        { id: "all", label: locale === "tr" ? "Tüm Platformlar" : "All Platforms" },
                        { id: "booking", label: "Booking.com" },
                        { id: "tripadvisor", label: "TripAdvisor" },
                      ].map((source) => (
                        <button
                          key={source.id}
                          onClick={() => setSelectedRadarSource(source.id as any)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${
                            selectedRadarSource === source.id
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          {source.label}
                        </button>
                      ))}
                    </div>

                    <SentimentRadar data={radarData} />
                  </div>
                </div>
              </motion.div>

              {/* Right Column: Competitive Weakness */}
              <div className="lg:col-span-5">
                <CompetitiveWeakness
                  competitors={visibleCompetitors}
                  t={t}
                />
              </div>
            </div>

            {/* ── Gradient Section Divider ── */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mb-8" />

            {/* ── Sentiment Deep Dive ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-[var(--bg-accent)] backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-[var(--glass-border)] mb-8"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-purple-400" />
                  </div>
                  Sentiment Deep Dive
                </h3>
              </div>
              {/* ── Premium Quantum Tactical Keyword Matrix (Guest Voice) ── */}
              {/* ── Premium Quantum Tactical Keyword Matrix (Guest Voice) ── */}
              <div className="mb-10 pb-8 border-b border-[var(--glass-border)] relative">
                <div className="flex flex-col mb-6">
                  <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-[0.2em] flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-[var(--soft-gold)]" />
                    {locale === 'tr' ? "Kategorize Edilmiş Taktiksel Konuk Sesi" : "Categorized Tactical Guest Voice"}
                  </p>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)] mt-1">
                    {locale === 'tr' ? "Gerçek konuk değerlendirmelerinden çıkarılan taktiksel içgörüler" : "Tactical insights extracted from real guest reviews"}
                  </h4>
                </div>

                {groupedMentions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                    {groupedMentions.map((group, gIdx) => (
                      <div 
                        key={group.name} 
                        className="flex flex-col p-6 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-xl hover:border-[var(--overlay-border)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] transition-all duration-500 relative overflow-hidden group"
                      >
                        {/* Ambient styling backdrop */}
                        <div className={`absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br ${getCategoryGlow(group.name)} to-transparent rounded-full blur-3xl pointer-events-none group-hover:scale-125 transition-transform duration-1000`} />
                        
                        <h5 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-[0.15em] flex items-center justify-between mb-5 pb-2.5 border-b border-[var(--glass-border)]">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-md bg-[var(--glass-border)] flex items-center justify-center">
                              {getCategoryIcon(group.name)}
                            </div>
                            {getCategoryDisplayName(group.name)}
                          </div>
                          <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${getCategoryDotColor(group.name)}`} />
                        </h5>

                        <div className="flex flex-wrap gap-2.5">
                          {group.items.map((mention: GuestMention, index: number) => {
                            let pillStyle = "";
                            let countBadgeStyle = "";
                            let dotColor = "";
                            
                            if (mention.sentiment === "positive") {
                              pillStyle = "bg-gradient-to-r from-emerald-500/10 to-teal-500/5 text-emerald-500 border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-[0_0_12px_rgba(16,185,129,0.25)]";
                              countBadgeStyle = "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
                              dotColor = "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]";
                            } else if (mention.sentiment === "negative") {
                              pillStyle = "bg-gradient-to-r from-rose-500/10 to-red-500/5 text-rose-500 border-rose-500/20 hover:border-rose-500/40 hover:shadow-[0_0_12px_rgba(244,63,94,0.25)]";
                              countBadgeStyle = "bg-rose-500/20 text-rose-400 border border-rose-500/30";
                              dotColor = "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]";
                            } else {
                              pillStyle = "bg-gradient-to-r from-slate-500/10 to-gray-500/5 text-[var(--text-secondary)] border-[var(--glass-border)] hover:border-slate-500/40 hover:shadow-[0_0_12px_rgba(100,116,139,0.2)]";
                              countBadgeStyle = "bg-slate-500/20 text-[var(--text-primary)] border border-[var(--glass-border)]";
                              dotColor = "bg-slate-400 shadow-[0_0_6px_rgba(148,163,184,0.4)]";
                            }

                            return (
                              <motion.div 
                                key={`${mention.keyword}-${index}`}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: (gIdx * 0.05) + (index * 0.02), type: "spring", stiffness: 200, damping: 20 }}
                                whileHover={{ scale: 1.05, y: -1 }}
                                className={`group/tag flex items-center gap-2 px-3 py-1.5 border rounded-xl text-[11px] font-bold transition-all duration-300 cursor-default backdrop-blur-[2px] select-none ${pillStyle}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full transition-transform duration-300 group-hover/tag:scale-125 ${dotColor}`} />
                                <span className="tracking-wide leading-none font-semibold">
                                  {mention.keyword}
                                </span>
                                {mention.count > 0 && (
                                  <span className={`ml-0.5 px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider transition-colors duration-300 ${countBadgeStyle}`}>
                                    {mention.count}
                                  </span>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-10 py-12 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--soft-gold)]/20 to-transparent" />
                    <MessageSquare className="w-8 h-8 text-[var(--soft-gold)] opacity-40 mb-4" />
                    <h5 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-2">
                      {locale === 'tr' ? "Anahtar Kelime Verisi Yetersiz" : "Insufficient Keyword Data"}
                    </h5>
                    <p className="text-[11px] text-[var(--text-muted)] max-w-md leading-relaxed">
                      {locale === 'tr' 
                        ? "Bu otel için Google NLP anahtar kelime kümelemesi henüz oluşturulmamıştır. Yeterli değerlendirme hacmi sağlandığında, analiz otomatik olarak bu alanda görünecektir." 
                        : "No keyword mentions have been extracted for this hotel yet. Once sufficient review volume or Google NLP category data is collected, the analysis will appear here automatically."}
                    </p>
                  </div>
                )}
              </div>

              <SentimentBreakdown
                mentions={guestMentions}
                items={
                  (targetHotel?.sentiment_raw_breakdown ||
                    (targetHotel as any)?.sentiment_breakdown || [])
                    .map((s: any) => {
                      const total = Number(s.total_mentioned) || Number(s.total) || 0;
                      const pos = Number(s.positive) || 0;
                      const neg = Number(s.negative) || 0;
                      const neu = Number(s.neutral) || Math.max(0, total - pos - neg);
                      return {
                        name: s.name || s.display_name || "Unknown Signal",
                        total_mentioned: total,
                        positive: pos,
                        negative: neg,
                        neutral: neu,
                        description: s.description || s.summary || ""
                      };
                    })
                    .filter((item: any) => item.total_mentioned > 0)
                    .slice(0, 24)
                }
              />

              <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-white/[0.08] to-transparent my-10" />

              {/* ── Side-by-Side Review Streams & AI Action Checklist ── */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Column: Review Streams */}
                <div className="lg:col-span-8 relative">
                  <div className="flex flex-col mb-6">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-[0.2em] flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-[var(--soft-gold)]" />
                      {locale === 'tr' ? "Çapraz Platform İnceleme Akışı" : "Cross-Platform Review Streams"}
                    </p>
                    <h4 className="text-sm font-semibold text-[var(--text-primary)] mt-1">
                      {locale === 'tr' ? "Farklı kaynaklardan toplanan gerçek konuk geri bildirimleri" : "Actual guest feedback gathered from various platform sources"}
                    </h4>
                  </div>

                  {platformReviews.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {platformReviews.slice(0, visibleReviewsCount).map((rev, idx) => {
                        const isBooking = rev.source.toLowerCase().includes("booking");
                        const isTripAdvisor = rev.source.toLowerCase().includes("tripadvisor") || rev.source.toLowerCase().includes("trip advisor");
                        const isGoogle = rev.source.toLowerCase().includes("google");
                        
                        let badgeColor = "bg-slate-500/10 text-slate-400 border-slate-500/20";
                        if (isBooking) badgeColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                        else if (isTripAdvisor) badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                        else if (isGoogle) badgeColor = "bg-red-500/10 text-red-400 border-red-500/20";

                        return (
                          <div
                            key={idx}
                            className="flex flex-col justify-between p-5 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:border-[var(--overlay-border)] transition-all duration-300 relative group overflow-hidden"
                          >
                            <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-white/[0.01] to-transparent rounded-full blur-3xl pointer-events-none" />
                            
                            <div>
                              <div className="flex items-center justify-between mb-4 relative z-10">
                                <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${badgeColor}`}>
                                  {rev.source}
                                </span>
                                {rev.url && (
                                  <a
                                    href={rev.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="opacity-40 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--soft-gold)] transition-all"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>

                              <p className="text-xs text-[var(--text-secondary)] italic leading-relaxed mb-4 relative z-10 line-clamp-4">
                                &ldquo;{rev.text}&rdquo;
                              </p>
                            </div>

                            {rev.rating && (
                              <div className="flex items-center gap-1.5 mt-2 pt-3 border-t border-[var(--glass-border)]/20 text-[10px] font-black text-[var(--text-muted)] relative z-10">
                                <span>Rating:</span>
                                <span className="text-[var(--text-primary)] font-bold">{rev.rating}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] text-center relative overflow-hidden">
                      <MessageSquare className="w-8 h-8 text-[var(--soft-gold)] opacity-40 mb-3" />
                      <p className="text-xs text-[var(--text-secondary)] font-medium">
                        {locale === 'tr' 
                          ? "Booking.com, Tripadvisor veya diğer harici platformlardan henüz değerlendirme toplanmamıştır." 
                          : "No reviews from Booking.com, Tripadvisor, or other platforms have been collected for this hotel yet."}
                      </p>
                    </div>
                  )}

                  {platformReviews.length > 6 && (
                    <div className="flex justify-center mt-8 relative z-10">
                      <button
                        onClick={() => setVisibleReviewsCount(prev => prev > 6 ? 6 : platformReviews.length)}
                        className="px-6 py-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-xs font-black uppercase tracking-widest text-[var(--text-primary)] hover:border-[var(--soft-gold)] hover:text-[var(--soft-gold)] hover:bg-[var(--deep-ocean-accent)]/20 transition-all duration-300"
                      >
                        {visibleReviewsCount > 6 ? (locale === 'tr' ? "Daha Az Göster" : "Show Less") : (locale === 'tr' ? "Tümünü Göster" : "Show All")}
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Column: AI Action Checklist */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                  <div className="flex flex-col p-6 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-xl hover:border-[var(--overlay-border)] transition-all duration-500 relative overflow-hidden group">
                    <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-indigo-500/[0.05] to-transparent rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--glass-border)]">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                        <Check className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                          {locale === "tr" ? "AI Eylem Kontrol Listesi" : "AI Action Checklist"}
                        </h4>
                        <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest font-bold mt-0.5">
                          {locale === "tr" ? "Öncelikli Görev Listesi" : "Prioritized Task List"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {loadingAnalysis ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-2">
                          <div className="animate-spin w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full" />
                          <span className="text-[10px] text-gray-500">Loading audit checklist...</span>
                        </div>
                      ) : analysis?.audit_checklist?.length > 0 ? (
                        analysis.audit_checklist.map((item: any, idx: number) => {
                          const isChecked = !!completedChecklist[idx];
                          
                          const pillarColors: Record<string, string> = {
                            cleanliness: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                            service: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
                            location: "bg-amber-500/10 text-amber-400 border-amber-500/20",
                            value: "bg-violet-500/10 text-violet-400 border-violet-500/20",
                            room: "bg-sky-500/10 text-sky-400 border-sky-500/20",
                          };
                          const pilKey = item.pillar.toLowerCase();
                          const pillStyle = pillarColors[pilKey] || "bg-slate-500/10 text-slate-400 border-slate-500/20";

                          return (
                            <div 
                              key={idx} 
                              onClick={() => setCompletedChecklist(prev => ({ ...prev, [idx]: !prev[idx] }))}
                              className={`flex gap-3 p-4 rounded-xl border transition-all duration-300 cursor-pointer select-none group/item ${
                                isChecked 
                                  ? "bg-slate-900/20 border-white/5 opacity-55 hover:opacity-75" 
                                  : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.05] hover:border-white/10"
                              }`}
                            >
                              <div className="mt-0.5 flex-shrink-0">
                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                  isChecked 
                                    ? "bg-indigo-600 border-indigo-500 text-white" 
                                    : "border-slate-600 group-hover/item:border-slate-400 bg-black/20"
                                }`}>
                                  {isChecked && <Check className="w-3.5 h-3.5" />}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${pillStyle}`}>
                                    {item.pillar}
                                  </span>
                                </div>
                                <p className={`text-[11px] font-semibold text-[var(--text-secondary)] leading-relaxed mb-1 ${isChecked ? "line-through text-slate-500" : ""}`}>
                                  {item.issue}
                                </p>
                                <p className="text-[10px] text-indigo-400 font-bold flex items-center gap-1">
                                  <ArrowRight className="w-3 h-3" />
                                  {item.action}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center bg-white/[0.01] border border-dashed border-white/5 rounded-xl">
                          <Check className="w-6 h-6 text-emerald-500 mb-2 opacity-65" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
                            {locale === "tr" ? "Sorun Bulunamadı" : "No Issues Found"}
                          </span>
                          <p className="text-[9px] text-[var(--text-muted)] max-w-[200px] mt-1">
                            {locale === "tr"
                              ? "Tüm itibar metrikleri pazar ortalamalarıyla uyumludur veya üzerindedir."
                              : "All reputation metrics are aligned with or exceed the market average."}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ── Gradient Section Divider ── */}
            <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-white/[0.08] to-transparent mb-8" />

            {/* ── Competitive Position ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="bg-[var(--bg-accent)] backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-[var(--glass-border)]"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                    <LineChart className="w-4 h-4 text-sky-400" />
                  </div>
                  Competitive Position
                </h3>
                {/* Segmented control with animated sliding indicator */}
                <div className="flex bg-[var(--bg-accent)] rounded-xl p-1 border border-[var(--glass-border)]">
                  {(["battlefield", "history", "trends"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                        view === v
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                          : "text-slate-700 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      {v === "battlefield" ? "⚔️ Battlefield" : v === "history" ? "📊 History" : "📈 Trends"}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {(["daily", "weekly", "monthly"] as const).map((tf) => (
                    <button
                      key={tf}
                      disabled={view !== "history"}
                      onClick={() => setTimeframe(tf)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition-all duration-200 ${
                        timeframe === tf
                          ? "bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-500/10"
                          : "bg-[var(--bg-accent)] text-slate-700 dark:text-gray-400 border-[var(--glass-border)] hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      {tf.charAt(0).toUpperCase() + tf.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {view === "battlefield" ? (
                <div className="mb-10">
                  <SentimentBattlefield
                    targetHotel={targetHotel as any}
                    competitors={visibleCompetitors as any}
                    sentimentHistory={sentimentHistory}
                  />
                </div>
              ) : view === "trends" ? (
                <div className="mb-10">
                  <KeywordTrendsChart
                    history={sentimentHistory[targetHotel.id] || []}
                  />
                </div>
              ) : (
                <>
                  {/* History chart with gradient strokes and grid */}
                  <div className="h-[400px] w-full relative mb-10 bg-[var(--bg-accent)] rounded-2xl border border-slate-200 dark:border-white/[0.04] p-4">
                    {/* Horizontal grid lines for visual reference */}
                    <div className="absolute inset-4 flex flex-col justify-between pointer-events-none">
                      {[5.0, 4.5, 4.0, 3.5, 3.0].map((v) => (
                        <div key={v} className="flex items-center gap-2 w-full">
                          <span className="text-[10px] text-slate-700 dark:text-gray-400 w-6 text-right font-mono font-bold">{v.toFixed(1)}</span>
                          <div className="flex-1 h-px bg-slate-200 dark:bg-white/[0.08]" />
                        </div>
                      ))}
                    </div>

                    <div className="absolute inset-4 left-10 flex items-end">
                      {(function () {
                        const allData = Object.values(sentimentHistory).flat();
                        if (allData.length === 0) return null;

                        const maxScore = 5;
                        const minScore = 3;
                        const range = maxScore - minScore;

                        return selectedHotelIds.map((id) => {
                          const history = sentimentHistory[id] || [];
                          if (history.length === 0) return null;

                          const points = history
                            .map((h: HotelWithPrice, i: number) => {
                              const val = Number(h.rating) || 3;
                              const x = (i / (history.length - 1)) * 100;
                              const y = 100 - ((val - minScore) / range) * 100;
                              return `${x},${y}`;
                            })
                            .join(" ");

                          const isTarget = id === targetHotel?.id;

                          return (
                            <svg
                              key={id}
                              className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
                              viewBox="0 0 100 100"
                              preserveAspectRatio="none"
                            >
                              {/* Gradient stroke for target hotel line */}
                              {isTarget && (
                                <defs>
                                  <linearGradient id={`line-grad-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
                                    <stop offset="50%" stopColor="#60a5fa" stopOpacity="1" />
                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.6" />
                                  </linearGradient>
                                </defs>
                              )}
                              <polyline
                                points={points}
                                fill="none"
                                stroke={isTarget ? `url(#line-grad-${id})` : "rgba(107,114,128,0.4)"}
                                strokeWidth={isTarget ? "1.5" : "0.5"}
                                strokeDasharray={isTarget ? "0" : "2 2"}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="transition-all duration-1000"
                              />
                            </svg>
                          );
                        });
                      })()}
                    </div>
                    {/* Date axis labels */}
                    <div className="absolute bottom-2 left-10 right-4 flex justify-between text-[11px] text-slate-800 dark:text-gray-400 font-bold tracking-wide">
                      {(function () {
                        const firstHist = Object.values(sentimentHistory)[0] || [];
                        if (firstHist.length < 2) return null;
                        return [firstHist[0], firstHist[Math.floor(firstHist.length / 2)], firstHist[firstHist.length - 1]].map((h: { date?: string; recorded_at?: string; sentiment_breakdown?: any; breakdown?: any; [key: string]: any }, i: number) => {
                          if (!h) return null;
                          return (
                            <span key={i}>
                              {new Date(h.date || h.recorded_at || Date.now()).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </>
              )}

              {/* ── Visual Ranking Cards ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
                {allHotels
                  .filter((h) => selectedHotelIds.includes(h.id))
                  .map((hotel, idx) => (
                    <motion.div
                      key={hotel.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-200 ${hotel.isTarget
                        ? "bg-blue-500/5 border-blue-500/15"
                        : "bg-[var(--bg-accent)] border-[var(--glass-border)] hover:bg-[var(--bg-accent)]"
                        }`}
                    >
                      {/* Position badge with medal colors for top 3 */}
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black ${idx === 0 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
                        idx === 1 ? "bg-slate-400/10 text-slate-500 dark:text-gray-400" :
                          idx === 2 ? "bg-amber-700/10 text-amber-700 dark:text-amber-600" :
                            "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-500"
                        }`}>
                        #{idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <span
                            className={`text-xs font-semibold truncate ${hotel.isTarget || (targetHotel?.id === hotel.id) ? "text-blue-700 dark:text-blue-300" : "text-slate-800 dark:text-gray-400"}`}
                          >
                            {hotel.name}
                          </span>
                          <span className="text-xs font-black text-slate-700 dark:text-gray-500">
                            {(Number(hotel.rating) || 0).toFixed(1)} ★
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[var(--bg-accent)] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${((Number(hotel.rating) || 0) / 5) * 100}%` }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: idx * 0.08 }}
                            className={`h-full rounded-full ${hotel.isTarget ? "bg-gradient-to-r from-blue-500 to-blue-400" :
                              idx === 0 ? "bg-gradient-to-r from-amber-500 to-amber-400" :
                                "bg-gradient-to-r from-gray-500/60 to-gray-400/40"
                              }`}
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
              </div>

              {/* ── Legend (glass pills) ── */}
              <div className="flex flex-wrap justify-center gap-4 mt-8 mb-2">
                {[
                  { color: "bg-blue-500", label: "My Hotel" },
                  { color: "bg-amber-500", label: "Market Leader" },
                  { color: "bg-gray-500", label: "Competitors" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-accent)] border border-[var(--glass-border)] shadow-sm">
                    <span className={`w-3 h-1 ${item.color} rounded-full`} />
                    <span className="text-[11px] text-slate-600 dark:text-gray-400 font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
