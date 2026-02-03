"use client";

import {
  CheckCircle2,
  AlertOctagon,
  TrendingUp,
  TrendingDown,
  HelpCircle,
  AlertTriangle,
} from "lucide-react";
import ReasoningShard from "@/components/ReasoningShard";
import { ReportBriefing } from "@/types";

interface ExecutiveSummaryProps {
  briefing: ReportBriefing | null;
}

export default function ExecutiveSummary({ briefing }: ExecutiveSummaryProps) {
  if (!briefing) {
    return (
      <div className="glass-panel-premium p-6 rounded-2xl h-full flex items-center justify-center">
        <p className="text-[var(--text-muted)] animate-pulse">
          Generating Briefing...
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel-premium p-6 rounded-2xl h-full flex flex-col overflow-y-auto custom-scrollbar">
      <div className="flex items-center gap-3 mb-6 flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Executive Briefing</h3>
          <p className="text-xs text-[var(--text-muted)]">
            Generated just now by Analyst Agent
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {briefing.insights.map((insight, idx) => (
          <ReasoningShard
            key={idx}
            title={insight.title}
            insight={insight.insight}
            type={insight.type as any}
          />
        ))}
      </div>

      <div className="p-4 rounded-xl bg-[var(--soft-gold)]/5 border border-[var(--soft-gold)]/10 mt-6 flex-shrink-0">
        <h5 className="text-xs font-bold text-[var(--soft-gold)] uppercase tracking-widest mb-2">
          Recommended Action
        </h5>
        <p className="text-sm text-white font-medium">{briefing.action}</p>
        <button className="mt-3 w-full py-2 rounded-lg bg-[var(--soft-gold)] text-[var(--deep-ocean)] text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity">
          Approve Action
        </button>
      </div>
    </div>
  );
}
