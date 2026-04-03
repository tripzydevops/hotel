"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Activity, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  Zap, 
  MapPin,
  Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PulseEvent {
  id: string;
  type: 'undercut' | 'price_drop' | 'price_rise' | 'new_competitor' | 'system';
  title: string;
  description: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location?: string;
}

const GlobalPulseFeed: React.FC = () => {
  // Mock data for the pulse feed - in a real app, this would come from a real-time stream or API
  const events = useMemo<PulseEvent[]>(() => [
    {
      id: '1',
      type: 'undercut',
      title: 'Yield Disruption Detected',
      description: 'Competitor "Grand Plaza" lowered rates by 12% below your target.',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      severity: 'critical',
      location: 'Antalya, TR'
    },
    {
      id: '2',
      type: 'price_drop',
      title: 'Market Shift: Downward Trend',
      description: 'Average market price in your region dropped by 4.5% in the last 2 hours.',
      timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      severity: 'medium',
      location: 'Antalya, TR'
    },
    {
      id: '3',
      type: 'system',
      title: 'Synchronization Complete',
      description: 'Successfully updated 128 price points across 4 booking channels.',
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      severity: 'low'
    },
    {
      id: '4',
      type: 'undercut',
      title: 'Dynamic Alert',
      description: '"Beach Resort & Spa" is matching your promotional rate.',
      timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      severity: 'high',
      location: 'Bodrum, TR'
    }
  ], []);

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'undercut': return <AlertTriangle className="w-4 h-4" />;
      case 'price_drop': return <TrendingDown className="w-4 h-4" />;
      case 'price_rise': return <TrendingUp className="w-4 h-4" />;
      case 'system': return <Zap className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <div className="glass-modal h-full flex flex-col p-6 overflow-hidden rounded-[2.5rem] bg-[var(--deep-ocean)]/40 border border-[var(--glass-border)]">
      <div className="flex items-center justify-between mb-8">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-ping shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
            <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-[0.2em] italic">
              Global Pulse
            </h2>
          </div>
          <span className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-wider pl-4">Live Intelligence Stream</span>
        </div>
        <div className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-2">
           <Activity className="w-3 h-3 text-indigo-400 animate-pulse" />
           <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Active</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
        <AnimatePresence>
          {events.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="group relative pl-6 border-l border-[var(--glass-border)] hover:border-[var(--text-primary)]/30 transition-colors pb-6 last:pb-0"
            >
              {/* Timeline Marker */}
              <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-[var(--deep-ocean)] border border-[var(--glass-border)] group-hover:border-[var(--text-primary)]/50 group-hover:scale-125 transition-all" />
              
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-4">
                  <div className={`p-1.5 rounded-lg border flex items-center justify-center ${getSeverityStyles(event.severity)}`}>
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                    {event.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 opacity-50" />
                        <span>{event.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 opacity-50" />
                      <span>{formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-tight group-hover:text-indigo-400 transition-colors">
                    {event.title}
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed font-medium">
                    {event.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-8 pt-4 border-t border-[var(--glass-border)]/50">
        <button className="w-full py-2.5 rounded-xl border border-[var(--glass-border)] text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)]/30 transition-all flex items-center justify-center gap-2 group">
          Intelligence Archive
          <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
        </button>
      </div>
    </div>
  );
};

export default GlobalPulseFeed;
