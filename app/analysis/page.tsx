"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { useI18n } from "@/lib/i18n";
import {
  TrendingUp,
  BarChart,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Info,
  Zap,
  LayoutGrid,
} from "lucide-react";
import { api } from "@/lib/api";
import Link from "next/link";

import { createClient } from "@/utils/supabase/client";

const CURRENCIES = ["USD", "EUR", "GBP", "TRY"];
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  TRY: "₺",
};

export default function AnalysisPage() {
  const { t } = useI18n();
  const supabase = createClient();
  /* New: Profile State for Header */
  const [profile, setProfile] = useState<any>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  // Replicate hotel count logic roughly or use 0
  const hotelCount = 0;
  /* End New State */

  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<string>("USD");

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
        // Fetch Profile for Header
        try {
          const userProfile = await api.getProfile(session.user.id);
          setProfile(userProfile);
        } catch (e) {
          console.error("Failed to fetch profile", e);
        }
      } else {
        // Redirect to login if not authenticated
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
        // Update currency from response (may differ from request if using user settings)
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
            Processing Intelligence...
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
                Market Intelligence
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
            Real-time competitor spread and predictive price analysis.
          </p>
        </div>

        {/* Global KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <KPICard
            title="Market Average"
            value={
              data?.market_average
                ? `${CURRENCY_SYMBOLS[currency] || "$"}${data.market_average}`
                : "N/A"
            }
            subtitle="Current active inventory"
            icon={<BarChart className="w-5 h-5" />}
          />
          <KPICard
            title="Target Price"
            value={
              data?.target_price
                ? `${CURRENCY_SYMBOLS[currency] || "$"}${data.target_price}`
                : "N/A"
            }
            subtitle="Your current rate"
            icon={<Target className="w-5 h-5" />}
            highlight
          />
          <KPICard
            title="Market Spread"
            value={
              data?.market_min && data?.market_max
                ? `${CURRENCY_SYMBOLS[currency] || "$"}${data.market_min} - ${CURRENCY_SYMBOLS[currency] || "$"}${data.market_max}`
                : "N/A"
            }
            subtitle="Inventory range"
            icon={<LayoutGrid className="w-5 h-5" />}
          />
          <KPICard
            title="Market Position"
            value={data?.competitive_rank ? `#${data.competitive_rank}` : "N/A"}
            subtitle="Price rank (Low to High)"
            icon={<TrendingUp className="w-5 h-5" />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Market Spread Visualization */}
          <div className="lg:col-span-2 glass-card p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-black text-white">
                Competitor Price Spread
              </h2>
              <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] font-bold uppercase">
                <Info className="w-3.5 h-3.5" />
                Where you sit in the market
              </div>
            </div>

            <div className="relative pt-12 pb-8">
              {/* Range Bar */}
              <div className="h-3 w-full bg-white/5 rounded-full relative">
                {/* Visual Indicators */}
                <div className="absolute left-0 -top-6 text-[10px] font-black text-[var(--optimal-green)]">
                  {CURRENCY_SYMBOLS[currency] || "$"}
                  {data?.market_min} (Min)
                </div>
                <div className="absolute right-0 -top-6 text-[10px] font-black text-[var(--alert-red)]">
                  {CURRENCY_SYMBOLS[currency] || "$"}
                  {data?.market_max} (Max)
                </div>

                {/* Target Marker */}
                <div
                  className="absolute h-10 w-1 bg-[var(--soft-gold)] top-1/2 -translate-y-1/2 transition-all duration-1000 ease-out"
                  style={{ left: `${spreadPercentage}%` }}
                >
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 rounded-lg bg-[var(--soft-gold)] text-[var(--deep-ocean)] text-xs font-black shadow-lg">
                    YOU: {CURRENCY_SYMBOLS[currency] || "$"}
                    {data?.target_price}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--soft-gold)] rotate-45" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12 flex items-center gap-12 border-t border-white/5 pt-8">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase">
                  Price Gap (To Min)
                </span>
                <span className="text-xl font-black text-white">
                  {data?.target_price && data?.market_min
                    ? `+${CURRENCY_SYMBOLS[currency] || "$"}${(data.target_price - data.market_min).toFixed(2)}`
                    : "N/A"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase">
                  Inventory Spread
                </span>
                <span className="text-xl font-black text-white">
                  {data?.market_max && data?.market_min
                    ? `${CURRENCY_SYMBOLS[currency] || "$"}${(data.market_max - data.market_min).toFixed(2)}`
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Historical Trend Preview */}
          <div className="glass-card p-8 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-black text-white mb-2">
                Target Price Trend
              </h2>
              <p className="text-xs text-[var(--text-muted)] font-medium mb-8">
                30-day historical movements
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
                            undefined,
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
              Detailed History Repo
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
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  highlight?: boolean;
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
      <div className="text-2xl font-black text-white mb-1 tracking-tight">
        {value}
      </div>
      <div className="text-[10px] font-medium text-[var(--text-muted)]">
        {subtitle}
      </div>
    </div>
  );
}
