"use client";

import { CheckCircle2, AlertOctagon, TrendingUp } from "lucide-react";

export default function ExecutiveSummary() {
  return (
    <div className="glass-panel-premium p-6 rounded-2xl h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Executive Briefing</h3>
          <p className="text-xs text-[var(--text-muted)]">
            Generated 2 mins ago by Analyst Agent
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex gap-4">
          <div className="mt-1">
            <CheckCircle2 className="w-5 h-5 text-optimal-green" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white mb-1">
              Revenue Target On-Track
            </h4>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Current pace indicates we will hit{" "}
              <span className="text-white font-bold">$124k</span> by month-end,
              exceeding target by 4%. Weekend occupancy is the primary driver.
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="mt-1">
            <AlertOctagon className="w-5 h-5 text-alert-red" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white mb-1">
              Competitor Undercut Alert
            </h4>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              <span className="text-white font-bold">Grand Marina</span> has
              aggressively dropped rates for the upcoming holiday weekend.
              Recommend matching their rate for "Standard" rooms only to defend
              market share.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--soft-gold)]/5 border border-[var(--soft-gold)]/10 mt-4">
          <h5 className="text-xs font-bold text-[var(--soft-gold)] uppercase tracking-widest mb-2">
            Recommended Action
          </h5>
          <p className="text-sm text-white font-medium">
            Approve "Flash Sale" for mid-week dates (Tue-Thu) to boost lagging
            occupancy. Estimated lift: +12%.
          </p>
          <button className="mt-3 w-full py-2 rounded-lg bg-[var(--soft-gold)] text-[var(--deep-ocean)] text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity">
            Approve Action
          </button>
        </div>
      </div>
    </div>
  );
}
