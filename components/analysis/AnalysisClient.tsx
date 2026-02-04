"use client";

import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import SentimentClusters from "./SentimentClusters";
import StrategyPanel from "./StrategyPanel";
import {
  Cpu,
  Zap,
  Activity,
  BrainCircuit,
  Sparkles,
  Target,
} from "lucide-react";
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
      <div className="flex flex-col mb-12 relative">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 rounded-2xl bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] border border-[var(--gold-primary)]/20 shadow-[0_0_20px_rgba(212,175,55,0.1)]">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--gold-primary)] opacity-80 leading-none mb-1">
              Semantic_Intelligence_Engine
            </span>
            <h1 className="text-4xl font-black text-white flex items-center gap-6 italic leading-none tracking-tighter">
              MARKET_ANALYSIS
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--gold-glow)]/10 border border-[var(--gold-primary)]/20">
                <BrainCircuit className="w-4 h-4 text-[var(--gold-primary)] animate-bounce" />
                <span className="text-[9px] font-black text-[var(--gold-primary)] uppercase tracking-widest">
                  Active_Reasoning
                </span>
              </div>
            </h1>
          </div>
        </div>
        <p className="text-[var(--text-muted)] mt-2 text-sm font-bold uppercase tracking-tight opacity-60 border-l-2 border-[var(--gold-primary)]/20 pl-6 leading-relaxed">
          Quantifying global guest sentiment signals and autonomous strategic
          positioning vectors.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Sentiment & Insights (2/3 width) */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          <ReasoningShard
            title="Sentiment Anomaly Detected"
            insight="Positive sentiment for 'Breakfast' spiked by 200% after menu change. This correlates with a local festival cancellation. Suggested Action: Increase rate for Bed & Breakfast packages."
            type="positive"
            className="shadow-2xl"
          />

          <div className="premium-card overflow-hidden bg-black/40 border border-white/5 shadow-[0_30px_60px_rgba(0,0,0,0.5)] group">
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-[var(--gold-primary)]/10 border border-[var(--gold-primary)]/20 text-[var(--gold-primary)]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white">
                  Semantic_Sentiment_Heatmap
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[9px] text-[var(--gold-primary)] font-black uppercase tracking-widest">
                  LIVE_FEED
                </span>
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--gold-primary)] animate-ping" />
              </div>
            </div>
            <div className="p-0">
              <SentimentClusters />
            </div>
          </div>

          <div className="premium-card p-12 bg-black/20 border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-[var(--text-muted)] h-64 group hover:border-[var(--gold-primary)]/20 transition-all">
            <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mb-6 border border-white/5 transition-transform group-hover:scale-110">
              <Cpu className="w-8 h-8 opacity-20 group-hover:opacity-100 group-hover:text-[var(--gold-primary)] transition-all" />
            </div>
            <p className="text-[10px] font-black tracking-[0.5em] uppercase italic opacity-40">
              // Extended_Review_Stream: Awaiting_Buffer
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
