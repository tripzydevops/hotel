"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { getCurrencySymbol } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/utils/supabase/client";
import { useDashboard } from "@/hooks/useDashboard";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
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
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import SentimentBreakdown from "@/components/ui/SentimentBreakdown";
import SentimentBattlefield from "@/components/analytics/SentimentBattlefield";

// Translation map for sentiment keywords
const KEYWORD_TRANSLATIONS: Record<string, string> = {
  hizmet: "Service",
  temizlik: "Cleanliness",
  konum: "Location",
  oda: "Room",
  kahvaltı: "Breakfast",
  fiyat: "Price",
  yemek: "Food",
  havuz: "Pool",
  personel: "Staff",
  sessizlik: "Quietness",
  konfor: "Comfort",
  banyo: "Bathroom",
  yatak: "Bed",
  resepsiyon: "Reception",
  manzara: "View",
  ulaşım: "Transport",
  internet: "Internet",
  wifi: "Wi-Fi",
  otopark: "Parking",
  güvenlik: "Security",
  // Expanded translations for Ramada & others
  dining: "Dining",
  restoran: "Restaurant",
  bar: "Bar",
  "gece hayatı": "Nightlife",
  "sağlıklı yaşam": "Wellness",
  çiftler: "Couples",
  iş: "Business",
  mülk: "Property",
  uyku: "Sleep",
  atmosfer: "Atmosphere",
  kablosuz: "Wi-Fi",
  klima: "A/C",
  fitness: "Fitness",
  erişilebilirlik: "Accessibility",
  mutfak: "Kitchen",
};

// Dynamically import heavy analytics components to improve initial page performance
// These components use client-side libraries like Recharts or D3 which aren't needed on the server
const SentimentRadar = dynamic(() => import("@/components/analytics/SentimentRadar").then(m => m.SentimentRadar), { ssr: false });
const CompetitiveWeakness = dynamic(() => import("@/components/analytics/CompetitiveWeakness").then(m => m.CompetitiveWeakness), { ssr: false });
const AdvisorQuadrant = dynamic(() => import("@/components/analytics/AdvisorQuadrant"), { ssr: false });

/**
 * ScoreCard Component
 * Displays the high-level metrics for a specific hotel, including its rank, rating, and current price.
 * 
 * @param hotel - The hotel data object
 * @param rank - Pre-calculated rank string (e.g., "1st", "2nd")
 * @param isTarget - Boolean indicating if this is the user's focus hotel
 * @param currency - Currency code for price display
 */
