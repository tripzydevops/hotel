"use client";

import React, { useState, useEffect } from "react";
import { 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Database, 
  Cpu, 
  Globe,
  Zap,
  BarChart3,
  RefreshCw
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { insforge } from "@/lib/insforge";
import { api } from "@/lib/api";
import { HealthMetrics, ProviderHealth } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';

const HeartbeatMonitor = () => {
  const queryClient = useQueryClient();
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ["admin", "heartbeats"],
    queryFn: async () => {
      const data = await api.getAdminHeartbeats();
      setLastRefreshed(new Date());
      return data;
    },
    staleTime: 60000, // Consider data stale after 1 minute if no event occurs
  });

  useEffect(() => {
    const channelName = "scan_completed:*";
    let debounceTimer: NodeJS.Timeout;

    const handleEvent = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["admin", "heartbeats"] });
      }, 500);
    };

    // Connect and subscribe using the correct SDK methods
    insforge.realtime.connect().then(() => {
      insforge.realtime.on(channelName, handleEvent);
      insforge.realtime.subscribe(channelName);
    });

    return () => {
      clearTimeout(debounceTimer);
      insforge.realtime.off(channelName, handleEvent);
      insforge.realtime.unsubscribe(channelName);
    };
  }, [queryClient]);

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case "operational":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "degraded":
        return <Activity className="w-4 h-4 text-amber-400" />;
      case "down":
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  if (isLoading && !metrics) {
    return (
      <div className="glass-card p-12 flex flex-col items-center justify-center border border-white/5">
        <RefreshCw className="w-8 h-8 animate-spin text-[var(--soft-gold)] mb-4" />
        <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em]">Synchronizing Neural Heartbeat...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header/Status Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-card border border-white/5 p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 blur-[40px] opacity-20 -z-10 group-hover:opacity-40 transition-opacity" />
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Zap className="w-5 h-5" />
            </div>
            <div className="text-right">
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-50">Overall Status</span>
              <h4 className={`text-xl font-black uppercase tracking-tighter mt-1 ${
                metrics?.overall_status === 'operational' ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {metrics?.overall_status || 'UPDATING'}
              </h4>
            </div>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden mt-4">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
            />
          </div>
        </div>

        <div className="glass-card border border-white/5 p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 blur-[40px] opacity-20 -z-10 group-hover:opacity-40 transition-opacity" />
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Clock className="w-5 h-5" />
            </div>
            <div className="text-right">
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-50">Uptime (24h)</span>
              <h4 className="text-xl font-black text-white tabular-nums mt-1">
                {metrics?.uptime_24h || 99.9}%
              </h4>
            </div>
          </div>
          <p className="text-[9px] font-black text-blue-400/60 uppercase tracking-widest mt-4">Target: 99.9%</p>
        </div>

        <div className="glass-card border border-white/5 p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 blur-[40px] opacity-20 -z-10 group-hover:opacity-40 transition-opacity" />
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Globe className="w-5 h-5" />
            </div>
            <div className="text-right">
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-50">Avg Latency</span>
              <h4 className="text-xl font-black text-white tabular-nums mt-1">
                {metrics?.avg_latency || 0}ms
              </h4>
            </div>
          </div>
          <p className="text-[9px] font-black text-purple-400/60 uppercase tracking-widest mt-4">P95 Response Time</p>
        </div>

        <div className="glass-card border border-white/5 p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--soft-gold)]/10 blur-[40px] opacity-20 -z-10 group-hover:opacity-40 transition-opacity" />
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 rounded-xl bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 text-[var(--soft-gold)]">
              <Database className="w-5 h-5" />
            </div>
            <div className="text-right">
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-50">Active Nodes</span>
              <h4 className="text-xl font-black text-white tabular-nums mt-1">
                {metrics?.active_nodes || 0}
              </h4>
            </div>
          </div>
          <p className="text-[9px] font-black text-[var(--soft-gold)]/60 uppercase tracking-widest mt-4">Scale: Auto-Nominal</p>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Provider Health List */}
        <div className="glass-card border border-white/5 p-8 overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Provider Health</h3>
              <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest mt-1">External API Dependencies</p>
            </div>
            <BarChart3 className="w-4 h-4 text-[var(--soft-gold)] opacity-50" />
          </div>

          <div className="space-y-4">
            {metrics?.provider_health.map((p: ProviderHealth, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 group hover:border-white/20 transition-all">
                <div className="flex items-center gap-3">
                  <StatusIcon status={p.status} />
                  <div>
                    <p className="text-xs font-bold text-white tracking-tight">{p.name}</p>
                    <p className="text-[9px] text-[var(--text-muted)] uppercase font-medium">{p.latency_avg}ms Latency</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-emerald-400 tabular-nums">{p.success_rate}%</p>
                  <p className="text-[8px] text-[var(--text-muted)] uppercase tracking-tighter">Success Rate</p>
                </div>
              </div>
            ))}
            
            {(!metrics?.provider_health || metrics.provider_health.length === 0) && (
              <div className="text-center py-10">
                <p className="text-[10px] text-[var(--text-muted)] uppercase font-black opacity-30">No Provider Data</p>
              </div>
            )}
          </div>
        </div>

        {/* Scan Volume Timeline */}
        <div className="lg:col-span-2 glass-card border border-white/5 p-8 relative">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Scan Intent Density</h3>
              <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest mt-1">Real-time Batch Frequency (Last 24h)</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--soft-gold)] animate-pulse" />
              <span className="text-[9px] font-black text-[var(--soft-gold)] uppercase tracking-widest">Live Monitoring</span>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics?.scan_volume || []}>
                <defs>
                  <linearGradient id="scanGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--soft-gold)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--soft-gold)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                <XAxis 
                  dataKey="timestamp" 
                  fontSize={8} 
                  stroke="rgba(255,255,255,0.2)" 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val: string) => new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                />
                <YAxis 
                  fontSize={8} 
                  stroke="rgba(255,255,255,0.2)" 
                  tickLine={false} 
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(5, 10, 20, 0.9)', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    fontSize: '10px',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                  }}
                  itemStyle={{ color: 'var(--soft-gold)', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="var(--soft-gold)" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#scanGradient)"
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex items-center justify-between mt-6 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-50">
            <span>Peak Demand: {Math.max(...(metrics?.scan_volume.map((v: { count: number }) => v.count) || [0]), 0)} units</span>
            <span>Last Updated: {lastRefreshed.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeartbeatMonitor;
