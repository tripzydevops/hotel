"use client";

import { useI18n } from "@/lib/i18n";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { useState } from "react";
import SentimentClusters from "./SentimentClusters";
import StrategyPanel from "./StrategyPanel";
import { Cpu } from "lucide-react";
import ReasoningShard from "@/components/ReasoningShard";

interface AnalysisClientProps {
  userId: string;
  initialProfile: any;
}

export default function AnalysisClient({
  userId,
  initialProfile,
}: AnalysisClientProps) {
  const { t } = useI18n();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--deep-ocean)] pb-24 relative animate-fade-in">
      <Header
        userProfile={initialProfile}
        hotelCount={0} // Not needed for this page
        unreadCount={0}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenBilling={() => setIsBillingOpen(true)}
      />

      <BottomNav
        onOpenAddHotel={() => {}} // No-op
        onOpenAlerts={() => setIsAlertsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        unreadCount={0}
      />

      <main className="pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            Semantic Intelligence
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-[8px] font-black text-purple-400 uppercase tracking-tighter shadow-lg shadow-purple-900/20">
              <Cpu className="w-2.5 h-2.5" />
              AI-Driven
            </span>
          </h1>
          <p className="text-[var(--text-secondary)] mt-1 text-sm">
            Deep dive into guest sentiment and strategic positioning.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[800px]">
          {/* Left Column: Sentiment & Insights (2/3 width) */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <ReasoningShard
              title="Anomaly Detected"
              insight="Positive sentiment for 'Breakfast' spiked by 200% after menu change. Consider increasing rate for Bed & Breakfast packages."
              type="positive"
            />

            <SentimentClusters />

            {/* Placeholder for future detailed sentiment breakdown */}
            <div className="glass-panel-premium flex-1 p-6 rounded-2xl flex items-center justify-center text-[var(--text-muted)] border-dashed border-2 border-white/5">
              <p className="text-sm">
                Detailed Review Analysis Stream (Incoming)
              </p>
            </div>
          </div>

          {/* Right Column: Strategy Engine (1/3 width) */}
          <div className="lg:col-span-1 h-full">
            <StrategyPanel />
          </div>
        </div>
      </main>
    </div>
  );
}
