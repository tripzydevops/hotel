"use client";

import { useEffect, useState } from "react";
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
        <span className="text-xs text-gray-400">Rating</span>
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

  // Convert rating to percentage (assuming 5-star scale)
  const percentage = (score / 5) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-[#15294A] rounded-xl p-6 border ${borderColor} relative overflow-hidden group transition-colors`}
    >
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon className="w-16 h-16" style={{ color: progressColor }} />
      </div>

      <div className="flex justify-between items-start mb-4">
        <div>
          <p
            className={`${labelColor} font-bold text-sm uppercase tracking-wider mb-1`}
          >
            {type === "my-hotel"
              ? "My Hotel"
              : type === "leader"
                ? "Market Leader"
                : "Competitor"}
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

      <div className="flex items-center gap-6">
        <RadialProgress
          percentage={percentage}
          score={score}
          color={progressColor}
        />
        <div className="flex flex-col gap-2">
          <div className="text-sm text-gray-400">
            Rank:{" "}
            <span
              className={`font-bold ${type === "leader" ? "text-[#D4AF37]" : "text-white"}`}
            >
              {rank}
            </span>
          </div>
          {price !== undefined && (
            <div className="text-sm text-gray-400">
              Price:{" "}
              <span className="text-white font-bold">
                {currency}
                {price?.toLocaleString()}
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
  leaderName: string;
  leaderScore: number;
  marketAvg: number;
}) => {
  return (
    <div>
      <div className="flex justify-between mb-2">
        <span className="text-sm font-medium text-gray-300">{category}</span>
        <span className="text-sm font-bold text-blue-500">
          {myScore.toFixed(1)}/5
        </span>
      </div>
      <div className="w-full h-8 bg-[#0a1628] rounded-full relative overflow-hidden flex items-center px-1">
        <div
          className="h-5 rounded-full bg-blue-500 relative group"
          style={{ width: `${(myScore / 5) * 100}%` }}
        >
          <div className="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
            You: {myScore.toFixed(1)}
          </div>
        </div>
      </div>
      <div className="mt-2 space-y-1">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-24 truncate">
            {leaderName}
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
          <span className="text-xs text-gray-500 w-24">Avg. Market</span>
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

  // Build hotel list from real data
  const targetHotel = data?.target_hotel;
  const competitors = data?.competitors || [];

  // Sort all hotels by rating to determine ranks
  const allHotels = [
    ...(targetHotel ? [{ ...targetHotel, isTarget: true }] : []),
    ...competitors.map((c: any) => ({ ...c, isTarget: false })),
  ].sort((a, b) => (b.rating || 0) - (a.rating || 0));

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
    if (idx === 0) return "1st";
    if (idx === 1) return "2nd";
    if (idx === 2) return "3rd";
    return `${idx + 1}th`;
  };

  // Currency symbol
  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = {
      USD: "$",
      EUR: "€",
      GBP: "£",
      TRY: "₺",
    };
    return symbols[currency] || "$";
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
          Back to Overview
        </Link>
      </div>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">
            Sentiment Comparison
          </h2>
          <p className="text-gray-400">
            Benchmarking your property against the local competitive set.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">Comparing with:</span>
          <div className="flex -space-x-2">
            {competitors.slice(0, 4).map((comp: any, idx: number) => (
              <div
                key={comp.id}
                className="w-8 h-8 rounded-full border-2 border-[#0a1628] bg-gray-600 flex items-center justify-center text-xs font-bold"
                title={comp.name}
              >
                {comp.name?.substring(0, 2).toUpperCase()}
              </div>
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
          No hotel data available. Please add a target hotel first.
        </div>
      ) : (
        <>
          {/* Score Cards Grid - Up to 5 hotels (1 target + 4 competitors) */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
            {/* Target Hotel Card */}
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

            {/* Competitor Cards */}
            {competitors.slice(0, 4).map((comp: any, idx: number) => {
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
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  Rating Comparison
                </h3>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-gray-400">My Hotel</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#D4AF37]" />
                    <span className="text-gray-400">Leader</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-gray-600" />
                    <span className="text-gray-400">Avg.</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Overall Rating Category */}
                <CategoryBar
                  category="Overall Rating"
                  myScore={targetHotel.rating || 0}
                  leaderName={leader?.name || "Leader"}
                  leaderScore={leader?.rating || 0}
                  marketAvg={marketAvgRating}
                />
                {/* Price Comparison as a visual */}
                {targetHotel.price_info?.current_price && (
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium text-gray-300">
                        Price Position
                      </span>
                      <span className="text-sm font-bold text-blue-500">
                        {getCurrencySymbol(
                          targetHotel.price_info.currency || "USD",
                        )}
                        {targetHotel.price_info.current_price?.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Market range:{" "}
                      {getCurrencySymbol(
                        targetHotel.price_info.currency || "USD",
                      )}
                      {Math.min(
                        ...allHotels
                          .map((h) => h.price_info?.current_price || 0)
                          .filter((p) => p > 0),
                      )?.toLocaleString()}{" "}
                      -
                      {getCurrencySymbol(
                        targetHotel.price_info.currency || "USD",
                      )}
                      {Math.max(
                        ...allHotels.map(
                          (h) => h.price_info?.current_price || 0,
                        ),
                      )?.toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Keyword Cloud */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-[#15294A] rounded-xl p-6 border border-white/5 flex flex-col"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Brain className="w-5 h-5 text-green-400" />
                  Quick Insights
                </h3>
              </div>

              <div className="flex-1 relative bg-[#0a1628]/50 rounded-lg p-4 overflow-hidden border border-white/5">
                <div className="flex flex-wrap gap-2 content-center justify-center h-full">
                  {/* Generate insight tags based on actual data */}
                  {targetHotel.rating >= 4.5 && (
                    <KeywordTag
                      text="Highly Rated"
                      sentiment="positive"
                      size="lg"
                    />
                  )}
                  {targetHotel.rating >= marketAvgRating && (
                    <KeywordTag
                      text="Above Average"
                      sentiment="positive"
                      size="md"
                    />
                  )}
                  {targetHotel.rating < marketAvgRating && (
                    <KeywordTag
                      text="Below Market Avg"
                      sentiment="negative"
                      size="md"
                    />
                  )}
                  {targetHotel.price_info?.trend === "up" && (
                    <KeywordTag
                      text="Price Rising"
                      sentiment="neutral"
                      size="sm"
                    />
                  )}
                  {targetHotel.price_info?.trend === "down" && (
                    <KeywordTag
                      text="Price Dropping"
                      sentiment="positive"
                      size="sm"
                    />
                  )}
                  {isTargetLeader && (
                    <KeywordTag
                      text="Market Leader"
                      sentiment="positive"
                      size="lg"
                    />
                  )}
                  {competitors.length > 0 && (
                    <KeywordTag
                      text={`${competitors.length} Competitors`}
                      sentiment="neutral"
                      size="sm"
                    />
                  )}
                </div>
              </div>

              {/* AI Insight */}
              <div className="mt-4 p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-blue-100 font-medium mb-1">
                    AI Insight
                  </p>
                  <p className="text-xs text-blue-300 leading-relaxed">
                    {isTargetLeader
                      ? "You're currently the market leader! Maintain your competitive edge by monitoring competitor pricing."
                      : `You're ranked ${getRank(targetHotel.id)} in your competitive set. ${
                          targetHotel.rating < marketAvgRating
                            ? "Consider improving guest experience to boost ratings."
                            : "Your rating is competitive. Focus on value proposition."
                        }`}
                  </p>
                </div>
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

            {/* Visual Ranking Display */}
            <div className="space-y-4">
              {allHotels.map((hotel, idx) => (
                <div key={hotel.id} className="flex items-center gap-4">
                  <span className="text-sm font-bold text-gray-400 w-8">
                    #{idx + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-sm font-medium ${hotel.isTarget ? "text-blue-400" : "text-gray-300"}`}
                      >
                        {hotel.name}
                      </span>
                      <span className="text-sm font-bold text-white">
                        {(hotel.rating || 0).toFixed(1)} ★
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${hotel.isTarget ? "bg-blue-500" : idx === 0 ? "bg-[#D4AF37]" : "bg-gray-600"}`}
                        style={{ width: `${((hotel.rating || 0) / 5) * 100}%` }}
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
