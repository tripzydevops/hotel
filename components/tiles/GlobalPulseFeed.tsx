"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, TrendingDown, Clock, Zap, Users, Building2, Shield, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { API_BASE_URL } from '@/lib/api';

interface pulseWin {
  hotel_name: string;
  reduction: string;
  message: string;
  timestamp: string;
}

// EXPLANATION: [Global Pulse Phase 2] — Live Network Stats
// This interface mirrors the response from /api/global-pulse/stats.
// We display these dynamically instead of hardcoded values to build
// user trust and demonstrate the network's real value.
interface PulseStats {
  active_users_count: number;
  hotels_monitored: number;
  cache_hit_rate_24h: number;
  estimated_savings_credits: number;
}

export const GlobalPulseFeed: React.FC = () => {
  const [wins, setWins] = useState<pulseWin[]>([]);
  const [stats, setStats] = useState<PulseStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPulse = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/global-pulse`);
      if (res.ok) {
        const data = await res.json();
        setWins(data);
      }
    } catch (error) {
      console.error('Failed to fetch global pulse:', error);
    } finally {
      setLoading(false);
    }
  };

  // EXPLANATION: Fetch live network stats from the new Phase 2 endpoint.
  // Stats are cached server-side for 5 minutes, so polling every 2 mins
  // on the client gives a good balance of freshness vs network usage.
  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/global-pulse/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch pulse stats:', error);
    }
  };

  useEffect(() => {
    fetchPulse();
    fetchStats();
    const pulseInterval = setInterval(fetchPulse, 60000);
    const statsInterval = setInterval(fetchStats, 120000);
    return () => {
      clearInterval(pulseInterval);
      clearInterval(statsInterval);
    };
  }, []);

  if (loading && wins.length === 0) {
    return (
      <div className="bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)] rounded-2xl p-6 h-[400px] animate-pulse">
        <div className="h-6 w-32 bg-[var(--glass-bg-accent)] rounded mb-6" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="mb-4 space-y-2">
            <div className="h-4 w-full bg-[var(--glass-bg-accent)] rounded" />
            <div className="h-3 w-2/3 bg-[var(--glass-bg-accent)] rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="glass-card rounded-[2rem] p-6 shadow-2xl relative overflow-hidden group border-[var(--overlay-border)] bg-[var(--deep-ocean)]/30">
      {/* Decorative Gradient Pulse */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 blur-[100px] rounded-full group-hover:bg-indigo-500/20 transition-all duration-700" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 blur-[100px] rounded-full group-hover:bg-emerald-500/20 transition-all duration-700" />

      <div className="flex items-center justify-between mb-6 relative">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
            <Globe className="w-5 h-5 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Global Pulse</h2>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest leading-none">Live Network</span>
        </div>
      </div>

      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {wins.length > 0 ? (
            wins.map((win, idx) => (
              <motion.div
                key={`${win.hotel_name}-${win.timestamp}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.05 }}
                className="group/item flex items-start gap-4 p-4 rounded-2xl bg-white/[0.03] border border-[var(--overlay-border)] hover:bg-white/[0.06] hover:border-[var(--overlay-border)] transition-all cursor-default"
              >
                <div className="mt-1 p-2 bg-emerald-500/10 rounded-lg text-emerald-400 group-hover/item:scale-110 transition-transform">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] truncate pr-2">{win.hotel_name}</h3>
                    <span className="text-xs font-black text-emerald-400 shrink-0">-{win.reduction}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed mb-2 opacity-80 group-hover/item:opacity-100 transition-opacity">
                    {win.message}
                  </p>
                  <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(win.timestamp), { addSuffix: true })}
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)] italic text-sm">
              <RefreshCw className="w-8 h-8 mb-4 animate-spin opacity-20" />
              <p>Scanning the network for wins...</p>
            </div>
          )}
        </AnimatePresence>
      </div>
      
      {/* EXPLANATION: [Global Pulse Phase 2] — Live Network Stats Footer */}
      <div className="mt-6 pt-6 border-t border-[var(--overlay-border)] mb-2">
        {stats ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white/[0.02] border border-[var(--overlay-border)] hover:bg-white/[0.04] transition-colors">
              <div className="flex items-center gap-1.5 text-indigo-400">
                <Users className="w-3.5 h-3.5" />
                <span className="text-base font-black tracking-tighter">{stats.active_users_count}</span>
              </div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em]">Users</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white/[0.02] border border-[var(--overlay-border)] hover:bg-white/[0.04] transition-colors">
              <div className="flex items-center gap-1.5 text-cyan-400">
                <Building2 className="w-3.5 h-3.5" />
                <span className="text-base font-black tracking-tighter">{stats.hotels_monitored}</span>
              </div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em]">Hotels</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white/[0.02] border border-[var(--overlay-border)] hover:bg-white/[0.04] transition-colors">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Shield className="w-3.5 h-3.5" />
                <span className="text-base font-black tracking-tighter">{stats.cache_hit_rate_24h}%</span>
              </div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em]">Efficiency</span>
            </div>
          </div>
        ) : (
          <div className="h-16 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
};
