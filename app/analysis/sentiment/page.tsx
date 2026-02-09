"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import Link from "next/link";

// Radial Progress Component
const RadialProgress = ({
  percentage,
  score,
  color,
}: {
  percentage: number;
  score: number;
  color: string;
}) => {
  const { t } = useI18n();
  return (
    <div
      className="relative w-[120px] h-[120px] rounded-full flex items-center justify-center"
      style={{
        background: `conic-gradient(${color} ${percentage * 3.6}deg, #0a1628 0deg)`,
      }}
    >
      <div className="absolute w-[100px] h-[100px] bg-[#15294A] rounded-full" />
      <div className="relative z-10 flex flex-col items-center">
        <span className="text-3xl font-bold text-white">{score}</span>
        <span className="text-xs text-gray-400">
          {t("hotelDetails.intelSummary")}
        </span>
      </div>
    </div>
  );
};

// Score Card Component
const ScoreCard = ({
  type,
  name,
  score,
  trend,
  trendValue,
  rank,
  reviews,
  price,
  currency,
  icon: Icon,
}: {
  type: "my-hotel" | "leader" | "competitor";
  name: string;
  score: number;
  trend: "up" | "down" | "neutral";
  trendValue: string;
  rank: string;
  reviews?: number;
  price?: number;
  currency?: string;
  icon: any;
}) => {
  const borderColor =
    type === "my-hotel"
      ? "border-blue-500/30 hover:border-blue-500/60"
      : type === "leader"
        ? "border-[#D4AF37]/30 hover:border-[#D4AF37]/60"
        : "border-white/5 hover:border-white/10";

  const labelColor =
    type === "my-hotel"
      ? "text-blue-500"
      : type === "leader"
        ? "text-[#D4AF37]"
        : "text-gray-500";

  const progressColor =
    type === "my-hotel" ? "#1152d4" : type === "leader" ? "#D4AF37" : "#64748b";

  const { t } = useI18n();

  const percentage = (score / 5) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-[#15294A] rounded-xl p-6 border ${borderColor} relative overflow-hidden group transition-colors`}
    >
      <div className="absolute -top-4 -right-4 transition-opacity opacity-20 pointer-events-none group-hover:opacity-30">
        <Icon
          className="w-24 h-24 rotate-12"
          style={{ color: progressColor }}
        />
      </div>

      <div className="flex justify-between items-start mb-4 relative z-10">
        <div>
          <p
            className={`${labelColor} font-bold text-xs uppercase tracking-widest mb-1`}
          >
            {type === "my-hotel"
              ? t("common.myHotel")
              : type === "leader"
                ? t("sentiment.leader")
                : t("common.competitor")}
          </p>
          <h3 className="text-xl font-bold text-white truncate max-w-[180px]">
            {name}
          </h3>
        </div>
        {trend !== "neutral" && (
          <div
            className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 ${
              trend === "up"
                ? "bg-green-500/20 text-green-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {trend === "up" ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            {trendValue}
          </div>
        )}
      </div>

      <div className="flex items-center gap-6 relative z-10">
        <RadialProgress
          percentage={percentage}
          score={score}
          color={progressColor}
        />
        <div className="flex flex-col gap-2">
          <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">
            {t("analysis.competitiveRank")}:{" "}
            <span
              className={`text-sm ${type === "leader" ? "text-[#D4AF37]" : "text-white"}`}
            >
              {rank}
            </span>
          </div>
          {price !== undefined && (
            <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">
              {t("hotelDetails.price")}:{" "}
              <span className="text-white text-sm">
                {getCurrencySymbol(currency || "USD")}
                {price.toLocaleString()}
              </span>
            </div>
          )}
          {reviews !== undefined && reviews > 0 && (
            <div className="text-sm text-gray-400">
              Reviews:{" "}
              <span className="text-white font-bold">
                {reviews?.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Category Bar Component
const CategoryBar = ({
  category,
  myScore,
  leaderName,
  leaderScore,
  marketAvg,
}: {
  category: string;
  myScore: number;
  leaderName?: string;
  leaderScore: number;
  marketAvg: number;
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
            {myScore.toFixed(1)}
          </span>
          <span className="text-[10px] text-gray-500 font-bold">/ 5.0</span>
        </div>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden relative border border-white/5">
        <div
          className="h-full bg-blue-500 relative group"
          style={{ width: `${(myScore / 5) * 100}%` }}
        >
          <div className="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
            {t("sentiment.myHotel")}: {myScore.toFixed(1)}
          </div>
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
            {leaderScore.toFixed(1)}
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
            {marketAvg.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
};

// Keyword Tag Component
const KeywordTag = ({
  text,
  count,
  sentiment,
  size = "sm",
}: {
  text: string;
  count?: number;
  sentiment: "positive" | "negative" | "neutral";
  size?: "sm" | "md" | "lg";
}) => {
  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-2 text-base font-bold",
  };
  const colorClasses = {
    positive: "bg-green-900/40 text-green-300 border-green-700/50",
    negative: "bg-red-900/40 text-red-300 border-red-700/50",
    neutral: "bg-gray-700/40 text-gray-300 border-gray-600/50",
  };

  return (
    <span
      className={`${sizeClasses[size]} ${colorClasses[sentiment]} rounded-lg border`}
    >
      {text}{" "}
      {count &&
        (sentiment === "positive"
          ? `+${count}`
          : sentiment === "negative"
            ? `-${count}`
            : "")}
    </span>
  );
};

export default function SentimentPage() {
  const { t } = useI18n();
  const { userId } = useAuth();
  const { data, loading } = useDashboard(userId, t);
  const [timeframe, setTimeframe] = useState<"daily" | "weekly" | "monthly">(
    "weekly",
  );
  const [selectedHotelIds, setSelectedHotelIds] = useState<string[]>([]);

  // Build hotel list from real data
  const targetHotel = data?.target_hotel;
  const competitors = data?.competitors || [];

  // Initialize selected hotels once data is loaded
  useEffect(() => {
    if (targetHotel && selectedHotelIds.length === 0) {
      // Default to target + all competitors (up to 5 total)
      const initialIds = [targetHotel.id, ...competitors.map((c: any) => c.id)];
      setSelectedHotelIds(initialIds.slice(0, 5));
    }
  }, [targetHotel, competitors, selectedHotelIds.length]);

  // Sort all hotels by rating to determine ranks
  const allHotels = [
    ...(targetHotel ? [{ ...targetHotel, isTarget: true }] : []),
    ...competitors.map((c: any) => ({ ...c, isTarget: false })),
  ].sort((a, b) => (b.rating || 0) - (a.rating || 0));

  // Filtered lists based on selection
  const visibleCompetitors = competitors.filter((c: any) =>
    selectedHotelIds.includes(c.id),
  );
  const isTargetSelected =
    targetHotel && selectedHotelIds.includes(targetHotel.id);

  // Fetch sentiment history for selected hotels
  const [sentimentHistory, setSentimentHistory] = useState<
    Record<string, any[]>
  >({});

  useEffect(() => {
    const fetchHistory = async () => {
      const historyMap: Record<string, any[]> = {};
      const days = timeframe === "daily" ? 7 : timeframe === "weekly" ? 30 : 90;

      for (const id of selectedHotelIds) {
        try {
          const res = await api.getSentimentHistory(id, days);
          if (res.history) {
            historyMap[id] = res.history;
          }
        } catch (err) {
          console.error(`Error fetching history for ${id}:`, err);
        }
      }
      setSentimentHistory(historyMap);
    };

    if (selectedHotelIds.length > 0) {
      fetchHistory();
    }
  }, [selectedHotelIds, timeframe]);

  // Find the leader (highest rated)
  const leader = allHotels[0];
  const isTargetLeader = leader?.isTarget;

  // Calculate market average
  const marketAvgRating =
    allHotels.length > 0
      ? allHotels.reduce((sum, h) => sum + (h.rating || 0), 0) /
        allHotels.length
      : 0;

  // Get rank for a hotel
  const getRank = (hotelId: string) => {
    const idx = allHotels.findIndex((h) => h.id === hotelId);
    if (idx === 0) return `1${t("sentiment.rankSuffix.st")}`;
    if (idx === 1) return `2${t("sentiment.rankSuffix.nd")}`;
    if (idx === 2) return `3${t("sentiment.rankSuffix.rd")}`;
    return `${idx + 1}${t("sentiment.rankSuffix.th")}`;
  };

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
          {/* Score Cards Grid - Up to 5 hotels selectable */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
            {/* Target Hotel Card */}
            {isTargetSelected && targetHotel && (
              <ScoreCard
                type={isTargetLeader ? "leader" : "my-hotel"}
                name={targetHotel.name || "My Hotel"}
                score={Number((targetHotel.rating || 0).toFixed(1))}
                trend={
                  targetHotel.price_info?.trend === "up"
                    ? "up"
                    : targetHotel.price_info?.trend === "down"
                      ? "down"
                      : "neutral"
                }
                trendValue={
                  targetHotel.price_info?.change_percent
                    ? `${Math.abs(targetHotel.price_info.change_percent).toFixed(1)}%`
                    : ""
                }
                rank={getRank(targetHotel.id)}
                price={targetHotel.price_info?.current_price}
                currency={getCurrencySymbol(
                  targetHotel.price_info?.currency || "USD",
                )}
                icon={isTargetLeader ? Trophy : Hotel}
              />
            )}

            {/* Competitor Cards */}
            {visibleCompetitors.map((comp: any, idx: number) => {
              const isCompLeader =
                !isTargetLeader && allHotels[0]?.id === comp.id;
              return (
                <ScoreCard
                  key={comp.id}
                  type={isCompLeader ? "leader" : "competitor"}
                  name={comp.name || `Competitor ${idx + 1}`}
                  score={Number((comp.rating || 0).toFixed(1))}
                  trend={
                    comp.price_info?.trend === "up"
                      ? "up"
                      : comp.price_info?.trend === "down"
                        ? "down"
                        : "neutral"
                  }
                  trendValue={
                    comp.price_info?.change_percent
                      ? `${Math.abs(comp.price_info.change_percent).toFixed(1)}%`
                      : ""
                  }
                  rank={getRank(comp.id)}
                  price={comp.price_info?.current_price}
                  currency={getCurrencySymbol(
                    comp.price_info?.currency || "USD",
                  )}
                  icon={isCompLeader ? Trophy : Building2}
                />
              );
            })}
          </div>

          {/* Category Breakdown & Keywords */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Category Breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-2 bg-[#15294A] rounded-xl p-6 border border-white/5"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  {t("sentiment.categoryBreakdown")}
                </h3>
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-gray-400">
                      {t("sentiment.myHotel")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#D4AF37]" />
                    <span className="text-gray-400">
                      {leader?.name || t("sentiment.leader")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-gray-600" />
                    <span className="text-gray-400">
                      {t("sentiment.avgComp")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-10">
                {/* Cleanliness */}
                <CategoryBar
                  category="Cleanliness"
                  myScore={
                    targetHotel.sentiment_breakdown?.find(
                      (s: any) =>
                        s.name === "Cleanliness" ||
                        s.category === "Cleanliness",
                    )?.rating || 0
                  }
                  leaderName={leader?.name}
                  leaderScore={
                    leader?.sentiment_breakdown?.find(
                      (s: any) =>
                        s.name === "Cleanliness" ||
                        s.category === "Cleanliness",
                    )?.rating || 0
                  }
                  marketAvg={marketAvgRating}
                />
                {/* Service */}
                <CategoryBar
                  category="Service"
                  myScore={
                    targetHotel.sentiment_breakdown?.find(
                      (s: any) =>
                        s.name === "Service" || s.category === "Service",
                    )?.rating || 0
                  }
                  leaderName={leader?.name}
                  leaderScore={
                    leader?.sentiment_breakdown?.find(
                      (s: any) =>
                        s.name === "Service" || s.category === "Service",
                    )?.rating || 0
                  }
                  marketAvg={marketAvgRating - 0.2}
                />
                {/* Location */}
                <CategoryBar
                  category="Location"
                  myScore={
                    targetHotel.sentiment_breakdown?.find(
                      (s: any) =>
                        s.name === "Location" || s.category === "Location",
                    )?.rating || 0
                  }
                  leaderName={leader?.name}
                  leaderScore={
                    leader?.sentiment_breakdown?.find(
                      (s: any) =>
                        s.name === "Location" || s.category === "Location",
                    )?.rating || 0
                  }
                  marketAvg={marketAvgRating + 0.1}
                />
                {/* Value */}
                <CategoryBar
                  category="Value"
                  myScore={
                    targetHotel.sentiment_breakdown?.find(
                      (s: any) => s.name === "Value" || s.category === "Value",
                    )?.rating || 0
                  }
                  leaderName={leader?.name}
                  leaderScore={
                    leader?.sentiment_breakdown?.find(
                      (s: any) => s.name === "Value" || s.category === "Value",
                    )?.rating || 0
                  }
                  marketAvg={marketAvgRating}
                />
              </div>
            </motion.div>

            {/* Guest Mentions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-[#15294A] rounded-xl p-6 border border-white/5 flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Brain className="w-5 h-5 text-green-400" />
                  {t("sentiment.guestMentions")}
                </h3>
              </div>

              <div className="flex-1">
                <div className="flex flex-wrap gap-3 mb-8">
                  {targetHotel.guest_mentions &&
                  targetHotel.guest_mentions.length > 0 ? (
                    targetHotel.guest_mentions.map(
                      (mention: any, idx: number) => (
                        <KeywordTag
                          key={idx}
                          text={mention.keyword || mention.text} // Fix: Handle both 'keyword' (DB) and 'text' keys
                          count={mention.count}
                          sentiment={mention.sentiment}
                          size={
                            mention.count > 50
                              ? "lg"
                              : mention.count > 20
                                ? "md"
                                : "sm"
                          }
                        />
                      ),
                    )
                  ) : (
                    <p className="text-gray-500 text-sm italic">
                      {t("sentiment.noMentions")}
                    </p>
                  )}
                </div>

                {/* AI Insight */}
                {targetHotel.guest_mentions &&
                  targetHotel.guest_mentions.length > 0 && (
                    <div className="p-4 bg-blue-900/10 border border-blue-800/20 rounded-xl flex items-start gap-4">
                      <Sparkles className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="text-sm font-bold text-blue-300 mb-1">
                          {t("sentiment.aiInsight")}
                        </h4>
                        <p className="text-xs text-blue-200/80 leading-relaxed">
                          Analysis indicates a strong positive trend in{" "}
                          <span className="text-green-400 font-bold">
                            {targetHotel.guest_mentions.find(
                              (m: any) => m.sentiment === "positive",
                            )?.keyword ||
                              targetHotel.guest_mentions.find(
                                (m: any) => m.sentiment === "positive",
                              )?.text ||
                              "Service"}
                          </span>
                          . Keep up the good work!
                        </p>
                      </div>
                    </div>
                  )}
              </div>
            </motion.div>
          </div>

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
              <div className="flex gap-2">
                {(["daily", "weekly", "monthly"] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                      timeframe === tf
                        ? "bg-blue-600 text-white border-blue-600 font-bold"
                        : "bg-[#0a1628] text-white border-gray-600 hover:border-gray-500"
                    }`}
                  >
                    {tf.charAt(0).toUpperCase() + tf.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Trend Chart or Ranking Bars */}
            <div className="h-[400px] w-full relative mb-12">
              <div className="absolute inset-0 flex items-end justify-between px-2 pb-8 border-b border-white/10">
                {/* Chart Background Grid */}
                {[5.0, 4.0, 3.0, 2.0, 1.0].map((rating) => (
                  <div
                    key={rating}
                    className="absolute w-full border-t border-white/5 flex items-center"
                    style={{ bottom: `${(rating / 5) * 100}%` }}
                  >
                    <span className="text-[10px] text-gray-500 -ml-10 font-bold">
                      {rating.toFixed(1)}
                    </span>
                  </div>
                ))}

                {/* Multi-Line Trend Visualization with Area Fill */}
                <svg
                  className="absolute inset-0 w-full h-full overflow-visible"
                  preserveAspectRatio="none"
                  viewBox="0 0 1000 100"
                >
                  <defs>
                    <linearGradient id="blue-area" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="gold-area" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.1" />
                      <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Render Area Fills First */}
                  {selectedHotelIds.map((id, hotelIdx) => {
                    const hotel = allHotels.find((h) => h.id === id);
                    const history = sentimentHistory[id] || [];
                    if (history.length < 2) return null;

                    const gradient = hotel?.isTarget
                      ? "url(#blue-area)"
                      : hotelIdx === 0
                        ? "url(#gold-area)"
                        : "none";
                    if (gradient === "none") return null;

                    const points = history
                      .map((h, i) => {
                        const x = (i / (history.length - 1)) * 1000;
                        const y = (1 - h.rating / 5) * 100;
                        return `${x},${y}`;
                      })
                      .reverse();

                    const areaPoints = `0,100 ${points.join(" ")} 1000,100`;

                    return (
                      <polygon
                        key={`area-${id}`}
                        points={areaPoints}
                        fill={gradient}
                        className="transition-all duration-700"
                      />
                    );
                  })}

                  {/* Render Lines */}
                  {selectedHotelIds.map((id, hotelIdx) => {
                    const hotel = allHotels.find((h) => h.id === id);
                    const history = sentimentHistory[id] || [];
                    if (history.length < 2) return null;

                    const color = hotel?.isTarget
                      ? "#3b82f6"
                      : hotelIdx === 0
                        ? "#D4AF37"
                        : "#6b7280";
                    const isDashed = !hotel?.isTarget && hotelIdx !== 0;

                    return (
                      <polyline
                        key={`line-${id}`}
                        points={history
                          .map((h, i) => {
                            const x = (i / (history.length - 1)) * 1000;
                            const y = (1 - h.rating / 5) * 100;
                            return `${x},${y}`;
                          })
                          .reverse()
                          .join(" ")}
                        fill="none"
                        stroke={color}
                        strokeWidth={hotel?.isTarget ? "4" : "2"}
                        strokeDasharray={isDashed ? "5,5" : "0"}
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                        className="transition-all duration-700"
                      />
                    );
                  })}

                  {/* Tooltip Indicator / Event Hub (Design Matching) */}
                </svg>
              </div>

              {/* X-Axis Labels */}
              <div className="flex justify-between mt-6 text-[11px] text-gray-500 font-bold uppercase tracking-widest">
                <span>Jun</span>
                <span>Jul</span>
                <span>Aug</span>
                <span>Sep</span>
                <span>Oct</span>
                <span>Nov</span>
              </div>
            </div>

            {/* Visual Ranking Display (Kept as secondary summary) */}
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
