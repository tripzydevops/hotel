"use client";

import { Lightbulb, ArrowRight, Zap } from "lucide-react";

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
    action: "Apply +5% Rate",
  },
  {
    id: "2",
    title: "Sentiment Capitalization",
    description:
      "Guests are praising your 'Breakfast' while complaining about competitor's 'Noise'. Highlight quiet rooms in ads.",
    impact: "medium",
    action: "Create Ad Campaign",
  },
  {
    id: "3",
    title: "Weekday Filling",
    description:
      "Occupancy for next Tuesday is low (30%). Competitors are avg 45%.",
    impact: "medium",
    action: "Flash Sale -10%",
  },
];

export default function StrategyPanel() {
  return (
    <div className="glass-panel-premium p-6 rounded-2xl h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 rounded-lg bg-[var(--soft-gold)]/10">
          <Zap className="w-5 h-5 text-[var(--soft-gold)]" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Strategy Engine</h3>
          <p className="text-xs text-[var(--text-muted)]">
            AI-Optimized Recommendations
          </p>
        </div>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {mockStrategies.map((item) => (
          <div
            key={item.id}
            className="group p-4 rounded-xl bg-white/5 border border-white/5 hover:border-[var(--soft-gold)]/30 transition-all hover:bg-white/[0.07]"
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-white group-hover:text-gradient-gold transition-all">
                {item.title}
              </h4>
              <span
                className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                  item.impact === "high"
                    ? "bg-optimal-green/10 text-optimal-green border-optimal-green/20"
                    : "bg-amber-400/10 text-amber-400 border-amber-400/20"
                }`}
              >
                {item.impact} Impact
              </span>
            </div>

            <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">
              {item.description}
            </p>

            <button className="w-full py-2 rounded-lg bg-[var(--soft-gold)] text-[var(--deep-ocean)] font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              {item.action}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
