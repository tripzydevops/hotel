"use client";

import React from "react";
import { 
  Activity, 
  Zap, 
  AlertTriangle, 
  Cpu, 
  Server, 
  BarChart3,
  Waves
} from "lucide-react";
import { AdminStats } from "@/types";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SystemHealthPanelProps {
  stats: AdminStats | null;
}

const SystemHealthPanel = ({ stats }: SystemHealthPanelProps) => {
  // Mock history for the latency sparkline (in a real app, this would come from the backend)
  const latencyHistory = [
    { time: '10:00', val: (stats?.avg_latency_ms || 1200) * 0.9 },
    { time: '11:00', val: (stats?.avg_latency_ms || 1200) * 1.1 },
    { time: '12:00', val: (stats?.avg_latency_ms || 1200) * 0.95 },
    { time: '13:00', val: (stats?.avg_latency_ms || 1200) * 1.05 },
    { time: '14:00', val: stats?.avg_latency_ms || 1200 },
  ];

  const MetricCard = ({ label, value, subValue, icon: Icon, colorClass, shadowColor }: any) => (
    <motion.div 
      whileHover={{ y: -5, scale: 1.02 }}
      className="glass-card p-6 border border-white/5 relative overflow-hidden group h-full"
    >
      <div className={`absolute top-0 right-0 w-24 h-24 blur-[60px] opacity-20 -z-10 ${shadowColor}`} />
      
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl bg-white/5 border border-white/10 ${colorClass}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="text-right">
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-50">
            {label}
          </span>
          <h4 className="text-2xl font-black text-white tabular-nums drop-shadow-sm">
            {value}
          </h4>
        </div>
      </div>
      
      <div className="mt-auto">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "70%" }}
              className={`h-full ${colorClass.split(' ')[0].replace('text-', 'bg-')}`}
            />
          </div>
          <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
            {subValue}
          </span>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      {/* Global Status Banner (Only if significant errors) - Moved to TOP and OUTSIDE grid to prevent overlap */}
      {(stats?.error_rate_24h || 0) > 10 && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/20 p-5 rounded-2xl flex items-center justify-between shadow-lg shadow-red-500/5 backdrop-blur-md"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-widest">Critical Signal Degredation</h4>
              <p className="text-[10px] text-red-400/80 uppercase mt-1 tracking-tight">System-wide error rate exceeds 10% threshold. Verify API Keys and connectivity nodes.</p>
            </div>
          </div>
          <button className="bg-red-500 text-white text-[10px] font-black uppercase tracking-widest px-8 py-3 rounded-xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/20">
            Diagnostics
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Latency Board */}
        <div className="lg:col-span-2 glass-card p-8 border border-white/5 relative overflow-hidden flex flex-col min-h-[400px]">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Waves className="w-40 h-40 text-[var(--soft-gold)]" />
          </div>

          <div className="flex items-center justify-between mb-8 relative z-10">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                Neural Latency Matrix
                <span className="w-2 h-2 rounded-full bg-[var(--soft-gold)] animate-pulse shadow-[0_0_10px_var(--soft-gold)]" />
              </h3>
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest mt-1">
                Real-time response tracking (24h nodes)
              </p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-black text-[var(--soft-gold)] font-mono">
                {stats?.avg_latency_ms || 0}
                <span className="text-xs ml-1 opacity-50 uppercase tracking-tighter">ms</span>
              </span>
            </div>
          </div>

          <div className="flex-1 min-h-[200px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={latencyHistory}>
                <defs>
                  <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--soft-gold)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--soft-gold)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis 
                  dataKey="time" 
                  stroke="rgba(255,255,255,0.2)" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(0,0,0,0.8)', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '10px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="val" 
                  stroke="var(--soft-gold)" 
                  fillOpacity={1} 
                  fill="url(#latencyGradient)" 
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-8 pt-8 border-t border-white/5 relative z-10">
            <div className="space-y-1">
              <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest opacity-40">Throughput</span>
              <p className="text-sm font-bold text-white uppercase">14.2 req/s</p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest opacity-40">Active Nodes</span>
              <p className="text-sm font-bold text-white uppercase">{stats?.active_nodes || 1} Instances</p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest opacity-40">Stability</span>
              <p className="text-sm font-bold text-[var(--optimal-green)] uppercase">Nominal</p>
            </div>
          </div>
        </div>

        {/* Side Status Column */}
        <div className="space-y-6">
          <MetricCard 
            label="System Health"
            value={`${stats?.scraper_health || 100}%`}
            subValue="Success Rate"
            icon={Activity}
            colorClass="text-[var(--optimal-green)]"
            shadowColor="bg-[var(--optimal-green)]"
          />
          
          <MetricCard 
            label="Error Gradient"
            value={`${stats?.error_rate_24h || 0}%`}
            subValue="Incidents 24h"
            icon={AlertTriangle}
            colorClass={stats?.error_rate_24h && stats.error_rate_24h > 5 ? "text-red-400" : "text-orange-400"}
            shadowColor="bg-orange-500"
          />

          <MetricCard 
            label="Core Load"
            value="42%"
            subValue="Worker Memory"
            icon={Cpu}
            colorClass="text-blue-400"
            shadowColor="bg-blue-500"
          />
        </div>
      </div>
    </div>
  );
};

export default SystemHealthPanel;
