"use client";

import {
  Lightbulb,
  ArrowRight,
  Zap,
  Target,
  Activity,
  Sparkles,
  Cpu,
} from "lucide-react";

interface StrategyItem {
  id: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  action: string;
}

const mockStrategies: StrategyItem[] = [
  {
    id: "1",
    title: "Undercut Opportunity",
    description:
      "Competitor 'Grand Hotel' increased rates by 15% for next weekend. You can increase by 5% and still maintain lead.",
    impact: "high",
    action: "Authorize +5% Rate",
  },
  {
    id: "2",
    title: "Sentiment Capitalization",
    description:
      "Guests are praising your 'Breakfast' while complaining about competitor's 'Noise'. Highlight quiet rooms in ads.",
    impact: "medium",
    action: "Deploy Ad Protocol",
  },
  {
    id: "3",
    title: "Weekday Filling",
    description:
      "Occupancy for next Tuesday is low (30%). Competitors are avg 45%.",
    impact: "medium",
    action: "Execute Flash Sale",
  },
];

export default function StrategyPanel() {
  return (
    <div className="premium-card p-10 flex flex-col h-full bg-black/40 border border-white/5 shadow-[0_30px_60px_rgba(0,0,0,0.5)] relative overflow-hidden group">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--gold-glow)] opacity-10 blur-[80px] pointer-events-none" />

      <div className="flex items-center gap-6 mb-10 relative z-10">
        <div className="p-3.5 rounded-2xl bg-[var(--gold-primary)]/10 border border-[var(--gold-primary)]/20 text-[var(--gold-primary)] shadow-2xl group-hover:scale-110 transition-transform">
          <Zap className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">
            Strategy_Engine
          </h3>
          <p className="text-[9px] font-black text-[var(--gold-primary)] uppercase tracking-[0.4em] mt-2 opacity-60">
            Autonomous_Signal_Advisory
          </p>
        </div>
      </div>

      <div className="space-y-6 flex-1 overflow-y-auto pr-4 custom-scrollbar relative z-10">
        {mockStrategies.map((item) => (
          <div
            key={item.id}
            className="group/item p-6 rounded-3xl bg-black border border-white/5 hover:border-[var(--gold-primary)]/40 transition-all hover:bg-white/[0.03] shadow-inner"
          >
            <div className="flex justify-between items-start mb-4">
              <h4 className="text-base font-black text-white uppercase tracking-tight group-hover/item:text-[var(--gold-primary)] transition-colors italic">
                {item.title}
              </h4>
              <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${item.impact === "high" ? "bg-emerald-500 animate-pulse" : "bg-amber-500 animate-pulse"}`}
                />
                <span
                  className={`text-[8px] font-black uppercase tracking-widest ${item.impact === "high" ? "text-emerald-500" : "text-amber-500"}`}
                >
                  {item.impact}_Impact
                </span>
              </div>
            </div>

            <p className="text-sm text-[var(--text-muted)] mb-6 leading-relaxed font-bold uppercase tracking-tight opacity-60 group-hover:opacity-100 transition-opacity italic pl-4 border-l-2 border-white/5">
              {item.description}
            </p>

            <button className="btn-premium w-full py-4 flex items-center justify-center gap-4 group/btn relative overflow-hidden active:scale-95">
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
              <Cpu size={14} className="text-black relative z-10" />
              <span className="font-black uppercase tracking-[0.3em] text-xs text-black relative z-10">
                {item.action}
              </span>
              <ArrowRight className="w-4 h-4 text-black group-hover/btn:translate-x-1 transition-all relative z-10" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-center gap-8 opacity-20 relative z-10">
        <div className="flex items-center gap-2">
          <Target size={12} className="text-[var(--gold-primary)]" />
          <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white">
            Parity_Sync
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles size={12} className="text-[var(--gold-primary)]" />
          <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white">
            Yield_Max
          </span>
        </div>
      </div>
    </div>
  );
}
