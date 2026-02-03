"use client";

import { useI18n } from "@/lib/i18n";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { useState } from "react";
import YieldForecastChart from "./YieldForecastChart";
import ExecutiveSummary from "./ExecutiveSummary";
import { Cpu, FileText, TrendingUp } from "lucide-react";

interface ReportsClientProps {
  userId: string;
  initialProfile: any;
}

export default function ReportsClient({
  userId,
  initialProfile,
}: ReportsClientProps) {
  const { t } = useI18n();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);

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

          {/* Right Column: Key Metrics Grid (Placeholder for advanced metrics) */}
          <div className="grid grid-cols-2 gap-4 h-full">
            <div className="glass-panel-premium p-6 rounded-2xl flex flex-col justify-center items-center">
              <span className="text-[var(--text-muted)] text-xs uppercase tracking-widest font-bold mb-2">
                Projected RevPAR
              </span>
              <span className="text-4xl font-bold text-white">$142</span>
              <span className="text-xs text-optimal-green mt-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> +12% vs LY
              </span>
            </div>
            <div className="glass-panel-premium p-6 rounded-2xl flex flex-col justify-center items-center">
              <span className="text-[var(--text-muted)] text-xs uppercase tracking-widest font-bold mb-2">
                Occupancy Pace
              </span>
              <span className="text-4xl font-bold text-white">78%</span>
              <span className="text-xs text-optimal-green mt-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> +5% vs Comp
              </span>
            </div>
            <div className="glass-panel-premium p-6 rounded-2xl flex flex-col justify-center items-center col-span-2">
              <span className="text-[var(--text-muted)] text-xs uppercase tracking-widest font-bold mb-2">
                Market Demand Index
              </span>
              <div className="w-full h-4 bg-white/5 rounded-full overflow-hidden mt-2 relative">
                <div className="absolute left-0 top-0 h-full w-[85%] bg-gradient-to-r from-optimal-green to-blue-500"></div>
              </div>
              <div className="flex justify-between w-full mt-2 text-xs text-[var(--text-secondary)]">
                <span>Low</span>
                <span className="font-bold text-white">High (85/100)</span>
                <span>Peak</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Executive Summary */}
        <div className="h-[400px]">
          <ExecutiveSummary />
        </div>
      </main>
    </div>
  );
}