const ScoreCard = ({
  hotel,
  rank,
  isTarget,
  currency = "USD",
}: {
  hotel: any;
  rank: string;
  isTarget?: boolean;
  currency?: string;
}) => {
  const { t } = useI18n();
  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return "text-green-400";
    if (rating >= 4.0) return "text-blue-400";
    if (rating >= 3.5) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div
      className={`relative p-5 rounded-xl border transition-all duration-300 group overflow-hidden ${
        isTarget
          ? "bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.15)]"
          : "bg-[#15294A] border-white/5 hover:border-white/10"
      }`}
    >
      {isTarget && (
        <div className="absolute top-0 right-0 p-2">
          <Sparkles className="w-4 h-4 text-blue-400 opacity-50" />
        </div>
      )}

      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
            {isTarget ? t("sentiment.myHotel") : t("sentiment.competitor")}
          </span>
          <h3 className="text-sm font-bold text-white truncate max-w-[140px]">
            {hotel.name}
          </h3>
        </div>
        <div className="bg-black/20 px-2 py-1 rounded text-[10px] font-bold text-gray-400 border border-white/5">
          {rank}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 mb-1">
            {t("sentiment.overallRating")}
          </span>
          <div className="flex items-end gap-1">
            <span className={`text-2xl font-black ${getRatingColor(hotel.rating || 0)}`}>
              {(hotel.rating || 0).toFixed(1)}
            </span>
            <span className="text-[10px] text-gray-500 mb-1.5 font-bold">/ 5.0</span>
          </div>
        </div>
        <div className="flex flex-col text-right">
          <span className="text-xs text-gray-500 mb-1">
            {t("sentiment.currentPrice")}
          </span>
          <div className="flex items-center justify-end gap-1">
            <span className="text-xl font-bold text-white">
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

      <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded text-[10px] text-gray-400">
            <Trophy className="w-3 h-3 text-yellow-500" />
            <span>{(hotel.reviews_count || 0).toLocaleString()} reviews</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
           {hotel.price_info?.price_change_percent !== undefined && (
             <div className={`flex items-center gap-0.5 text-[10px] font-bold ${
               hotel.price_info.price_change_percent > 0 ? "text-red-400" : "text-green-400"
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
    </div>
  );
};

/**
 * CategoryBar Component
 * Renders a comparison bar for a specific sentiment category (e.g., Service, Cleanliness).
 * Shows how "My Hotel" stacks up against the Market Leader and the Market Average.
 * 
 * @param category - The name of the category
 * @param myScore - Sentiment score for the target hotel (0-5)
 * @param leaderScore - Sentiment score for the top competitor in this category
 * @param marketAvg - Average sentiment score across all tracked hotels
 * @param leaderName - Name of the leading competitor for this category
 */
const CategoryBar = ({
  category,
  myScore,
  leaderScore,
  marketAvg,
  leaderName,
}: {
  category: string;
  myScore: number;
  leaderScore: number;
  marketAvg: number;
  leaderName?: string;
}) => {
  const { t } = useI18n();
  const categoryKey = category.toLowerCase();
  const localizedCategory =
    t(`sentiment.${categoryKey}`) !== `sentiment.${categoryKey}`
      ? t(`sentiment.${categoryKey}`)
      : category;

  return (
    <div className="flex flex-col">
      <div className="flex justify-between items-end mb-3">
        <span className="text-sm font-bold text-gray-300">
          {localizedCategory}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-xl font-bold text-white">
            {myScore > 0 ? myScore.toFixed(2) : "N/A"}
          </span>
          <span className="text-[10px] text-gray-500 font-bold">/ 5.0</span>
        </div>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden relative border border-white/5">
        <div
          className={`h-full relative group ${myScore > 0 ? "bg-blue-500" : "bg-gray-700/30"}`}
          style={{ width: `${(Math.max(myScore, 0.5) / 5) * 100}%` }}
        >
          {myScore > 0 && (
            <div className="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
              {t("sentiment.myHotel")}: {myScore.toFixed(2)}
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 space-y-1">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-24 truncate">
            {leaderName || t("sentiment.leader")}
          </span>
          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#D4AF37]"
              style={{ width: `${(leaderScore / 5) * 100}%` }}
            />
          </div>
          <span className="text-xs text-[#D4AF37] font-bold w-8 text-right">
            {leaderScore.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-24">
            {t("sentiment.avgComp")}
          </span>
          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gray-600"
              style={{ width: `${(marketAvg / 5) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 w-8 text-right">
            {marketAvg.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * KeywordTag Component
 * A visual pill representing a specific keyword mention from reviews.
 * Includes count and a tooltip showing a relevant snippet.
 * 
 * @param text - The keyword text (translated if possible)
 * @param count - Number of times this keyword was mentioned
 * @param sentiment - Sentiment bucket (positive, negative, neutral)
 * @param description - A sample review snippet or summary for the tooltip
 */
const KeywordTag = ({
  text,
  count,
  sentiment,
  size = "sm",
  description,
}: {
  text: string;
  count: number;
  sentiment: "positive" | "negative" | "neutral";
  size?: "sm" | "md";
  description?: string;
}) => {
  const t_name = KEYWORD_TRANSLATIONS[text.toLowerCase()] || text;
  const colors = {
    positive: "bg-green-500/10 text-green-400 border-green-500/20",
    negative: "bg-red-500/10 text-red-400 border-red-500/20",
    neutral: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };

  return (
    <div className="group relative inline-block">
      <span
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-medium ${colors[sentiment]} ${
          size === "md" ? "text-sm" : "text-[11px]"
        }`}
      >
        <span className="capitalize">{t_name}</span>
        <span className="w-[1px] h-3 bg-white/10 mx-1" />
        <span className="text-[10px] font-black opacity-80">
          {count > 999 ? (count / 1000).toFixed(1) + "k" : count}
        </span>
      </span>
      {description && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black/90 border border-white/10 rounded-lg text-[9px] text-white font-medium italic leading-tight opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          "{description}"
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/90" />
        </div>
      )}
    </div>
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
    <div className="min-h-screen bg-[#0a1628] p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/analysis"
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("sentiment.backToOverview")}
        </Link>
      </div>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">
            {t("sentiment.title")}
          </h2>
          <p className="text-gray-400">{t("sentiment.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            {t("sentiment.comparingWith")}
          </span>
          <div className="flex flex-wrap gap-2">
            {targetHotel && (
              <button
                onClick={() => {
                  setSelectedHotelIds((prev) => {
                    const exists = prev.includes(targetHotel.id);
                    if (exists)
                      return prev.filter((id) => id !== targetHotel.id);
                    if (prev.length >= 5) return prev;
                    return [...prev, targetHotel.id];
                  });
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                  selectedHotelIds.includes(targetHotel.id)
                    ? "bg-blue-600/20 border-blue-500 text-blue-400 font-bold"
                    : "bg-white/5 border-white/10 text-gray-500 hover:text-gray-300"
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-xs">{t("sentiment.myHotel")}</span>
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
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                  selectedHotelIds.includes(comp.id)
                    ? "bg-amber-600/20 border-amber-500 text-amber-400 font-bold"
                    : "bg-white/5 border-white/10 text-gray-500 hover:text-gray-300"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${allHotels[0]?.id === comp.id ? "bg-amber-500" : "bg-gray-500"}`}
                />
                <span className="text-xs truncate max-w-[80px]">
                  {comp.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : !targetHotel ? (
        <div className="bg-[#15294A] rounded-xl p-8 text-center text-gray-400">
          {t("sentiment.noDataAvailable")}
        </div>
      ) : (
        <>
          {/* Score Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            {isTargetSelected && targetHotel && (
              <ScoreCard
                hotel={targetHotel}
                rank={getRank(targetHotel.id)}
                isTarget
                currency={getCurrencySymbol(
                  targetHotel.price_info?.currency || "USD",
                )}
              />
            )}
            {visibleCompetitors.map((comp: any, idx: number) => {
              const compRank = getRank(comp.id);
              return (
                <ScoreCard
                  key={comp.id}
                  hotel={comp}
                  rank={compRank}
                  currency={getCurrencySymbol(
                    comp.price_info?.currency || "USD",
                  )}
                />
              );
            })}
          </div>

          {/* Intelligence Hub */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
            {/* Left Hub: Radar + Category Bars */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-8 bg-[#15294A] rounded-xl p-6 border border-white/5"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Radar className="w-5 h-5 text-blue-400" />
                  Experience Core
                </h3>
                {isTargetLeader && (
                  <div className="flex items-center gap-2 bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded-full text-xs font-bold border border-yellow-500/20">
                    <Trophy className="w-3 h-3" />
                    Market Leader
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-8">
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
                <div className="flex items-center justify-center bg-[#0a1628]/30 rounded-xl p-4 border border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full" />
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/5 blur-3xl rounded-full" />
                  <SentimentRadar
                    data={radarData}
                  />
                </div>
              </div>
            </motion.div>

            {/* Right Hub: Advisor Quadrant + Competitive Vulnerability */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex-1 bg-gradient-to-br from-[#15294A] to-[#1a3a6a] rounded-xl p-6 border border-white/5 shadow-xl relative overflow-hidden group"
              >
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Brain className="w-12 h-12 text-blue-400" />
                 </div>
                 <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                    Strategic Map
                 </h3>
                 {strategicMap && (
                   <AdvisorQuadrant
                     x={strategicMap.x}
                     y={strategicMap.y}
                     label={strategicMap.label}
                     ari={strategicMap.ari}
                     sentiment={strategicMap.sentiment}
                     targetRating={strategicMap.targetRating}
                     marketRating={strategicMap.marketRating}
                   />
                 )}
              </motion.div>
              
              <CompetitiveWeakness
                competitors={visibleCompetitors}
                t={t}
              />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#15294A] rounded-xl p-6 border border-white/5 mb-6"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Sentiment Deep Dive
              </h3>
            </div>
            <SentimentBreakdown
              items={
                (targetHotel.sentiment_raw_breakdown ||
                targetHotel.sentiment_breakdown || [])
                .map((s: any) => ({
                   ...s,
                   description: s.description || s.summary
                }))
                .filter((item: any) => item.total_mentioned > 0)
                .slice(0, 24)
              }
            />
          </motion.div>

          {/* Sentiment Trend Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-[#15294A] rounded-xl p-6 border border-white/5"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <LineChart className="w-5 h-5 text-purple-400" />
                Competitive Position
              </h3>
              <div className="flex bg-[#0a1628] rounded-lg p-1 border border-white/5">
                {(["battlefield", "history"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`px-3 py-1.5 rounded-md text-xs transition-all ${
                      view === v
                        ? "bg-blue-600 text-white shadow-lg"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {v === "battlefield" ? "Battlefield" : "History"}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {(["daily", "weekly", "monthly"] as const).map((tf) => (
                  <button
                    key={tf}
                    disabled={view === "battlefield"}
                    onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                      view === "battlefield"
                        ? "opacity-30 cursor-not-allowed"
                        : timeframe === tf
                        ? "bg-blue-600 text-white border-blue-600 font-bold"
                        : "bg-[#0a1628] text-white border-gray-600 hover:border-gray-500"
                    }`}
                  >
                    {tf.charAt(0).toUpperCase() + tf.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {view === "battlefield" ? (
              <div className="mb-12">
                <SentimentBattlefield 
                  targetHotel={targetHotel as any} 
                  competitors={visibleCompetitors as any} 
                  sentimentHistory={sentimentHistory}
                />
              </div>
            ) : (
              <>
                <div className="h-[400px] w-full relative mb-12">
                  <div className="absolute inset-0 flex items-end">
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
                          .map((h, i) => {
                            const val = Number(h.rating) || 3;
                            const x = (i / (history.length - 1)) * 100;
                            const y = 100 - ((val - minScore) / range) * 100;
                            return `${x},${y}`;
                          })
                          .join(" ");

                        const isTarget = id === targetHotel.id;

                        return (
                          <svg
                            key={id}
                            className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                          >
                            <polyline
                              points={points}
                              fill="none"
                              stroke={isTarget ? "#3b82f6" : "#6b7280"}
                              strokeWidth={isTarget ? "1.5" : "0.5"}
                              strokeDasharray={isTarget ? "0" : "1 1"}
                              className="transition-all duration-1000"
                            />
                          </svg>
                        );
                      });
                    })()}
                  </div>
                  <div className="flex justify-between mt-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest px-1">
                    {(function() {
                      const firstHist = Object.values(sentimentHistory)[0] || [];
                      if (firstHist.length < 2) return null;
                      return [firstHist[0], firstHist[Math.floor(firstHist.length/2)], firstHist[firstHist.length-1]].map((h: any, i) => {
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

            {/* Visual Ranking Display */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allHotels
                .filter((h) => selectedHotelIds.includes(h.id))
                .map((hotel, idx) => (
                  <div
                    key={hotel.id}
                    className="flex items-center gap-3 p-3 bg-[#0a1628]/40 rounded-lg border border-white/5"
                  >
                    <span className="text-xs font-bold text-gray-500 w-4">
                      #{idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-medium truncate ${hotel.isTarget ? "text-blue-400" : "text-gray-300"}`}
                        >
                          {hotel.name}
                        </span>
                        <span className="text-xs font-bold text-white">
                          {(hotel.rating || 0).toFixed(1)} ★
                        </span>
                      </div>
                      <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${hotel.isTarget ? "bg-blue-500" : idx === 0 ? "bg-[#D4AF37]" : "bg-gray-600"}`}
                          style={{
                            width: `${((hotel.rating || 0) / 5) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-6 mt-8">
              <div className="flex items-center gap-2">
                <span className="w-4 h-1 bg-blue-600 rounded-full" />
                <span className="text-sm text-gray-300">My Hotel</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-1 bg-[#D4AF37] rounded-full" />
                <span className="text-sm text-gray-300">Market Leader</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-1 bg-gray-500 rounded-full" />
                <span className="text-sm text-gray-300">Competitors</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
