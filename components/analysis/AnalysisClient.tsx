"use client";

import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import SentimentClusters from "./SentimentClusters";
import StrategyPanel from "./StrategyPanel";
import { Cpu, Zap, Activity } from "lucide-react";
import ReasoningShard from "@/components/ReasoningShard";
import CommandLayout from "@/components/layout/CommandLayout";

interface AnalysisClientProps {
  userId: string;
  initialProfile: any;
}

export default function AnalysisClient({
  userId,
  initialProfile,
}: AnalysisClientProps) {
  const { t } = useI18n();

  return (
    <CommandLayout userProfile={initialProfile} activeRoute="analysis">
      <div className="flex flex-col mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Activity className="w-4 h-4 text-[var(--soft-gold)]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--soft-gold)]">
            Semantic Intelligence Engine
          </span>
        </div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          Market Analysis
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 text-[8px] font-black text-[var(--soft-gold)] uppercase tracking-tighter">
            <Cpu className="w-2.5 h-2.5" />
            Active Reasoning
          </span>
        </h1>
        <p className="text-[var(--text-secondary)] mt-1 text-sm font-medium">
          Quantifying guest sentiment and strategic positioning signals.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Sentiment & Insights (2/3 width) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <ReasoningShard
            title="Sentiment Anomaly Detected"
            insight="Positive sentiment for 'Breakfast' spiked by 200% after menu change. This correlates with a local festival cancellation. Suggested Action: Increase rate for Bed & Breakfast packages."
            type="positive"
          />

          <div className="panel border-[var(--panel-border)] overflow-hidden">
            <div className="panel-header bg-black/10">
              <span className="text-xs font-bold uppercase tracking-wider">
                Semantic Sentiment Heatmap
              </span>
              <span className="text-[10px] text-[var(--soft-gold)] font-mono">
                LIVE FEED
              </span>
            </div>
            <div className="p-0">
              <SentimentClusters />
            </div>
          </div>

          <div className="panel p-6 bg-black/10 border-dashed border-[var(--panel-border)] flex items-center justify-center text-[var(--text-muted)] h-48">
            <p className="text-xs font-mono tracking-widest uppercase">
              // Extended Review Stream: Awaiting Buffer
            </p>
          </div>
        </div>

        {/* Right Column: Strategy Engine (1/3 width) */}
        <div className="lg:col-span-1">
          <StrategyPanel />
        </div>
      </div>
    </CommandLayout>
  );
}
