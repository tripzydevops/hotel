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
import { getCurrencySymbol, parsePrice } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useDashboard } from "@/hooks/useDashboard";
import { useGuestMentions } from "@/hooks/useGuestMentions";
import { useGroupedMentions } from "@/hooks/useGroupedMentions";
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
  MessageSquare,
  Users,
  MapPin,
  Coins,
  Moon,
  Bed,
  Coffee,
  Heart,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import SentimentBreakdown from "@/components/ui/SentimentBreakdown";
import SentimentBattlefield from "@/components/analytics/SentimentBattlefield";
// DRY: Pure sentiment utilities extracted to a shared helper module
import { getCategoryScore } from "@/scripts/sentimentHelpers";
import { GuestMentionsMatrix } from "@/components/ui/sentiment/GuestMentionsMatrix";
import { ScoreCard } from "@/components/ui/sentiment/ScoreCard";
import { CategoryBar } from "@/components/ui/sentiment/CategoryBar";
import { KeywordTag } from "@/components/ui/sentiment/KeywordTag";
import {
  KEYWORD_TRANSLATIONS,
  getCategoryIcon,
  getCategoryGlow,
  getCategoryDotColor,
  getCategoryDisplayName,
} from "@/components/ui/sentiment/sentimentUIHelpers";

/* ── Stagger animation variants (per frontend-ui-dark-ts skill) ── */
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0, 0, 0.58, 1] as const } },
};

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
      const compLimit = data?.comparison_limit || 5;
      const initialIds = [targetHotel.id, ...competitors.map((c: any) => c.id)];
      setSelectedHotelIds(initialIds.slice(0, compLimit));
      setInitialized(true);
    }
  }, [targetHotel, competitors, initialized, data?.comparison_limit]);

  // 4. Sentiment History State & Fetching Effect
  const [sentimentHistory, setSentimentHistory] = useState<Record<string, any[]>>({});

  useEffect(() => {
    const fetchHistory = async () => {
      if (selectedHotelIds.length === 0) return;

      const days = timeframe === "daily" ? 7 : timeframe === "weekly" ? 30 : 90;

      // PERF_FIX: Fetch all hotels' sentiment history in parallel.
      // Previously this was a serial for...of loop — with 5 hotels, 5× slower.
      // Promise.allSettled ensures one failure doesn't abort the rest.
      const results = await Promise.allSettled(
        selectedHotelIds.map((id) => api.getSentimentHistory(id, days))
      );

      const historyMap: Record<string, any[]> = {};
      results.forEach((result, idx) => {
        const id = selectedHotelIds[idx];
        if (result.status === "fulfilled" && result.value?.history) {
          historyMap[id] = result.value.history;
        } else if (result.status === "rejected") {
          console.error(`[Sentiment] Error fetching history for ${id}:`, result.reason);
        }
      });

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

  // getCategoryScore is imported from @/scripts/sentimentHelpers
  // (extracted for reuse, testability, and memoization)



  /**
   * Strategic Map Logic (Advisor Quadrant)
   * Calculates coordinates for the Price vs. Sentiment matrix.
   */
  const strategicMap = useMemo(() => {
    if (!targetHotel) return null;
    const myPrice = parsePrice(targetHotel.price_info?.current_price || 0);
    const myRating = Number(targetHotel.rating) || 0;
    const validCompetitors = competitors.filter((c: any) => c.price_info?.current_price);

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


  // 6. Visualization Data (Radar)
  const radarData = useMemo(() => {
    if (!targetHotel) return [];
    return ["Cleanliness", "Service", "Location", "Value"].map((cat) => ({
      subject: t(`sentiment.${cat.toLowerCase()}`) !== `sentiment.${cat.toLowerCase()}`
        ? t(`sentiment.${cat.toLowerCase()}`)
        : cat,
      myHotel: getCategoryScore(targetHotel, cat, sentimentHistory[targetHotel.id]),
      marketLeader: leader ? getCategoryScore(leader, cat, sentimentHistory[leader.id]) : 0,
      marketAvg: marketAvgRating || 3, // Fallback to neutral 3 if avg unavailable
    }));
  }, [targetHotel, leader, sentimentHistory, marketAvgRating, t]);

  // 6b. Premium Guest Mentions Extraction & Synthesis (KAİZEN)
  const guestMentions = useGuestMentions(targetHotel, locale);
  const groupedMentions = useMemo(() => {
    const groups: Record<string, any[]> = {};
    guestMentions.forEach((m: any) => {
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
    competitors.filter((c: any) => selectedHotelIds.includes(c.id))
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
              {competitors.map((comp: any) => (
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
                  customInsight={data?.market_insight}
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
                  <div className="flex items-center justify-center bg-[var(--bg-accent)] rounded-2xl p-8 border border-white/[0.05] relative overflow-hidden">
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
              <GuestMentionsMatrix groupedMentions={groupedMentions} locale={locale} />

              <SentimentBreakdown
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
                  {(["battlefield", "history"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                        view === v
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                          : "text-slate-700 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
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
                    <div className="absolute bottom-2 left-10 right-4 flex justify-between text-[11px] text-slate-800 dark:text-gray-400 font-bold tracking-wide">
                      {(function () {
                        const firstHist = Object.values(sentimentHistory)[0] || [];
                        if (firstHist.length < 2) return null;
                        return [firstHist[0], firstHist[Math.floor(firstHist.length / 2)], firstHist[firstHist.length - 1]].map((h: any, i: number) => {
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
