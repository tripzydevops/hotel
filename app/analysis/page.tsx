"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { useI18n } from "@/lib/i18n";
import {
  TrendingUp,
  BarChart,
  Target,
  Info,
  Zap,
  LayoutGrid,
} from "lucide-react";
import { api } from "@/lib/api";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import AdvisorQuadrant from "@/components/AdvisorQuadrant";
import DiscoveryShard from "@/components/DiscoveryShard";

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
  /* Profile State for Header */
  const [profile, setProfile] = useState<any>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const hotelCount = 0;

  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<string>("TRY");

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
        try {
          const userProfile = await api.getProfile(session.user.id);
          setProfile(userProfile);
        } catch (e) {
          console.error("Failed to fetch profile", e);
        }
      } else {
        window.location.href = "/login";
      }
    };
    getSession();
  }, []);

  useEffect(() => {
    async function loadData() {
      if (!userId) return;
      setLoading(true);
      try {
        const result = await api.getAnalysis(userId, currency);
        setData(result);
        if (result.display_currency) {
          setCurrency(result.display_currency);
        }
      } catch (err) {
        console.error("Failed to load analysis:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currency, userId]);

  if (loading) {
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
    data?.market_max > data?.market_min
      ? ((data?.target_price - data?.market_min) /
          (data?.market_max - data?.market_min)) *
        100
      : 0;

  return (
    <div className="min-h-screen pb-12 bg-[var(--deep-ocean)]">
      <Header
        userProfile={profile}
        hotelCount={hotelCount}
        unreadCount={0}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenBilling={() => setIsBillingOpen(true)}
      />

      <main className="pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[var(--soft-gold)]/10 text-[var(--soft-gold)]">
                <Zap className="w-5 h-5" />
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight">
                {t("analysis.title")}
              </h1>
            </div>

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
          <p className="text-[var(--text-secondary)] font-medium">
            {t("analysis.subtitle")}
          </p>
        </div>

        {/* Global KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <KPICard
            title={t("analysis.marketAverage")}
            value={
              data?.market_average
                ? `${CURRENCY_SYMBOLS[currency] || "$"}${data.market_average}`
                : "N/A"
            }
            subtitle={t("common.availableNow")}
            icon={<BarChart className="w-5 h-5" />}
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
          />
          <KPICard
            title={t("analysis.marketPosition")}
            value={data?.competitive_rank ? `#${data.competitive_rank}` : "N/A"}
            subtitle={t("analysis.competitiveRank")}
            icon={<TrendingUp className="w-5 h-5" />}
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
          />
        </div>

        {/* Rival Discovery Engine */}
        <div className="mb-12">
          <DiscoveryShard hotelId={data?.hotel_id} />
        </div>

        {/* Agent Advisory Shard */}
        {data?.advisory_msg && (
          <div className="mb-12 glass-card p-8 border-l-4 border-l-[var(--soft-gold)] bg-[var(--soft-gold)]/5">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-[var(--soft-gold)]/20 text-[var(--soft-gold)]">
                <Zap className="w-6 h-6 animate-pulse" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-[var(--soft-gold)] uppercase tracking-widest mb-2">
                  Agent Intelligence Advisory
                </h3>
                <p className="text-xl font-medium text-white italic leading-relaxed">
                  "{data.advisory_msg}"
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full bg-[var(--soft-gold)] border-2 border-[var(--deep-ocean)] flex items-center justify-center text-[8px] font-black text-[var(--deep-ocean)]">
                      A
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
                    Generated by Autonomous Analyst Agent • Real-time Guidance
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

            <div className="relative pt-12 pb-8">
              {/* Range Bar */}
              <div className="h-3 w-full bg-white/5 rounded-full relative">
                {/* Visual Indicators */}
                <div className="absolute left-0 -top-6 text-[10px] font-black text-[var(--optimal-green)]">
                  {CURRENCY_SYMBOLS[currency] || "$"}
                  {data?.market_min} ({t("analysis.minLabel")})
                </div>
                <div className="absolute right-0 -top-6 text-[10px] font-black text-[var(--alert-red)]">
                  {CURRENCY_SYMBOLS[currency] || "$"}
                  {data?.market_max} ({t("analysis.maxLabel")})
                </div>

                {/* Target Marker */}
                <div
                  className="absolute h-10 w-1 bg-[var(--soft-gold)] top-1/2 -translate-y-1/2 transition-all duration-1000 ease-out"
                  style={{ left: `${spreadPercentage}%` }}
                >
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 rounded-lg bg-[var(--soft-gold)] text-[var(--deep-ocean)] text-xs font-black shadow-lg">
                    {t("analysis.youLabel")}:{" "}
                    {CURRENCY_SYMBOLS[currency] || "$"}
                    {data?.target_price}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--soft-gold)] rotate-45" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12 flex items-center gap-12 border-t border-white/5 pt-8">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase">
                  {t("analysis.priceGapToMin")}
                </span>
                <span className="text-xl font-black text-white">
                  {data?.target_price && data?.market_min
                    ? `+${CURRENCY_SYMBOLS[currency] || "$"}${(data.target_price - data.market_min).toFixed(2)}`
                    : "N/A"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase">
                  {t("analysis.inventorySpread")}
                </span>
                <span className="text-xl font-black text-white">
                  {data?.market_max && data?.market_min
                    ? `${CURRENCY_SYMBOLS[currency] || "$"}${(data.market_max - data.market_min).toFixed(2)}`
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

function KPICard({
  title,
  value,
  subtitle,
  icon,
  highlight = false,
  trend,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  highlight?: boolean;
  trend?: "up" | "down";
}) {
  return (
    <div
      className={`glass-card p-6 border-l-4 ${highlight ? "border-l-[var(--soft-gold)]" : "border-l-white/10"}`}
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
    </div>
  );
}
