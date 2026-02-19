"use client";

import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import {
  TrendingUp,
  BarChart,
  Target,
  Info,
  Zap,
  LayoutGrid,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import AdvisorQuadrant from "@/components/analytics/AdvisorQuadrant";
import DiscoveryShard from "@/components/features/analysis/DiscoveryShard";
import AnalysisFilters from "@/components/features/analysis/AnalysisFilters";
import RateIntelligenceGrid from "@/components/features/analysis/RateIntelligenceGrid";
import dynamic from "next/dynamic";
import RoomTypeMapper from "@/components/features/analysis/RoomTypeMapper";

// Heavy chart components are loaded dynamically on the client side only to 
// optimize the main application bundle size and initial painting speed.
const RateSpreadChart = dynamic(() => import("@/components/analytics/RateSpreadChart"), { ssr: false });
import SemanticSearchBar from "@/components/features/analysis/SemanticSearchBar";
import ProfileModal from "@/components/modals/ProfileModal";
import SettingsModal from "@/components/modals/SettingsModal";
import AlertsModal from "@/components/modals/AlertsModal";
import SubscriptionModal from "@/components/modals/SubscriptionModal";
import SentimentBreakdown from "@/components/ui/SentimentBreakdown";
import { useModalContext } from "@/components/ui/ModalContext";

const CURRENCIES = ["USD", "EUR", "GBP", "TRY"];
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  TRY: "₺",
};

