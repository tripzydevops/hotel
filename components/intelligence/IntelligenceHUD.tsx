"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, 
  Target, 
  TrendingUp, 
  Cpu, 
  MapPin, 
  Calendar,
  Layers,
  Activity
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface IntelligenceHUDProps {
  data: {
    hotel_name?: string;
    ari?: number | string;
    sent_index?: number | string;
    market_avg?: number | string;
    location?: string;
    date_range?: string;
  } | null;
  isStreaming: boolean;
}

export default function IntelligenceHUD({ data, isStreaming }: IntelligenceHUDProps) {
  const { t } = useI18n();

  const metrics = [
    {
      label: "ADR Index (ARI)",
      value: data?.ari || "---",
      icon: TrendingUp,
      color: "text-[var(--soft-gold)]",
      bg: "bg-[var(--soft-gold)]/10"
    },
    {
      label: "Sentiment Score",
      value: data?.sent_index || "---",
      icon: Target,
      color: "text-[var(--optimal-green)]",
      bg: "bg-[var(--optimal-green)]/10"
    },
    {
      label: "Market Position",
      value: data?.market_avg ? `${data.market_avg} TL` : "---",
      icon: Layers,
      color: "text-cyan-400",
      bg: "bg-cyan-400/10"
    }
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-1 backdrop-blur-3xl shadow-2xl">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent pointer-events-none" />
      
      <div className="relative flex flex-col md:flex-row items-stretch gap-1">
        {/* Core Identity Section */}
        <div className="flex-1 p-6 flex flex-col justify-center">
          <div className="flex items-center gap-4 mb-2">
            <div className={`p-3 rounded-2xl bg-white/5 border border-white/10 ${isStreaming ? "animate-pulse" : ""}`}>
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight leading-none">
                  {data?.hotel_name || "Initializing Command Center..."}
                </h2>
                {isStreaming && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--optimal-green)]/10 border border-[var(--optimal-green)]/20">
                    <Activity className="w-3 h-3 text-[var(--optimal-green)] animate-ping" />
                    <span className="text-[8px] font-black text-[var(--optimal-green)] uppercase">Synchronizing</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-[var(--text-muted)]" />
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    {data?.location || "Vector Space L2"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-[var(--text-muted)]" />
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    {data?.date_range || "Next 30 Days"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Metrics Grid */}
        <div className="flex flex-wrap md:flex-nowrap gap-1 p-1">
          {metrics.map((metric, idx) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="flex-1 min-w-[160px] p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col justify-center gap-1 hover:bg-white/[0.05] transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-[0.1em]">
                  {metric.label}
                </span>
                <metric.icon className={`w-3.5 h-3.5 ${metric.color}`} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-white tracking-tighter">
                  {metric.value}
                </span>
                {metric.label.includes('Index') && (
                  <span className="text-[10px] font-bold text-white/40 uppercase">PTS</span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
