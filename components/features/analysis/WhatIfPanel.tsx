"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronRight, AlertTriangle, TrendingUp, TrendingDown, Zap, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface WhatIfResult {
  scenario: string;
  predicted_occupancy_impact: string;
  predicted_revenue_impact: string;
  competitor_reactions: string[];
  risk_level: "Low" | "Medium" | "High" | "Unknown";
  recommendation: string;
  reasoning: string;
  error?: boolean;
}

const RISK_COLORS = {
  Low: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  Medium: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  High: "text-rose-400 bg-rose-400/10 border-rose-400/30",
  Unknown: "text-gray-400 bg-gray-400/10 border-gray-400/30",
};

const EXAMPLE_SCENARIOS = [
  "What if I raise my Standard Room by ₺200?",
  "What if my main competitor drops rates by 15% this weekend?",
  "What if I offer a 10% early-bird discount for 30+ days advance?",
];

export default function WhatIfPanel({ hotelId }: { hotelId: string }) {
  const [scenario, setScenario] = useState("");
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const simulate = async () => {
    if (!scenario.trim() || scenario.trim().length < 10) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await api.simulateWhatIf(hotelId, scenario.trim());
      setResult(res);
    } catch (err: any) {
      setError(err?.message || "Simulation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-black text-[var(--overlay-text)] tracking-tight">
            What-If Scenario Modeling
          </h3>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold">
            AI-Powered Market Simulation
          </p>
        </div>
      </div>

      {/* Scenario Input */}
      <div className="space-y-3">
        <textarea
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          placeholder="Describe your scenario... e.g. 'What if I raise Standard Room by ₺300 this weekend?'"
          rows={3}
          className="w-full bg-[var(--deep-ocean-accent)]/40 border border-[var(--overlay-border)] rounded-xl p-4 text-sm text-[var(--overlay-text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-violet-500/50 resize-none transition-colors"
        />

        {/* Example Chips */}
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_SCENARIOS.map((ex) => (
            <button
              key={ex}
              onClick={() => setScenario(ex)}
              className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>

        <button
          onClick={simulate}
          disabled={loading || scenario.trim().length < 10}
          className="w-full py-3 rounded-xl bg-violet-500 text-white text-sm font-black uppercase tracking-widest hover:bg-violet-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Simulating...</>
          ) : (
            <><Zap className="w-4 h-4" /> Run Simulation</>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-rose-400 text-sm bg-rose-400/10 border border-rose-400/20 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {result && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 pt-4 border-t border-[var(--overlay-border)]"
          >
            {/* Risk Badge */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-muted)] uppercase font-black tracking-widest">
                Simulation Results
              </span>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${RISK_COLORS[result.risk_level] || RISK_COLORS.Unknown}`}>
                {result.risk_level} Risk
              </span>
            </div>

            {/* Impact Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-[var(--deep-ocean-accent)]/30 border border-[var(--overlay-border)]">
                <div className="text-[9px] text-[var(--text-muted)] uppercase font-black tracking-widest mb-1.5 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" /> Occupancy Impact
                </div>
                <div className="text-sm font-bold text-[var(--overlay-text)]">
                  {result.predicted_occupancy_impact}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--deep-ocean-accent)]/30 border border-[var(--overlay-border)]">
                <div className="text-[9px] text-[var(--text-muted)] uppercase font-black tracking-widest mb-1.5 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Revenue Impact
                </div>
                <div className="text-sm font-bold text-[var(--soft-gold)]">
                  {result.predicted_revenue_impact}
                </div>
              </div>
            </div>

            {/* Competitor Reactions */}
            {result.competitor_reactions.length > 0 && (
              <div className="p-3 rounded-xl bg-[var(--deep-ocean-accent)]/20 border border-[var(--overlay-border)] space-y-1.5">
                <div className="text-[9px] text-[var(--text-muted)] uppercase font-black tracking-widest mb-2">
                  Likely Competitor Reactions
                </div>
                {result.competitor_reactions.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                    <ChevronRight className="w-3 h-3 flex-shrink-0 mt-0.5 text-violet-400" />
                    {r}
                  </div>
                ))}
              </div>
            )}

            {/* Recommendation */}
            <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/20">
              <div className="text-[9px] text-violet-400 uppercase font-black tracking-widest mb-1.5">
                AI Recommendation
              </div>
              <p className="text-xs text-[var(--overlay-text)] leading-relaxed">
                {result.recommendation}
              </p>
            </div>

            {/* Reasoning (collapsible) */}
            <details className="group">
              <summary className="text-[9px] text-[var(--text-muted)] uppercase font-black tracking-widest cursor-pointer hover:text-[var(--text-secondary)] transition-colors">
                View Reasoning Trace ▸
              </summary>
              <p className="mt-2 text-[11px] text-[var(--text-muted)] leading-relaxed pl-3 border-l border-[var(--overlay-border)]">
                {result.reasoning}
              </p>
            </details>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