export default function AnalysisPage() {
  const { t, locale } = useI18n();
  const supabase = createClient();
  /* Modal Context */
  const {
    setIsProfileOpen,
    setIsAlertsOpen,
    setIsSettingsOpen,
    setIsBillingOpen,
  } = useModalContext();

  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<string>("TRY");

  // Filter state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [excludedHotelIds, setExcludedHotelIds] = useState<string[]>([]);
  const [roomType, setRoomType] = useState<string>("");
  const [allHotels, setAllHotels] = useState<
    { id: string; name: string; is_target: boolean }[]
  >([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Set default date range to current month
  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    setStartDate(firstDay.toISOString().split("T")[0]);
    setEndDate(lastDay.toISOString().split("T")[0]);
  }, []);

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
        try {
          const userProfile = await api.getProfile(session.user.id);
          // Profile handled by DashboardLayout now
        } catch (e) {
          console.error("Failed to fetch profile", e);
        }
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
      // Build query params
      const params = new URLSearchParams();
      if (currency) params.set("currency", currency);
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      if (roomType) params.set("room_type", roomType);
      if (excludedHotelIds.length > 0)
        params.set("exclude_hotel_ids", excludedHotelIds.join(","));
      if (searchQuery) {
        params.set("search_query", searchQuery);
      }

      const result = await api.getAnalysisWithFilters(
        userId,
        params.toString(),
      );
      setData(result);
      if (result.display_currency) {
        setCurrency(result.display_currency);
      }
      if (result.all_hotels && allHotels.length === 0) {
        setAllHotels(result.all_hotels);
      }
    } catch (err) {
      console.error("Failed to load analysis:", err);
    } finally {
      setLoading(false);
    }
  }, [
    userId,
    currency,
    startDate,
    endDate,
    excludedHotelIds,
    roomType,
    searchQuery,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  };

  const handleExcludedChange = (ids: string[]) => {
    setExcludedHotelIds(ids);
  };

  const handleSetTarget = async (hotelId: string) => {
    if (!userId) return;
    try {
      await api.updateHotel(hotelId, { is_target_hotel: true });
      // Refresh data to reflect new target
      loadData();
      // Optional: Clear allHotels to force re-fetch from result
      setAllHotels([]);
    } catch (err) {
      console.error("Failed to set target hotel:", err);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[var(--deep-ocean)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--soft-gold)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--soft-gold)] font-black uppercase tracking-widest text-[10px]">
            {t("analysis.processing")}
          </p>
        </div>
      </div>
    );
  }

  const spreadPercentage =
    data?.target_price != null && 
    data?.market_max > data?.market_min &&
    data?.market_min != null
      ? ((data?.target_price - data?.market_min) /
          (data?.market_max - data?.market_min)) *
        100
      : 0;

  return (
    <div className="min-h-screen pb-12">
      <main className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <SemanticSearchBar onSearch={handleSearch} />

          {/* Search Feedback Banner */}
          {searchQuery && !loading && (
            <div className="mb-6 mx-auto max-w-2xl bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 rounded-lg p-3 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--soft-gold)]" />
                <span className="text-sm text-white">
                  Found{" "}
                  <span className="font-bold text-[var(--soft-gold)]">
                    {data?.price_rank_list?.length || 0}
                  </span>{" "}
                  hotels matching <span className="italic">&quot;{searchQuery}&quot;</span>
                </span>
              </div>
              <button
                onClick={() => handleSearch("")}
                className="text-xs text-white/50 hover:text-white hover:underline uppercase tracking-wider font-bold"
              >
                Clear Filter
              </button>
            </div>
          )}

          <div className="flex items-center justify-end mb-2">
            {/* Currency Selector */}
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)] cursor-pointer"
            >
              {CURRENCIES.map((c) => (
                <option
                  key={c}
                  value={c}
                  className="bg-[var(--deep-ocean)] text-white"
                >
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Analysis Filters */}
        <AnalysisFilters
          allHotels={data?.all_hotels || allHotels}
          excludedHotelIds={excludedHotelIds}
          onExcludedChange={handleExcludedChange}
          onSetTarget={handleSetTarget}
          startDate={startDate}
          endDate={endDate}
          onDateChange={handleDateChange}
          roomType={roomType}
          onRoomTypeChange={setRoomType}
          availableRoomTypes={data?.available_room_types || []}
        />

        {/* Semantic Room Mapping Visualization */}
        <RoomTypeMapper
          selectedRoomType={roomType}
          matches={
            data?.price_rank_list
              ?.map((hotel: any) => ({
                hotelName: hotel.is_target ? "Target" : hotel.name,
                matchedRoomName: hotel.matched_room_name || null,
                matchScore: hotel.match_score || 0,
              }))
              .filter((h: any) => h.hotelName !== "Target") || []
          }
        />

        {/* 2. Sentiment Analysis Breakdown - MOVED TO SENTIMENT PAGE */}
        {/* <div className="mb-8">
          <SentimentBreakdown items={data?.sentiment_breakdown} />
        </div> */}

        {/* Global KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12 overflow-visible">
          <KPICard
            title={t("analysis.marketAverage")}
            value={
              data?.market_average
                ? `${CURRENCY_SYMBOLS[currency] || "$"}${data.market_average}`
                : "N/A"
            }
            subtitle={t("common.availableNow")}
            icon={<BarChart className="w-5 h-5" />}
            hoverData={{
              type: "average",
              targetPrice: data?.target_price,
              marketAvg: data?.market_average,
              currency,
            }}
          />
          <KPICard
            title={t("analysis.targetPrice")}
            value={
              data?.target_price
                ? `${CURRENCY_SYMBOLS[currency] || "$"}${data.target_price}`
                : "N/A"
            }
            subtitle={t("hotelDetails.liveRates")}
            icon={<Target className="w-5 h-5" />}
            highlight
          />
          <KPICard
            title={t("analysis.marketSpread")}
            value={
              data?.market_min && data?.market_max
                ? `${CURRENCY_SYMBOLS[currency] || "$"}${data.market_min} - ${CURRENCY_SYMBOLS[currency] || "$"}${data.market_max}`
                : "N/A"
            }
            subtitle={t("analysis.inventoryRange")}
            icon={<LayoutGrid className="w-5 h-5" />}
            hoverData={{
              type: "spread",
              currency,
              minHotel: data?.min_hotel,
              maxHotel: data?.max_hotel,
            }}
          />
          <KPICard
            title={t("analysis.marketPosition")}
            value={data?.competitive_rank ? `#${data.competitive_rank}` : "N/A"}
            subtitle={`of ${data?.total_hotels || 0} hotels`}
            icon={<TrendingUp className="w-5 h-5" />}
            hoverData={{
              type: "ranking",
              priceRankList: data?.price_rank_list || [],
              currency,
            }}
          />
          <KPICard
            title="Avg Rate Index (ARI)"
            value={data?.ari ? `${data.ari}%` : "100%"}
            subtitle="Market Rate Competitiveness"
            icon={<Target className="w-5 h-5" />}
            trend={data?.ari > 100 ? "up" : "down"}
          />
          <KPICard
            title="Sentiment Index"
            value={data?.sentiment_index ? `${data.sentiment_index}%` : "100%"}
            subtitle="Reputation vs Market"
            icon={<Zap className="w-5 h-5" />}
            trend={data?.sentiment_index > 100 ? "up" : "down"}
          />
        </div>

        {/* Strategic Map: Advisor Quadrant */}
        <div className="mb-12">
          <AdvisorQuadrant
            x={data?.quadrant_x || 0}
            y={data?.quadrant_y || 0}
            label={data?.quadrant_label || "Standard"}
            ari={data?.ari}
            sentiment={data?.sentiment_index}
            targetRating={data?.target_rating}
            marketRating={data?.market_rating}
          />
        </div>

        {/* Rate Spread Chart */}
        {data?.daily_prices && data.daily_prices.length > 0 && (
          <div className="mb-12">
            <RateSpreadChart
              dailyPrices={data.daily_prices}
              targetHotelName={data?.hotel_name || "Your Hotel"}
              currency={currency}
            />
          </div>
        )}

        {/* Agent Advisory Shard */}
        {(data?.advisory_keys?.length > 0 || data?.advisory_msg) && (
          <div className="mb-12 glass-card p-8 border-l-4 border-l-[var(--soft-gold)] bg-[var(--soft-gold)]/5">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-[var(--soft-gold)]/20 text-[var(--soft-gold)]">
                <Zap className="w-6 h-6 animate-pulse" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-[var(--soft-gold)] uppercase tracking-widest mb-2">
                  {t("analysis.advisory.title")}
                </h3>
                <div className="text-xl font-medium text-white italic leading-relaxed">
                  {data?.advisory_keys && data.advisory_keys.length > 0
                    ? data.advisory_keys.map((key: string, idx: number) => (
                        <span key={idx}>
                          {t(`analysis.advisory.${key}` as any)}{" "}
                        </span>
                      ))
                    : `"${data?.advisory_msg}"`}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full bg-[var(--soft-gold)] border-2 border-[var(--deep-ocean)] flex items-center justify-center text-[8px] font-black text-[var(--deep-ocean)]">
                      A
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
                    {t("analysis.advisory.generatedBy")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Market Spread Visualization */}
          <div className="lg:col-span-2 glass-card p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-black text-white">
                {t("analysis.marketSpread")}
              </h2>
              <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] font-bold uppercase">
                <Info className="w-3.5 h-3.5" />
                {t("analysis.marketSitInfo")}
              </div>
            </div>

            {/* Percentile Badge */}
            {data?.market_rank && data?.price_rank_list && (
              <div className="mb-6 flex items-center gap-3">
                <div
                  className={`px-3 py-1.5 rounded-full text-xs font-black ${
                    data.market_rank <= 2
                      ? "bg-[var(--optimal-green)]/20 text-[var(--optimal-green)]"
                      : data.market_rank <=
                          Math.ceil(data.price_rank_list.length / 2)
                        ? "bg-[var(--soft-gold)]/20 text-[var(--soft-gold)]"
                        : "bg-[var(--alert-red)]/20 text-[var(--alert-red)]"
                  }`}
                >
                  #{data.market_rank} of {data.price_rank_list.length}
                </div>
                <span className="text-xs text-white/60">
                  {data.market_rank === 1
                    ? "You're the cheapest in the market!"
                    : data.market_rank <= 2
                      ? "Excellent competitive position"
                      : data.market_rank <=
                          Math.ceil(data.price_rank_list.length / 2)
                        ? "Mid-range pricing"
                        : "Premium pricing tier"}
                </span>
              </div>
            )}

            <div className="relative pt-16 pb-8">
              {/* Price Scale Labels */}
              <div className="absolute top-2 left-0 right-0 flex justify-between text-[10px] font-black">
                <span className="text-[var(--optimal-green)]">
                  {CURRENCY_SYMBOLS[currency]}
                  {data?.market_min?.toFixed(0)}
                </span>
                <span className="text-white/40">
                  {CURRENCY_SYMBOLS[currency]}
                  {data?.market_min != null && data?.market_max != null 
                    ? ((data.market_min + data.market_max) / 2)?.toFixed(0)
                    : "N/A"}
                </span>
                <span className="text-[var(--alert-red)]">
                  {CURRENCY_SYMBOLS[currency]}
                  {data?.market_max != null ? data.market_max?.toFixed(0) : "N/A"}
                </span>
              </div>

              {/* Range Bar - Premium Design */}
              <div className="relative h-4 w-full bg-white/5 rounded-full mt-4 ring-1 ring-white/10 backdrop-blur-sm">
                {/* Gradient Track */}
                <div className="absolute inset-0 rounded-full opacity-50 bg-gradient-to-r from-[var(--optimal-green)] via-[var(--soft-gold)] to-[var(--alert-red)]" />

                {/* Competitor Dots - Significantly improved visibility */}
                {data?.price_rank_list
                  ?.slice(0, 10)
                  .map((comp: any, idx: number) => {
                    if (comp.is_target) return null;
                    const compSpread =
                      data.market_max > data.market_min
                        ? ((comp.price - data.market_min) /
                            (data.market_max - data.market_min)) *
                          100
                        : 0;

                    // Stronger coloring logic
                    const dotColor =
                      compSpread < 33
                        ? "bg-[var(--optimal-green)]"
                        : compSpread > 66
                          ? "bg-[var(--alert-red)]"
                          : "bg-white"; // Truly white for mid-range

                    return (
                      <div
                        key={comp.id || idx}
                        className={`absolute w-5 h-5 rounded-full ${dotColor} top-1/2 -translate-y-1/2 hover:scale-150 hover:z-50 transition-all duration-300 cursor-pointer group border-2 border-white shadow-[0_4px_12px_rgba(0,0,0,0.5)] z-10 flex items-center justify-center`}
                        style={{
                          left: `calc(${Math.min(Math.max(compSpread, 2), 98)}%)`,
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        {/* Dot inner ring for extra detail */}
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--deep-ocean)] opacity-20" />

                        {/* Hover Tooltip - Micro Size */}
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap min-w-[80px]">
                          <div className="relative px-2 py-1 rounded-md bg-[var(--deep-ocean)] border border-white/20 text-white shadow-xl z-[60]">
                            <div className="text-[7px] font-bold text-white/50 uppercase tracking-wider leading-none mb-0.5">
                              Competitor
                            </div>
                            <div className="font-bold text-[10px] leading-tight mb-0.5 max-w-[120px] truncate">
                              {comp.name}
                            </div>
                            <div
                              className={`text-sm font-black ${compSpread < 33 ? "text-[var(--optimal-green)]" : compSpread > 66 ? "text-[var(--alert-red)]" : "text-white"}`}
                            >
                              {CURRENCY_SYMBOLS[currency]}
                              {comp.price?.toFixed(0)}
                            </div>
                            {/* Tooltip Arrow */}
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--deep-ocean)] border-r border-b border-white/20 rotate-45" />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {/* Your Hotel Marker - Premium Diamond */}
                <div
                  className="absolute top-1/2 z-30 flex flex-col items-center pointer-events-none transition-all duration-1000 ease-out"
                  style={{
                    left: `calc(${Math.min(Math.max(spreadPercentage, 0), 100)}%)`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  {/* Diamond Icon */}
                  <div className="relative group cursor-help pointer-events-auto">
                    <div className="w-8 h-8 rotate-45 bg-[var(--soft-gold)] border-4 border-[var(--deep-ocean)] shadow-[0_0_25px_rgba(255,215,0,0.6)] z-30 flex items-center justify-center hover:scale-110 transition-transform">
                      <div className="w-2 h-2 bg-white rounded-full shadow-inner" />
                    </div>
                    {/* Pulse */}
                    <div className="absolute inset-0 bg-[var(--soft-gold)] rotate-45 animate-ping opacity-60 -z-10 rounded-sm" />
                  </div>

                  {/* Always Visible Label - Micro Size */}
                  <div className="absolute -top-[50px] whitespace-nowrap pointer-events-auto z-40">
                    <div className="relative px-2 py-1 bg-gradient-to-b from-[var(--soft-gold)] to-[var(--soft-gold)]/90 text-[var(--deep-ocean)] rounded-md shadow-xl border border-white/20 flex flex-col items-center gap-0.5">
                      <span className="text-[7px] font-black uppercase tracking-widest opacity-80 leading-none">
                        You
                      </span>
                      <span className="text-xs font-black leading-none tracking-tight">
                        {CURRENCY_SYMBOLS[currency]}
                        {data?.target_price?.toFixed(0)}
                      </span>
                      {/* Arrow */}
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--soft-gold)]/90 rotate-45 border-r border-b border-black/5" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Position Labels */}
              <div className="flex justify-between mt-6 px-1">
                <div className="flex flex-col items-start gap-1">
                  <div className="h-4 w-[1px] bg-white/10 ml-2 mb-1" />
                  <span className="text-[10px] font-black text-[var(--optimal-green)] uppercase tracking-wider bg-[var(--optimal-green)]/10 px-2 py-1 rounded">
                    Cheapest
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="h-4 w-[1px] bg-white/10 mb-1" />
                  <span className="text-[10px] font-black text-white/60 uppercase tracking-wider bg-white/5 px-2 py-1 rounded">
                    Mid-Range
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="h-4 w-[1px] bg-white/10 mr-2 mb-1" />
                  <span className="text-[10px] font-black text-[var(--alert-red)] uppercase tracking-wider bg-[var(--alert-red)]/10 px-2 py-1 rounded">
                    Premium
                  </span>
                </div>
              </div>
            </div>

            {/* Stats Row - Enhanced */}
            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/5 pt-8">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase">
                  {t("analysis.priceGapToMin")}
                </span>
                <span className="text-xl font-black text-white">
                  {data?.target_price != null && data?.market_min != null
                    ? `+${CURRENCY_SYMBOLS[currency] || "$"}${(data.target_price - data.market_min)?.toFixed(0)}`
                    : "N/A"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase">
                  Gap to Median
                </span>
                <span className="text-xl font-black text-white">
                  {data?.target_price != null && data?.market_avg != null
                    ? `${data.target_price < data.market_avg ? "-" : "+"}${CURRENCY_SYMBOLS[currency] || "$"}${Math.abs(data.target_price - data.market_avg)?.toFixed(0)}`
                    : "N/A"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase">
                  {t("analysis.inventorySpread")}
                </span>
                <span className="text-xl font-black text-white">
                  {data?.market_max != null && data?.market_min != null
                    ? `${CURRENCY_SYMBOLS[currency] || "$"}${(data.market_max - data.market_min)?.toFixed(0)}`
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>

          <div className="glass-card p-8 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-black text-white mb-2">
                {t("analysis.targetPriceTrend")}
              </h2>
              <p className="text-xs text-[var(--text-muted)] font-medium mb-8">
                {t("analysis.targetPriceTrendDesc")}
              </p>

              <div className="space-y-4">
                {data?.price_history
                  ?.slice(0, 5)
                  .map((point: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-[10px] font-black text-[var(--text-muted)]">
                          {new Date(point.recorded_at).toLocaleDateString(
                            locale === "en" ? "en-US" : "tr-TR",
                            { month: "short", day: "numeric" },
                          )}
                        </div>
                      </div>
                      <div className="text-sm font-black text-white">
                        {CURRENCY_SYMBOLS[currency] || "$"}
                        {point.price}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <Link
              href="/reports"
              className="btn-gold w-full mt-8 font-black text-xs uppercase tracking-widest py-4 text-center block"
            >
              {t("analysis.historyRepo")}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

interface HoverData {
  type: "ranking" | "average" | "spread";
  priceRankList?: {
    id: string;
    name: string;
    price: number;
    rank: number;
    is_target: boolean;
  }[];
  targetPrice?: number;
  marketAvg?: number;
  currency?: string;
  minHotel?: { name: string; price: number };
  maxHotel?: { name: string; price: number };
}

function KPICard({
  title,
  value,
  subtitle,
  icon,
  highlight = false,
  trend,
  hoverData,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  highlight?: boolean;
  trend?: "up" | "down";
  hoverData?: HoverData;
}) {
  const symbol = hoverData?.currency
    ? CURRENCY_SYMBOLS[hoverData.currency] || "$"
    : "$";

  return (
    <div
      className={`glass-card p-6 border-l-4 ${highlight ? "border-l-[var(--soft-gold)]" : "border-l-white/10"} group relative hover:z-50 cursor-pointer overflow-visible`}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
          {title}
        </span>
        <div
          className={`p-2 rounded-lg bg-white/5 ${highlight ? "text-[var(--soft-gold)]" : "text-[var(--text-muted)]"}`}
        >
          {icon}
        </div>
      </div>
      <div className="flex items-end justify-between mb-1">
        <div className="text-2xl font-black text-white tracking-tight">
          {value}
        </div>
        {trend && (
          <div
            className={`text-[10px] font-black uppercase px-2 py-1 rounded-md bg-white/5 ${trend === "up" ? "text-[var(--alert-red)]" : "text-[var(--optimal-green)]"}`}
          >
            {trend === "up" ? "High" : "Low"}
          </div>
        )}
      </div>
      <div className="text-[10px] font-medium text-[var(--text-muted)]">
        {subtitle}
      </div>

      {/* Hover Tooltip */}
      {hoverData && (
        <div className="absolute left-0 right-0 top-full mt-2 z-[200] opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all duration-300 scale-95 group-hover:scale-100">
          <div className="mx-4 p-4 bg-[#0a0a14]/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur-xl">
            {hoverData.type === "ranking" && hoverData.priceRankList && (
              <>
                <div className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">
                  Price Leaderboard
                </div>
                <div className="space-y-1 max-h-[160px] overflow-y-auto">
                  {hoverData.priceRankList.slice(0, 6).map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between py-1.5 px-2 rounded ${
                        item.is_target
                          ? "bg-[var(--soft-gold)]/10 border-l-2 border-[var(--soft-gold)]"
                          : "bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-black ${item.is_target ? "text-[var(--soft-gold)]" : "text-white/50"}`}
                        >
                          #{item.rank}
                        </span>
                        <span
                          className={`text-xs ${item.is_target ? "text-[var(--soft-gold)] font-bold" : "text-white/70"} truncate max-w-[120px]`}
                        >
                          {item.name}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-black ${item.is_target ? "text-[var(--soft-gold)]" : "text-white/70"}`}
                      >
                        {symbol}
                        {item.price != null ? item.price.toFixed(0) : "N/A"}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {hoverData.type === "average" && (
              <>
                <div className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">
                  Market Comparison
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/70">Your Price</span>
                    <span className="text-sm font-black text-[var(--soft-gold)]">
                      {symbol}
                      {hoverData.targetPrice?.toFixed(0) || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/70">Market Avg</span>
                    <span className="text-sm font-black text-white">
                      {symbol}
                      {hoverData.marketAvg?.toFixed(0) || "N/A"}
                    </span>
                  </div>
                  {hoverData.targetPrice && hoverData.marketAvg && (
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <span className="text-xs text-white/70">Difference</span>
                      <span
                        className={`text-sm font-black ${hoverData.targetPrice > hoverData.marketAvg ? "text-[var(--alert-red)]" : "text-[var(--optimal-green)]"}`}
                      >
                        {hoverData.targetPrice > hoverData.marketAvg ? "+" : ""}
                        {(
                          ((hoverData.targetPrice - hoverData.marketAvg) /
                            hoverData.marketAvg) *
                          100
                        )?.toFixed(1)}
                        %
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
            {hoverData.type === "spread" && (
              <>
                <div className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">
                  Price Range Details
                </div>
                <div className="space-y-2">
                  {hoverData.minHotel && (
                    <div className="flex items-center justify-between py-1.5 px-2 rounded bg-[var(--optimal-green)]/10 border-l-2 border-[var(--optimal-green)]">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-[var(--optimal-green)] uppercase font-bold">
                          Lowest
                        </span>
                        <span className="text-xs text-white truncate max-w-[140px]">
                          {hoverData.minHotel.name}
                        </span>
                      </div>
                      <span className="text-sm font-black text-[var(--optimal-green)]">
                        {symbol}
                        {hoverData.minHotel.price?.toFixed(0)}
                      </span>
                    </div>
                  )}
                  {hoverData.maxHotel && (
                    <div className="flex items-center justify-between py-1.5 px-2 rounded bg-[var(--alert-red)]/10 border-l-2 border-[var(--alert-red)]">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-[var(--alert-red)] uppercase font-bold">
                          Highest
                        </span>
                        <span className="text-xs text-white truncate max-w-[140px]">
                          {hoverData.maxHotel.name}
                        </span>
                      </div>
                      <span className="text-sm font-black text-[var(--alert-red)]">
                        {symbol}
                        {hoverData.maxHotel.price?.toFixed(0)}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
