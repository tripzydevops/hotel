"use client";

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
import { getCurrencySymbol } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/utils/supabase/client";
import { useDashboard } from "@/hooks/useDashboard";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
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
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import SentimentBreakdown from "@/components/ui/SentimentBreakdown";
import SentimentBattlefield from "@/components/analytics/SentimentBattlefield";

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
  hotel: any; rank: string; isTarget?: boolean; currency?: string; index?: number;
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
      className={`relative rounded-2xl border transition-all duration-300 group overflow-hidden cursor-default ${
        isTarget
          ? "bg-gradient-to-br from-blue-950/80 via-indigo-950/60 to-slate-900/80 backdrop-blur-xl border-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.12),0_8px_32px_rgba(0,0,0,0.3)]"
          : "bg-white/[0.04] backdrop-blur-lg border-white/[0.08] hover:border-white/15 hover:bg-white/[0.06] hover:shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
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
            <span className={`text-[10px] font-semibold uppercase tracking-[0.15em] ${
              isTarget ? "text-blue-400/80" : "text-gray-500"
            }`}>
              {isTarget ? t("sentiment.myHotel") : t("sentiment.competitor")}
            </span>
            <h3 className="text-sm font-bold text-white/90 truncate max-w-[140px]">
              {hotel.name}
            </h3>
          </div>
          <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
            isTarget 
              ? "bg-blue-500/10 border-blue-500/20 text-blue-300" 
              : "bg-white/5 border-white/[0.08] text-gray-400"
          }`}>
            {rank}
          </div>
        </div>

        {/* Metrics: Rating (with color ring) + Price */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <span className="text-[11px] text-gray-500 mb-2 font-medium">
              {t("sentiment.overallRating")}
            </span>
            <div className="flex items-center gap-2.5">
              <div className={`w-11 h-11 rounded-xl ${ratingStyle.bg} ring-2 ${ratingStyle.ring} flex items-center justify-center`}>
                <span className={`text-lg font-black ${ratingStyle.text}`}>
                  {(hotel.rating || 0).toFixed(1)}
                </span>
              </div>
              <span className="text-[10px] text-gray-600 font-semibold">/ 5.0</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[11px] text-gray-500 mb-2 font-medium">
              {t("sentiment.currentPrice")}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-white/90">
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
        <div className="mt-4 pt-3.5 border-t border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <Star className="w-3 h-3 text-amber-500/70" />
            <span className="font-medium">{(hotel.review_count || 0).toLocaleString()} reviews</span>
          </div>
          {hotel.price_info?.price_change_percent !== undefined && (
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              hotel.price_info.price_change_percent > 0
                ? "bg-red-500/10 text-red-400"
                : "bg-emerald-500/10 text-emerald-400"
            }`}>
              {hotel.price_info.price_change_percent > 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {Math.abs(hotel.price_info.price_change_percent)}%
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

  // Fixed color for My Hotel (Blue gradient)
  const getBarGradient = () => {
    if (myScore <= 0) return "from-gray-700/50 to-gray-600/30";
    return "from-blue-500 to-blue-400";
  };

  return (
    <div className="flex flex-col">
      {/* Header: Category name + Score */}
      <div className="flex justify-between items-end mb-3">
        <span className="text-sm font-bold text-white/80">{localizedCategory}</span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-black text-white/90">
            {myScore > 0 ? myScore.toFixed(2) : "N/A"}
          </span>
          <span className="text-[10px] text-gray-600 font-semibold">/ 5.0</span>
        </div>
      </div>

      {/* My Hotel bar — thick with gradient fill */}
      <div className="h-[6px] bg-white/[0.06] rounded-full overflow-hidden relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(Math.max(myScore, 0.5) / 5) * 100}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          className={`h-full rounded-full bg-gradient-to-r ${getBarGradient()} relative group`}
        >
          {/* Tooltip on hover */}
          {myScore > 0 && (
            <div className="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900/95 backdrop-blur-sm text-white text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap z-10 border border-white/10">
              {t("sentiment.myHotel")}: {myScore.toFixed(2)}
            </div>
          )}
        </motion.div>
      </div>

      {/* Comparison rows: Leader + Market Average */}
      <div className="mt-2.5 space-y-1.5">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-gray-500 w-24 truncate font-medium">
            {leaderName || t("sentiment.leader")}
          </span>
          <div className="flex-1 h-[4px] bg-white/[0.04] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(leaderScore / 5) * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
              className="h-full bg-gradient-to-r from-amber-500/80 to-amber-400/60 rounded-full"
            />
          </div>
          <span className="text-[11px] text-amber-400/80 font-bold w-8 text-right">
            {leaderScore.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-gray-500 w-24 font-medium">
            {t("sentiment.avgComp")}
          </span>
          <div className="flex-1 h-[4px] bg-white/[0.04] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(marketAvg / 5) * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
              className="h-full bg-gradient-to-r from-gray-500/60 to-gray-400/40 rounded-full"
            />
          </div>
          <span className="text-[11px] text-gray-400 w-8 text-right">
            {marketAvg.toFixed(2)}
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
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-medium cursor-default transition-colors ${colors[sentiment]} ${
          size === "md" ? "text-sm" : "text-[11px]"
        }`}
      >
        <span className="capitalize">{t_name}</span>
        <span className="w-[1px] h-3 bg-white/10" />
        <span className="text-[10px] font-black opacity-80">
          {count > 999 ? (count / 1000).toFixed(1) + "k" : count}
        </span>
      </span>
      {/* Glass-panel tooltip with review snippet */}
      {description && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2.5 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl text-[10px] text-white/80 font-medium italic leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
          "{description}"
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900/95" />
        </div>
      )}
    </motion.div>
  );
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
  const { t } = useI18n();
  const { userId } = useAuth();
  const { data, loading } = useDashboard(userId, t);
  const [timeframe, setTimeframe] = useState<"daily" | "weekly" | "monthly">(
    "weekly",
  );
  const [selectedHotelIds, setSelectedHotelIds] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [view, setView] = useState<"battlefield" | "history">("battlefield");

  // 1. Core Data Extraction (Memoized)
  const targetHotel = useMemo(() => data?.target_hotel, [data?.target_hotel]);
  const competitors = useMemo(() => data?.competitors || [], [data?.competitors]);

  // 2. Global Hotel List & Leader Logic
  const allHotels = useMemo(() => [
    ...(targetHotel ? [{ ...targetHotel, isTarget: true }] : []),
    ...competitors.map((c: any) => ({ ...c, isTarget: false })),
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
      const initialIds = [targetHotel.id, ...competitors.map((c: any) => c.id)];
      setSelectedHotelIds(initialIds.slice(0, 5));
      setInitialized(true);
    }
  }, [targetHotel, competitors, initialized]);

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
  const getCategoryScore = (hotel: any, category: string, history: any[] = []) => {
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
       if (hotel.guest_mentions?.length > 0) {
          const relevantMentions = hotel.guest_mentions.filter((m: any) => {
             const text = (m.keyword || m.text || "").toLowerCase();
             return aliases[target]?.some(alias => text.includes(alias));
          });
          if (relevantMentions.length > 0) {
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
    const myPrice = Number(targetHotel.price_info?.current_price) || 0;
    const myRating = Number(targetHotel.rating) || 0;
    const validCompetitors = competitors.filter((c: any) => c.price_info?.current_price);
    
    const avgMarketPrice = validCompetitors.length > 0
        ? validCompetitors.reduce((sum: number, c: any) => sum + (Number(c.price_info?.current_price) || 0), 0) / validCompetitors.length
        : myPrice;
        
    const ari = avgMarketPrice > 0 ? (myPrice / avgMarketPrice) * 100 : 100;
    const sentimentIndex = marketAvgRating > 0 ? (myRating / marketAvgRating) * 100 : 100;
    
    const x = Math.min(Math.max(sentimentIndex - 100, -50), 50);
    const y = Math.min(Math.max(ari - 100, -50), 50);
    
    let label = "Standard";
    if (x > 2 && y > 2) label = "Premium King";
    else if (x > 2 && y < -2) label = "Value Leader";
    else if (x < -2 && y < -2) label = "Budget / Economy";
    else if (x < -2 && y > 2) label = "Danger Zone";
    
    return { x, y, label, ari, sentiment: sentimentIndex, targetRating: myRating, marketRating: marketAvgRating };
  }, [targetHotel, competitors, marketAvgRating]);


  // 6. Visualization Data (Radar)
  const radarData = useMemo(() => {
    if (!targetHotel) return [];
    return ["Cleanliness", "Service", "Location", "Value"].map((cat) => ({
      subject: t(`sentiment.${cat.toLowerCase()}`) !== `sentiment.${cat.toLowerCase()}` 
        ? t(`sentiment.${cat.toLowerCase()}`) 
        : cat,
      A: getCategoryScore(targetHotel, cat, sentimentHistory[targetHotel.id]),
      B: leader ? getCategoryScore(leader, cat, sentimentHistory[leader.id]) : 0,
      C: marketAvgRating || 3, // Fallback to neutral 3 if avg unavailable
    }));
  }, [targetHotel, leader, sentimentHistory, marketAvgRating, t]);

  // 7. Computed Visibility Toggles
  const visibleCompetitors = useMemo(() => 
    competitors.filter((c: any) => selectedHotelIds.includes(c.id))
  , [competitors, selectedHotelIds]);

  const isTargetSelected = useMemo(() => 
    !!(targetHotel && selectedHotelIds.includes(targetHotel.id))
  , [targetHotel, selectedHotelIds]);

  return (
    <div className="min-h-screen bg-[#060d1b] p-6 md:p-8 relative overflow-hidden">
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] text-sm text-gray-400 hover:text-white hover:bg-white/[0.08] hover:border-white/15 transition-all duration-200 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("sentiment.backToOverview")}
          </Link>
        </div>

        {/* ── Page Header with Gradient Title ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-blue-300 mb-2 tracking-tight">
              {t("sentiment.title")}
            </h2>
            <p className="text-gray-400/80 text-sm md:text-base">{t("sentiment.subtitle")}</p>
          </div>
          
          {/* Hotel Selector Pills with checkmarks */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
              {t("sentiment.comparingWith")}
            </span>
            <div className="flex flex-wrap gap-2">
              {targetHotel && (
                <button
                  onClick={() => {
                    setSelectedHotelIds((prev) => {
                      const exists = prev.includes(targetHotel.id);
                      if (exists) return prev.filter((id) => id !== targetHotel.id);
                      if (prev.length >= 5) return prev;
                      return [...prev, targetHotel.id];
                    });
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all duration-200 cursor-pointer ${
                    selectedHotelIds.includes(targetHotel.id)
                      ? "bg-blue-500/15 border-blue-500/30 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                      : "bg-white/[0.03] border-white/[0.08] text-gray-500 hover:text-gray-300 hover:border-white/15"
                  }`}
                >
                  {selectedHotelIds.includes(targetHotel.id) ? (
                    <Check className="w-3 h-3 text-blue-400" />
                  ) : (
                    <div className="w-3 h-3 rounded-full border border-gray-600" />
                  )}
                  <span className="text-xs font-medium">{t("sentiment.myHotel")}</span>
                </button>
              )}
              {competitors.map((comp: any) => (
                <button
                  key={comp.id}
                  onClick={() => {
                    setSelectedHotelIds((prev) => {
                      const exists = prev.includes(comp.id);
                      if (exists) return prev.filter((id) => id !== comp.id);
                      if (prev.length >= 5) return prev;
                      return [...prev, comp.id];
                    });
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all duration-200 cursor-pointer ${
                    selectedHotelIds.includes(comp.id)
                      ? "bg-amber-500/10 border-amber-500/25 text-amber-300"
                      : "bg-white/[0.03] border-white/[0.08] text-gray-500 hover:text-gray-300 hover:border-white/15"
                  }`}
                >
                  {selectedHotelIds.includes(comp.id) ? (
                    <Check className="w-3 h-3 text-amber-400" />
                  ) : (
                    <div className="w-3 h-3 rounded-full border border-gray-600" />
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
          <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl p-12 text-center border border-white/[0.06]">
            <Hotel className="w-10 h-10 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">{t("sentiment.noDataAvailable")}</p>
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
              {visibleCompetitors.map((comp: any, idx: number) => {
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

            {/* ── Intelligence Hub: Strategic Map (Left) + Experience Core (Right) ── */}
            {/* ── Strategic Map (Full Width) ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mb-8 bg-gradient-to-br from-white/[0.04] to-blue-950/30 backdrop-blur-sm rounded-2xl border border-white/[0.08] shadow-xl relative overflow-hidden group min-h-[440px]"
            >
               <div className="absolute top-0 right-0 p-4 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity duration-500">
                  <Brain className="w-16 h-16 text-blue-300" />
               </div>
               <div className="p-6 pb-0">
                 <h3 className="text-lg font-bold text-white/90 flex items-center gap-3">
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
                className="lg:col-span-7 bg-white/[0.03] backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/[0.06]"
              >
                {/* Section header with icon badge */}
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-bold text-white/90 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Radar className="w-4 h-4 text-blue-400" />
                    </div>
                    Experience Core
                  </h3>
                  {isTargetLeader && (
                    <div className="flex items-center gap-2 bg-amber-500/10 text-amber-400 px-3 py-1.5 rounded-xl text-xs font-bold border border-amber-500/15">
                      <Trophy className="w-3 h-3" />
                      Market Leader
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                    <CategoryBar
                      category="Cleanliness"
                      myScore={getCategoryScore(targetHotel, "cleanliness", sentimentHistory[targetHotel.id])}
                      leaderScore={getCategoryScore(leader, "cleanliness", sentimentHistory[leader?.id])}
                      marketAvg={marketAvgRating}
                      leaderName={leader?.name}
                    />
                    <CategoryBar
                      category="Service"
                      myScore={getCategoryScore(targetHotel, "service", sentimentHistory[targetHotel.id])}
                      leaderScore={getCategoryScore(leader, "service", sentimentHistory[leader?.id])}
                      marketAvg={marketAvgRating}
                      leaderName={leader?.name}
                    />
                    <CategoryBar
                      category="Location"
                      myScore={getCategoryScore(targetHotel, "location", sentimentHistory[targetHotel.id])}
                      leaderScore={getCategoryScore(leader, "location", sentimentHistory[leader?.id])}
                      marketAvg={marketAvgRating}
                      leaderName={leader?.name}
                    />
                    <CategoryBar
                      category="Value"
                      myScore={getCategoryScore(targetHotel, "value", sentimentHistory[targetHotel.id])}
                      leaderScore={getCategoryScore(leader, "value", sentimentHistory[leader?.id])}
                      marketAvg={marketAvgRating}
                      leaderName={leader?.name}
                    />
                  </div>
                  {/* Radar chart container with glass effect + decorative orbs */}
                  <div className="flex items-center justify-center bg-white/[0.02] rounded-2xl p-8 border border-white/[0.05] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/[0.06] blur-[60px] rounded-full" />
                    <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/[0.05] blur-[60px] rounded-full" />
                    <SentimentRadar data={radarData} />
                  </div>
                </div>
              </motion.div>

              {/* Right Column: Competitive Weakness */}
              <div className="lg:col-span-5 flex flex-col gap-6">
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
            className="bg-white/[0.03] backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/[0.06] mb-8"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-white/90 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-purple-400" />
                </div>
                Sentiment Deep Dive
              </h3>
            </div>
            <SentimentBreakdown
              items={
                (targetHotel?.sentiment_raw_breakdown ||
                targetHotel?.sentiment_breakdown || [])
                .map((s: any) => ({
                   ...s,
                   description: s.description || s.summary
                }))
                .filter((item: any) => item.total_mentioned > 0)
                .slice(0, 24)
              }
            />
          </motion.div>

          {/* ── Gradient Section Divider ── */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mb-8" />

          {/* ── Competitive Position ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-white/[0.03] backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/[0.06]"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
              <h3 className="text-lg font-bold text-white/90 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                  <LineChart className="w-4 h-4 text-sky-400" />
                </div>
                Competitive Position
              </h3>
              {/* Segmented control with animated sliding indicator */}
              <div className="flex bg-white/[0.04] rounded-xl p-1 border border-white/[0.08]">
                {(["battlefield", "history"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                      view === v
                        ? "bg-blue-500/20 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.1)] border border-blue-500/20"
                        : "text-gray-400 hover:text-white border border-transparent"
                    }`}
                  >
                    {v === "battlefield" ? "⚔️ Battlefield" : "📊 History"}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {(["daily", "weekly", "monthly"] as const).map((tf) => (
                  <button
                    key={tf}
                    disabled={view === "battlefield"}
                    onClick={() => setTimeframe(tf)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs border transition-all duration-200 cursor-pointer ${
                      view === "battlefield"
                        ? "opacity-20 cursor-not-allowed"
                        : timeframe === tf
                        ? "bg-blue-500/15 text-blue-300 border-blue-500/25 font-bold"
                        : "bg-white/[0.03] text-gray-400 border-white/[0.08] hover:text-white hover:border-white/15"
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
            ) : (
              <>
                {/* History chart with gradient strokes and grid */}
                <div className="h-[400px] w-full relative mb-10 bg-white/[0.01] rounded-2xl border border-white/[0.04] p-4">
                  {/* Horizontal grid lines for visual reference */}
                  <div className="absolute inset-4 flex flex-col justify-between pointer-events-none">
                    {[5.0, 4.5, 4.0, 3.5, 3.0].map((v) => (
                      <div key={v} className="flex items-center gap-2 w-full">
                        <span className="text-[9px] text-gray-600 w-6 text-right font-mono">{v.toFixed(1)}</span>
                        <div className="flex-1 h-px bg-white/[0.04]" />
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
                          .map((h: any, i: number) => {
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
                  <div className="absolute bottom-2 left-10 right-4 flex justify-between text-[10px] text-gray-600 font-medium tracking-wide">
                    {(function() {
                      const firstHist = Object.values(sentimentHistory)[0] || [];
                      if (firstHist.length < 2) return null;
                      return [firstHist[0], firstHist[Math.floor(firstHist.length/2)], firstHist[firstHist.length-1]].map((h: any, i: number) => {
                        if (!h) return null;
                        return (
                          <span key={i}>
                            {new Date(h.date || h.recorded_at).toLocaleDateString(undefined, {
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
                    className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-200 ${
                      hotel.isTarget
                        ? "bg-blue-500/5 border-blue-500/15"
                        : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                    }`}
                  >
                    {/* Position badge with medal colors for top 3 */}
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black ${
                      idx === 0 ? "bg-amber-500/15 text-amber-400" :
                      idx === 1 ? "bg-gray-400/10 text-gray-400" :
                      idx === 2 ? "bg-amber-700/10 text-amber-600" :
                      "bg-white/5 text-gray-500"
                    }`}>
                      #{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-xs font-semibold truncate ${hotel.isTarget || (targetHotel?.id === hotel.id) ? "text-blue-300" : "text-white/70"}`}
                        >
                          {hotel.name}
                        </span>
                        <span className="text-xs font-black text-white/80">
                          {(hotel.rating || 0).toFixed(1)} ★
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${((hotel.rating || 0) / 5) * 100}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: idx * 0.08 }}
                          className={`h-full rounded-full ${
                            hotel.isTarget ? "bg-gradient-to-r from-blue-500 to-blue-400" :
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
                <div key={item.label} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
                  <span className={`w-3 h-1 ${item.color} rounded-full`} />
                  <span className="text-[11px] text-gray-400 font-medium">{item.label}</span>
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
