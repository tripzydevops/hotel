"use client";

import { useI18n } from "@/lib/i18n";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { useState, useEffect } from "react";
import YieldForecastChart from "./YieldForecastChart";
import ExecutiveSummary from "./ExecutiveSummary";
import { Cpu, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { api } from "@/lib/api";
import { ReportsResponse } from "@/types";

interface ReportsClientProps {
  userId: string;
  initialProfile: any;
}

export default function ReportsClient({
  userId,
  initialProfile,
}: ReportsClientProps) {
  const { t } = useI18n();
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await api.getReports(userId);
        setData(response);
      } catch (e) {
        console.error("Failed to fetch reports:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [userId]);

  return (
    <div className="min-h-screen bg-[var(--deep-ocean)] pb-24 relative animate-fade-in">
      <Header
        userProfile={initialProfile}
        hotelCount={0}
        unreadCount={0}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenBilling={() => setIsBillingOpen(true)}
      />

      <BottomNav
        onOpenAddHotel={() => {}}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        unreadCount={0}
      />

      <main className="pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            Predictive Reports
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-[8px] font-black text-purple-400 uppercase tracking-tighter shadow-lg shadow-purple-900/20">
              <Cpu className="w-2.5 h-2.5" />
              AI-Forecast
            </span>
          </h1>
          <p className="text-[var(--text-secondary)] mt-1 text-sm">
            Executive briefings and future performance modeling.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px] mb-8">
          {/* Left Column: Yield Chart */}
          <div className="h-full">
            <YieldForecastChart />
          </div>

          {/* Right Column: Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-4 h-full">
            <div className="glass-panel-premium p-6 rounded-2xl flex flex-col justify-center items-center">
              <span className="text-[var(--text-muted)] text-xs uppercase tracking-widest font-bold mb-2">
                Price Index (ARI)
              </span>
              <span className="text-4xl font-bold text-white">
                {data?.metrics?.price_index
                  ? data.metrics.price_index.toFixed(0)
                  : "..."}
              </span>
              <span className="text-xs text-white/60 mt-2 flex items-center gap-1">
                {data?.metrics?.price_index && (
                  <>
                    {data.metrics.price_index > 100 ? (
                      <>
                        <TrendingUp className="w-3 h-3 text-optimal-green" />{" "}
                        Premium
                      </>
                    ) : data.metrics.price_index < 100 ? (
                      <>
                        <TrendingDown className="w-3 h-3 text-alert-red" />{" "}
                        Competitive
                      </>
                    ) : (
                      <>
                        <Minus className="w-3 h-3 text-white" /> Market Avg
                      </>
                    )}
                  </>
                )}
              </span>
            </div>

            <div className="glass-panel-premium p-6 rounded-2xl flex flex-col justify-center items-center">
              <span className="text-[var(--text-muted)] text-xs uppercase tracking-widest font-bold mb-2">
                Sentiment Score
              </span>
              <span className="text-4xl font-bold text-white">
                {data?.metrics?.sentiment_score
                  ? data.metrics.sentiment_score.toFixed(0)
                  : "..."}
              </span>
              <span className="text-xs text-optimal-green mt-2 flex items-center gap-1">
                {data?.metrics?.sentiment_score && (
                  <>
                    {data.metrics.sentiment_score > 80
                      ? "Excellent"
                      : "Needs Attention"}
                  </>
                )}
              </span>
            </div>

            <div className="glass-panel-premium p-6 rounded-2xl flex flex-col justify-center items-center col-span-2">
              <span className="text-[var(--text-muted)] text-xs uppercase tracking-widest font-bold mb-2">
                Broadcast Heat
              </span>
              <div className="w-full h-4 bg-white/5 rounded-full overflow-hidden mt-2 relative">
                <div
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-optimal-green to-blue-500 transition-all duration-1000"
                  style={{ width: `${data?.metrics?.market_heat || 50}%` }}
                ></div>
              </div>
              <div className="flex justify-between w-full mt-2 text-xs text-[var(--text-secondary)]">
                <span>Low</span>
                <span className="font-bold text-white">
                  {data?.metrics?.market_heat
                    ? `${data.metrics.market_heat}/100`
                    : "..."}
                </span>
                <span>Peak</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Executive Summary */}
        <div className="h-[400px]">
          <ExecutiveSummary briefing={data?.briefing || null} />
        </div>
      </main>
    </div>
  );
}
