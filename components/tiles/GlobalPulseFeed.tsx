"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, TrendingDown, Clock, Zap, Users, Building2, Shield } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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
      const res = await fetch('/api/global-pulse');
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
      const res = await fetch('/api/global-pulse/stats');
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
      <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl p-6 h-[400px] animate-pulse">
        <div className="h-6 w-32 bg-slate-800 rounded mb-6" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="mb-4 space-y-2">
            <div className="h-4 w-full bg-slate-800 rounded" />
            <div className="h-3 w-2/3 bg-slate-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
      {/* Decorative Gradient Pulse */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 blur-[100px] rounded-full group-hover:bg-indigo-500/20 transition-all duration-700" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 blur-[100px] rounded-full group-hover:bg-emerald-500/20 transition-all duration-700" />

      <div className="flex items-center justify-between mb-6 relative">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
            <Globe className="w-5 h-5 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">Global Pulse</h2>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
          <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest leading-none">Live Network</span>
        </div>
      </div>

      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
        <AnimatePresence mode="popLayout">
          {wins.length > 0 ? (
            wins.map((win, idx) => (
              <motion.div
                key={`${win.hotel_name}-${win.timestamp}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.1 }}
                className="group/item flex items-start gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all cursor-default"
              >
                <div className="mt-1 p-2 bg-emerald-500/10 rounded-lg text-emerald-400 group-hover/item:scale-110 transition-transform">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-white truncate pr-2">{win.hotel_name}</h3>
                    <span className="text-xs font-black text-emerald-400 shrink-0">-{win.reduction}</span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-2">
                    {win.message}
                  </p>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(win.timestamp), { addSuffix: true })}
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 italic text-sm">
              <p>Scanning the network for wins...</p>
            </div>
          )}
        </AnimatePresence>
      </div>
      
      {/* EXPLANATION: [Global Pulse Phase 2] — Live Network Stats Footer
           Replaces the hardcoded "484 active users" with real metrics.
           Shows active users, monitored hotels, and cache efficiency. */}
      <div className="mt-6 pt-4 border-t border-white/5">
        {stats ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1 text-indigo-400">
                <Users className="w-3 h-3" />
                <span className="text-sm font-bold">{stats.active_users_count}</span>
              </div>
              <span className="text-[9px] text-slate-500 uppercase tracking-wider">Users</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1 text-cyan-400">
                <Building2 className="w-3 h-3" />
                <span className="text-sm font-bold">{stats.hotels_monitored}</span>
              </div>
              <span className="text-[9px] text-slate-500 uppercase tracking-wider">Hotels</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1 text-emerald-400">
                <Shield className="w-3 h-3" />
                <span className="text-sm font-bold">{stats.cache_hit_rate_24h}%</span>
              </div>
              <span className="text-[9px] text-slate-500 uppercase tracking-wider">Cache Hit</span>
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-slate-500 font-medium text-center leading-relaxed">
            Loading network stats...
          </p>
        )}
      </div>
    </div>
  );
};
