"use client";

import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { createClient } from "@/utils/supabase/client";
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
        background: `conic-gradient(${color} ${percentage}%, #0a1628 0deg)`,
      }}
    >
      <div className="absolute w-[100px] h-[100px] bg-[#15294A] rounded-full" />
      <div className="relative z-10 flex flex-col items-center">
        <span className="text-3xl font-bold text-white">{score}</span>
        <span className="text-xs text-gray-400">GRI Score</span>
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
  responses,
  color,
  icon: Icon,
}: {
  type: string;
  name: string;
  score: number;
  trend: "up" | "down";
  trendValue: string;
  rank: string;
  reviews: string;
  responses?: string;
  color: string;
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
          <h3 className="text-xl font-bold text-white">{name}</h3>
        </div>
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
      </div>

      <div className="flex items-center gap-6">
        <RadialProgress
          percentage={(score / 100) * 360}
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
          <div className="text-sm text-gray-400">
            Reviews: <span className="text-white font-bold">{reviews}</span>
          </div>
          {responses && (
            <div className="text-sm text-gray-400">
              Responses:{" "}
              <span className="text-white font-bold">{responses}</span>
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
          {myScore.toFixed(1)}/10
        </span>
      </div>
      <div className="w-full h-8 bg-[#0a1628] rounded-full relative overflow-hidden flex items-center px-1">
        <div
          className="h-5 rounded-full bg-blue-500 relative group"
          style={{ width: `${myScore * 10}%` }}
        >
          <div className="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
            You: {myScore.toFixed(1)}
          </div>
        </div>
      </div>
      <div className="mt-2 space-y-1">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-24">{leaderName}</span>
          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#D4AF37]"
              style={{ width: `${leaderScore * 10}%` }}
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
              style={{ width: `${marketAvg * 10}%` }}
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
      {text} {count && (sentiment === "positive" ? `+${count}` : `-${count}`)}
    </span>
  );
};

export default function SentimentPage() {
  const { t } = useI18n();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<"daily" | "weekly" | "monthly">(
    "weekly",
  );

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
      } else {
        window.location.href = "/login";
      }
    };
    getSession();
  }, []);

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const result = await api.getAnalysisWithFilters(userId, "");
      setData(result);
    } catch (e) {
      console.error("Failed to load sentiment data", e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Mock data for demo (replace with real data when available)
  const mockScores = {
    myHotel: {
      name: "Hotel Plus",
      score: 88,
      trend: "up" as const,
      trendValue: "2.4%",
      rank: "2nd",
      reviews: "1,240",
      responses: "98%",
    },
    leader: {
      name: "Grand Plaza",
      score: 92,
      trend: "up" as const,
      trendValue: "0.8%",
      rank: "1st",
      reviews: "2,105",
    },
    competitors: [
      {
        name: "Ocean View Resort",
        score: 79,
        trend: "down" as const,
        trendValue: "1.2%",
        rank: "3rd",
        reviews: "892",
      },
      {
        name: "City Central",
        score: 72,
        trend: "down" as const,
        trendValue: "3.5%",
        rank: "4th",
        reviews: "1,050",
      },
    ],
  };

  const mockCategories = [
    { category: "Cleanliness", myScore: 9.2, leaderScore: 9.5, marketAvg: 8.4 },
    { category: "Service", myScore: 8.5, leaderScore: 8.8, marketAvg: 7.9 },
    { category: "Location", myScore: 9.8, leaderScore: 9.0, marketAvg: 8.2 },
    { category: "Value", myScore: 8.0, leaderScore: 8.5, marketAvg: 7.5 },
  ];

  const mockKeywords = {
    positive: [
      { text: "Great Location", count: 215, size: "lg" as const },
      { text: "Spotless Room", count: 124, size: "md" as const },
      { text: "Comfy Bed", count: 88, size: "md" as const },
      { text: "Tasty Breakfast", count: 45, size: "sm" as const },
    ],
    negative: [
      { text: "Noisy AC", count: 32, size: "lg" as const },
      { text: "Slow WiFi", count: 28, size: "md" as const },
      { text: "Elevator Wait", count: 15, size: "sm" as const },
    ],
    neutral: [
      { text: "Parking Fees", size: "sm" as const },
      { text: "Pool View", size: "md" as const },
    ],
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
            <div
              className="w-8 h-8 rounded-full border-2 border-[#0a1628] bg-gray-700 flex items-center justify-center text-xs font-bold"
              title="Grand Plaza"
            >
              GP
            </div>
            <div
              className="w-8 h-8 rounded-full border-2 border-[#0a1628] bg-gray-600 flex items-center justify-center text-xs font-bold"
              title="Ocean View"
            >
              OV
            </div>
            <div
              className="w-8 h-8 rounded-full border-2 border-[#0a1628] bg-gray-500 flex items-center justify-center text-xs font-bold"
              title="City Central"
            >
              CC
            </div>
            <button className="w-8 h-8 rounded-full border-2 border-[#0a1628] bg-blue-600 flex items-center justify-center hover:bg-blue-500 transition-colors">
              <span className="text-sm">+</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* Score Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
            <ScoreCard
              type="my-hotel"
              name={data?.target_hotel_name || mockScores.myHotel.name}
              score={mockScores.myHotel.score}
              trend={mockScores.myHotel.trend}
              trendValue={mockScores.myHotel.trendValue}
              rank={mockScores.myHotel.rank}
              reviews={mockScores.myHotel.reviews}
              responses={mockScores.myHotel.responses}
              color="#1152d4"
              icon={Hotel}
            />
            <ScoreCard
              type="leader"
              name={mockScores.leader.name}
              score={mockScores.leader.score}
              trend={mockScores.leader.trend}
              trendValue={mockScores.leader.trendValue}
              rank={mockScores.leader.rank}
              reviews={mockScores.leader.reviews}
              color="#D4AF37"
              icon={Trophy}
            />
            {mockScores.competitors.map((comp, idx) => (
              <ScoreCard
                key={idx}
                type="competitor"
                name={comp.name}
                score={comp.score}
                trend={comp.trend}
                trendValue={comp.trendValue}
                rank={comp.rank}
                reviews={comp.reviews}
                color="#64748b"
                icon={Building2}
              />
            ))}
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
                  Category Breakdown
                </h3>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-gray-400">My Hotel</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#D4AF37]" />
                    <span className="text-gray-400">Grand Plaza</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-gray-600" />
                    <span className="text-gray-400">Avg. Comp.</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {mockCategories.map((cat, idx) => (
                  <CategoryBar
                    key={idx}
                    category={cat.category}
                    myScore={cat.myScore}
                    leaderName="Grand Plaza"
                    leaderScore={cat.leaderScore}
                    marketAvg={cat.marketAvg}
                  />
                ))}
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
                  Guest Mentions
                </h3>
                <button className="text-xs text-blue-500 hover:text-white transition-colors">
                  View All
                </button>
              </div>

              <div className="flex-1 relative bg-[#0a1628]/50 rounded-lg p-4 overflow-hidden border border-white/5">
                <div className="flex flex-wrap gap-2 content-center justify-center h-full">
                  {mockKeywords.positive.map((kw, idx) => (
                    <KeywordTag
                      key={`pos-${idx}`}
                      text={kw.text}
                      count={kw.count}
                      sentiment="positive"
                      size={kw.size}
                    />
                  ))}
                  {mockKeywords.neutral.map((kw, idx) => (
                    <KeywordTag
                      key={`neu-${idx}`}
                      text={kw.text}
                      sentiment="neutral"
                      size={kw.size}
                    />
                  ))}
                  {mockKeywords.negative.map((kw, idx) => (
                    <KeywordTag
                      key={`neg-${idx}`}
                      text={kw.text}
                      count={kw.count}
                      sentiment="negative"
                      size={kw.size}
                    />
                  ))}
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
                    Mentions of "Noisy AC" have increased by 15% since last
                    week. Consider maintenance check on 4th floor.
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
                6-Month Sentiment Trend
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

            {/* SVG Chart */}
            <div className="relative h-64 w-full border-b border-l border-gray-700">
              {/* Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-full h-px bg-gray-800/50" />
                ))}
              </div>

              {/* Y-Axis Labels */}
              <div className="absolute -left-8 inset-y-0 flex flex-col justify-between text-xs text-gray-500 py-2">
                <span>100</span>
                <span>90</span>
                <span>80</span>
                <span>70</span>
                <span>60</span>
              </div>

              {/* Chart SVG */}
              <div className="absolute inset-0 flex items-end px-4 gap-4">
                <svg
                  className="w-full h-full overflow-visible"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient
                      id="gradientPrimary"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#1152d4" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#1152d4" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* My Hotel Area */}
                  <path
                    d="M0,40 Q10,35 20,30 T40,25 T60,20 T80,15 T100,12 L100,100 L0,100 Z"
                    fill="url(#gradientPrimary)"
                  />

                  {/* My Hotel Line */}
                  <path
                    d="M0,40 Q10,35 20,30 T40,25 T60,20 T80,15 T100,12"
                    fill="none"
                    stroke="#1152d4"
                    strokeWidth="3"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />

                  {/* Grand Plaza Line (dashed) */}
                  <path
                    d="M0,30 Q10,25 20,20 T40,15 T60,10 T80,10 T100,8"
                    fill="none"
                    stroke="#D4AF37"
                    strokeWidth="2"
                    strokeDasharray="4"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />

                  {/* Market Avg Line */}
                  <path
                    d="M0,50 Q10,55 20,52 T40,55 T60,50 T80,45 T100,48"
                    fill="none"
                    stroke="#64748b"
                    strokeWidth="2"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </div>

              {/* X-Axis Labels */}
              <div className="absolute -bottom-6 inset-x-0 flex justify-between px-4 text-xs text-gray-500">
                <span>Jun</span>
                <span>Jul</span>
                <span>Aug</span>
                <span>Sep</span>
                <span>Oct</span>
                <span>Nov</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-6 mt-10">
              <div className="flex items-center gap-2">
                <span className="w-4 h-1 bg-blue-600 rounded-full" />
                <span className="text-sm text-gray-300">My Hotel</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-1 bg-[#D4AF37] rounded-full border-dashed" />
                <span className="text-sm text-gray-300">
                  Grand Plaza (Leader)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-1 bg-gray-500 rounded-full" />
                <span className="text-sm text-gray-300">Market Avg.</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
