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
  LayoutGrid
} from "lucide-react";
import { api } from "@/lib/api";
import Link from "next/link";

const MOCK_USER_ID = "123e4567-e89b-12d3-a456-426614174000";

export default function AnalysisPage() {
  const { t } = useI18n();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const result = await api.getAnalysis(MOCK_USER_ID);
        setData(result);
      } catch (err) {
        console.error("Failed to load analysis:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--deep-ocean)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--soft-gold)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--soft-gold)] font-black uppercase tracking-widest text-[10px]">Processing Intelligence...</p>
        </div>
      </div>
    );
  }

  const spreadPercentage = data?.market_max > data?.market_min 
    ? ((data?.target_price - data?.market_min) / (data?.market_max - data?.market_min)) * 100 
    : 0;

  return (
    <div className="min-h-screen pb-12 bg-[var(--deep-ocean)]">
      <Header />

      <main className="pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[var(--soft-gold)]/10 text-[var(--soft-gold)]">
              <Zap className="w-5 h-5" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">Market Intelligence</h1>
          </div>
          <p className="text-[var(--text-secondary)] font-medium">
            Real-time competitor spread and predictive price analysis.
          </p>
        </div>

        {/* Global KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <KPICard 
            title="Market Average" 
            value={data?.market_average ? `$${data.market_average}` : "N/A"}
            subtitle="Current active inventory"
            icon={<BarChart className="w-5 h-5" />}
          />
          <KPICard 
            title="Target Price" 
            value={data?.target_price ? `$${data.target_price}` : "N/A"}
            subtitle="Your current rate"
            icon={<Target className="w-5 h-5" />}
            highlight
          />
          <KPICard 
            title="Market Spread" 
            value={data?.market_min && data?.market_max ? `$${data.market_min} - $${data.market_max}` : "N/A"}
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
              <h2 className="text-lg font-black text-white">Competitor Price Spread</h2>
              <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] font-bold uppercase">
                <Info className="w-3.5 h-3.5" />
                Where you sit in the market
              </div>
            </div>

            <div className="relative pt-12 pb-8">
              {/* Range Bar */}
              <div className="h-3 w-full bg-white/5 rounded-full relative">
                {/* Visual Indicators */}
                <div className="absolute left-0 -top-6 text-[10px] font-black text-[var(--optimal-green)]">$ {data?.market_min} (Min)</div>
                <div className="absolute right-0 -top-6 text-[10px] font-black text-[var(--alert-red)]">$ {data?.market_max} (Max)</div>
                
                {/* Target Marker */}
                <div 
                  className="absolute h-10 w-1 bg-[var(--soft-gold)] top-1/2 -translate-y-1/2 transition-all duration-1000 ease-out"
                  style={{ left: `${spreadPercentage}%` }}
                >
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 rounded-lg bg-[var(--soft-gold)] text-[var(--deep-ocean)] text-xs font-black shadow-lg">
                    YOU: ${data?.target_price}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--soft-gold)] rotate-45" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12 flex items-center gap-12 border-t border-white/5 pt-8">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase">Price Gap (To Min)</span>
                <span className="text-xl font-black text-white">
                  {data?.target_price && data?.market_min ? `+$${(data.target_price - data.market_min).toFixed(2)}` : "N/A"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase">Inventory Spread</span>
                <span className="text-xl font-black text-white">
                  {data?.market_max && data?.market_min ? `$${(data.market_max - data.market_min).toFixed(2)}` : "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Historical Trend Preview */}
          <div className="glass-card p-8 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-black text-white mb-2">Target Price Trend</h2>
              <p className="text-xs text-[var(--text-muted)] font-medium mb-8">30-day historical movements</p>
              
              <div className="space-y-4">
                {data?.price_history?.slice(0, 5).map((point: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="text-[10px] font-black text-[var(--text-muted)]">
                        {new Date(point.recorded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div className="text-sm font-black text-white">${point.price}</div>
                  </div>
                ))}
              </div>
            </div>

            <Link href="/reports" className="btn-gold w-full mt-8 font-black text-xs uppercase tracking-widest py-4 text-center block">
              Detailed History Repo
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function KPICard({ title, value, subtitle, icon, highlight = false }: { 
  title: string, 
  value: string, 
  subtitle: string, 
  icon: React.ReactNode,
  highlight?: boolean
}) {
  return (
    <div className={`glass-card p-6 border-l-4 ${highlight ? 'border-l-[var(--soft-gold)]' : 'border-l-white/10'}`}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">{title}</span>
        <div className={`p-2 rounded-lg bg-white/5 ${highlight ? 'text-[var(--soft-gold)]' : 'text-[var(--text-muted)]'}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-black text-white mb-1 tracking-tight">{value}</div>
      <div className="text-[10px] font-medium text-[var(--text-muted)]">{subtitle}</div>
    </div>
  );
}
