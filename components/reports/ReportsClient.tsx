"use client";

import { useI18n } from "@/lib/i18n";
import { useState, useEffect } from "react";
import YieldForecastChart from "./YieldForecastChart";
import ExecutiveSummary from "./ExecutiveSummary";
import { Cpu, TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";
import { api } from "@/lib/api";
import { ReportsResponse } from "@/types";
import CommandLayout from "@/components/layout/CommandLayout";

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
    <CommandLayout userProfile={initialProfile} activeRoute="reports">
      <div className="flex flex-col mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Activity className="w-4 h-4 text-[var(--soft-gold)]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--soft-gold)]">
            Executive Yield Engine
          </span>
        </div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          Predictive Reports
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 text-[8px] font-black text-[var(--soft-gold)] uppercase tracking-tighter">
            <Cpu className="w-2.5 h-2.5" />
            V-Shift Active
          </span>
        </h1>
        <p className="text-[var(--text-secondary)] mt-1 text-sm font-medium">
          Autonomous forecasting and market demand modeling.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Left Column: Yield Chart */}
        <div className="panel bg-[#0d2547] border-[var(--panel-border)] overflow-hidden">
          <div className="panel-header bg-black/10">
            <span className="text-xs font-bold uppercase tracking-wider">
              30-Day Yield Forecast
            </span>
            <span className="text-[10px] text-[var(--soft-gold)] font-mono">
              CONFIDENCE: 94%
            </span>
          </div>
          <div className="p-4 h-[340px]">
            <YieldForecastChart />
          </div>
        </div>

        {/* Right Column: Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="panel bg-[#0d2547] p-6 flex flex-col justify-center items-center">
            <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-bold mb-2">
              Price Index (ARI)
            </span>
            <span className="text-4xl font-bold text-white data-value">
              {data?.metrics?.price_index
                ? data.metrics.price_index.toFixed(1)
                : "..."}
            </span>
            <span className="text-[10px] font-mono text-white/40 mt-2 uppercase">
              {data?.metrics?.price_index && (
                <>
                  {data.metrics.price_index > 100
                    ? "Market Premium"
                    : "Competitive Entry"}
                </>
              )}
            </span>
          </div>

          <div className="panel bg-[#0d2547] p-6 flex flex-col justify-center items-center">
            <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-bold mb-2">
              Sentiment (EGE)
            </span>
            <span className="text-4xl font-bold text-white data-value">
              {data?.metrics?.sentiment_score
                ? data.metrics.sentiment_score.toFixed(1)
                : "..."}
            </span>
            <span className="text-[10px] font-mono text-[var(--success)] mt-2 uppercase">
              Optimal
            </span>
          </div>

          <div className="panel bg-[#0d2547] p-6 flex flex-col justify-center items-center col-span-2">
            <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-bold mb-4">
              Market Saturation Velocity
            </span>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden relative">
              <div
                className="absolute left-0 top-0 h-full bg-[var(--soft-gold)] transition-all duration-1000"
                style={{ width: `${data?.metrics?.market_heat || 50}%` }}
              ></div>
            </div>
            <div className="flex justify-between w-full mt-3 font-mono text-[9px] text-[var(--text-muted)] uppercase tracking-tighter">
              <span>Low Demand</span>
              <span className="font-bold text-white">
                {data?.metrics?.market_heat || "50.0"} / 100.0
              </span>
              <span>Peak Demand</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Executive Summary */}
      <div className="panel bg-[#0d2547] border-[var(--panel-border)] overflow-hidden">
        <div className="panel-header bg-black/10">
          <span className="text-xs font-bold uppercase tracking-wider">
            Executive Summary Narrative
          </span>
        </div>
        <div className="p-0">
          <ExecutiveSummary briefing={data?.briefing || null} />
        </div>
      </div>
    </CommandLayout>
  );
}
