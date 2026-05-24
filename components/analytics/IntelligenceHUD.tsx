"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Target, TrendingUp, AlertTriangle, Cpu, Command } from 'lucide-react';

import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';

interface IntelligenceBrief {
  summary: string;
  strategic_actions: string[];
  market_sentiment: string;
  market_stability: 'Optimal' | 'Moderate' | 'Volatile' | 'Unknown';
}

export const IntelligenceHUD: React.FC<{ hotelId: string }> = ({ hotelId }) => {
  const { t, locale } = useI18n();
  const [brief, setBrief] = useState<IntelligenceBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(true);

  useEffect(() => {
    const fetchBrief = async () => {
      try {
        setLoading(true);
        const data = await api.getIntelligenceBrief(hotelId, locale);
        setBrief(data);
      } catch (error) {
        console.error("Failed to fetch command brief", error);
      } finally {
        setLoading(false);
        setTimeout(() => setIsScanning(false), 2000);
      }
    };

    if (hotelId) fetchBrief();
  }, [hotelId, locale]);

  const stabilityColors = {
    Optimal: 'border-emerald-500 text-emerald-400 bg-emerald-500/10',
    Moderate: 'border-amber-500 text-amber-400 bg-amber-500/10',
    Volatile: 'border-rose-500 text-rose-400 bg-rose-500/10',
    Unknown: 'border-slate-500 text-[var(--text-muted)] bg-slate-500/10'
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--overlay-border)] bg-slate-950 p-6 shadow-2xl transition-all hover:shadow-cyan-500/10">
      {/* Background HUD Decor */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.1),transparent)]" />
      
      {/* HUD Header */}
      <div className="relative mb-6 flex items-center justify-between border-b border-[var(--overlay-border)] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/30">
            <Command className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold tracking-widest text-[var(--overlay-text)] uppercase text-sm">{t('analysis.title')}</h3>
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-tighter">{t('analysis.system')} {loading ? t('analysis.processing') : t('analysis.active')}</span>
            </div>
          </div>
        </div>
        
        <AnimatePresence>
          {brief?.market_stability && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${stabilityColors[brief.market_stability]}`}
            >
              <Shield className="h-3 w-3" />
              {t('analysis.stability')}: {t(`analysis.${brief.market_stability.toLowerCase()}` as any)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        {/* Main Status */}
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-[0.2em]">{t('analysis.objectiveSummary')}</span>
            <div className="relative min-h-[60px]">
              {loading ? (
                <div className="space-y-2">
                  <div className="h-4 w-full bg-slate-800 rounded animate-pulse" />
                  <div className="h-4 w-3/4 bg-slate-800 rounded animate-pulse" />
                </div>
              ) : (
                <p className="text-slate-300 text-sm leading-relaxed font-light italic">
                  "{brief?.summary}"
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-[0.2em]">{t('analysis.strategicInsights')}</span>
            <div className="space-y-3">
              {(loading ? Array(3).fill(null) : brief?.strategic_actions)?.map((action: string | null, i: number) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-3 group"
                >
                  <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[var(--overlay-border)] text-cyan-500 group-hover:border-cyan-500/50 transition-colors">
                    <Target className="h-3 w-3" />
                  </div>
                  {loading ? (
                    <div className="h-4 w-full bg-slate-800 rounded animate-pulse" />
                  ) : (
                    <span className="text-xs text-[var(--text-muted)] group-hover:text-slate-200 transition-colors uppercase tracking-tight">{action}</span>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Intelligence Intel */}
        <div className="rounded-xl border border-[var(--overlay-border)] bg-white/5 p-4 backdrop-blur-sm space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-cyan-400" />
            <span className="text-[10px] font-bold text-[var(--overlay-text)] uppercase tracking-wider">{t('analysis.fieldIntel')}</span>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-slate-500 uppercase">{t('analysis.marketSentiment')}</span>
                <span className="text-[9px] text-cyan-400">{t('analysis.analysisConfidence')} 98%</span>
              </div>
              {loading ? (
                <div className="h-10 w-full bg-slate-800 rounded animate-pulse" />
              ) : (
                <p className="text-[11px] text-[var(--text-muted)] font-mono leading-tight">
                  {brief?.market_sentiment}
                </p>
              )}
            </div>

            <div className="pt-4 border-t border-[var(--overlay-border)]">
              <div className="flex items-center gap-2 mb-2 text-rose-400">
                <AlertTriangle className="h-3 w-3" />
                <span className="text-[9px] font-bold uppercase tracking-tighter">{t('analysis.dataAlert')}</span>
              </div>
              <p className="text-[10px] text-slate-500 italic">
                {t('analysis.aiAdvisoryNote')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Scan overlay disabled per user request */}

      <style jsx>{`
        @keyframes scan-y {
          0% { top: 0; }
          100% { top: 100%; }
        }
        .animate-scan-y {
          animation: scan-y 2s linear infinite;
        }
      `}</style>
    </div>
  );
};
