"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Target, TrendingUp, AlertTriangle, Cpu, Command } from 'lucide-react';

interface CommandBrief {
  summary: string;
  tactical_actions: string[];
  market_sentiment: string;
  threat_level: 'Low' | 'Moderate' | 'Critical' | 'Unknown';
}

export const CommandHUD: React.FC<{ hotelId: string }> = ({ hotelId }) => {
  const [brief, setBrief] = useState<CommandBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(true);

  useEffect(() => {
    const fetchBrief = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/v1/analysis/command-brief/${hotelId}`);
        const data = await response.json();
        setBrief(data);
      } catch (error) {
        console.error("Failed to fetch command brief", error);
      } finally {
        setLoading(false);
        setTimeout(() => setIsScanning(false), 2000);
      }
    };

    if (hotelId) fetchBrief();
  }, [hotelId]);

  const threatColors = {
    Low: 'border-emerald-500 text-emerald-400 bg-emerald-500/10',
    Moderate: 'border-amber-500 text-amber-400 bg-amber-500/10',
    Critical: 'border-rose-500 text-rose-400 bg-rose-500/10',
    Unknown: 'border-slate-500 text-slate-400 bg-slate-500/10'
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl transition-all hover:shadow-cyan-500/10">
      {/* Background HUD Decor */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.1),transparent)]" />
      
      {/* HUD Header */}
      <div className="relative mb-6 flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/30">
            <Command className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold tracking-widest text-white uppercase text-sm">Strategic Command AI</h3>
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-tighter">System {loading ? 'Processing' : 'Active'}</span>
            </div>
          </div>
        </div>
        
        <AnimatePresence>
          {brief?.threat_level && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${threatColors[brief.threat_level]}`}
            >
              <Shield className="h-3 w-3" />
              Threat Level: {brief.threat_level}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        {/* Main Status */}
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-[0.2em]">Objective Summary</span>
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
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-[0.2em]">Tactical Field Directives</span>
            <div className="space-y-3">
              {(loading ? Array(3).fill(null) : brief?.tactical_actions)?.map((action, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-3 group"
                >
                  <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-white/10 text-cyan-500 group-hover:border-cyan-500/50 transition-colors">
                    <Target className="h-3 w-3" />
                  </div>
                  {loading ? (
                    <div className="h-4 w-full bg-slate-800 rounded animate-pulse" />
                  ) : (
                    <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors uppercase tracking-tight">{action}</span>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Intelligence Intel */}
        <div className="rounded-xl border border-white/5 bg-white/5 p-4 backdrop-blur-sm space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-cyan-400" />
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Field Intel</span>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-slate-500 uppercase">Market Sentiment</span>
                <span className="text-[9px] text-cyan-400">Analysis 98%</span>
              </div>
              {loading ? (
                <div className="h-10 w-full bg-slate-800 rounded animate-pulse" />
              ) : (
                <p className="text-[11px] text-slate-400 font-mono leading-tight">
                  {brief?.market_sentiment}
                </p>
              )}
            </div>

            <div className="pt-4 border-t border-white/5">
              <div className="flex items-center gap-2 mb-2 text-rose-400">
                <AlertTriangle className="h-3 w-3" />
                <span className="text-[9px] font-bold uppercase tracking-tighter">KAIZEN ALERT</span>
              </div>
              <p className="text-[10px] text-slate-500 italic">
                Strategic brief generated via Gemini 3.1 Neural Array. Actions are advisory.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cyber Scanners */}
      {isScanning && (
        <motion.div 
          className="absolute inset-0 z-20 pointer-events-none"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="h-full w-full relative">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.8)] animate-scan-y" />
          </div>
        </motion.div>
      )}

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
