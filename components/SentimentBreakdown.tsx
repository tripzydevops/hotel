"use client";

import React from "react";
import { ThumbsUp, ThumbsDown, Minus } from "lucide-react";

interface SentimentCategory {
  name: string;
  description?: string;
  total_mentioned: number;
  positive: number;
  negative: number;
  neutral: number;
}

interface SentimentBreakdownProps {
  data: SentimentCategory[] | null | undefined;
}

export default function SentimentBreakdown({ data }: SentimentBreakdownProps) {
  console.log("SentimentBreakdown Data:", data);
  if (!data || data.length === 0) {
    return (
      <div className="p-4 bg-red-500/10 text-red-500 border border-red-500 rounded">
        DEBUG: No Sentiment Data Received
      </div>
    );
  }

  // Sort by total mentions to show most relevant first
  const sortedData = [...data].sort(
    (a, b) => b.total_mentioned - a.total_mentioned,
  );

  return (
    <div className="bg-[var(--card-bg)] border border-white/5 rounded-2xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
      {/* Background Accent */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--optimal-green)]/5 rounded-full blur-3xl -z-10" />

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-[var(--deep-ocean)] border border-white/10 shadow-inner">
          <ThumbsUp className="w-5 h-5 text-[var(--soft-gold)]" />
        </div>
        <div>
          <h3 className="text-lg font-black text-white tracking-tight">
            Sentiment Deep Dive
          </h3>
          <p className="text-xs text-[var(--text-muted)] font-medium">
            Granular analysis of review text & themes
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sortedData.map((cat) => (
          <div key={cat.name} className="space-y-2">
            <div className="flex justify-between items-end">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white leading-none">
                  {cat.description || cat.name}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-0.5">
                  {cat.total_mentioned} Mentions
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs font-bold">
                <div className="flex items-center gap-1 text-[var(--optimal-green)]">
                  <ThumbsUp className="w-3 h-3" />
                  {Math.round((cat.positive / cat.total_mentioned) * 100)}%
                </div>
                {cat.negative > 0 && (
                  <div className="flex items-center gap-1 text-[var(--alert-red)]">
                    <ThumbsDown className="w-3 h-3" />
                    {Math.round((cat.negative / cat.total_mentioned) * 100)}%
                  </div>
                )}
              </div>
            </div>

            {/* Stacked Bar */}
            <div className="h-2 w-full bg-[var(--deep-ocean)] rounded-full overflow-hidden flex">
              {/* Positive */}
              <div
                className="h-full bg-[var(--optimal-green)]"
                style={{
                  width: `${(cat.positive / cat.total_mentioned) * 100}%`,
                }}
              />
              {/* Neutral */}
              <div
                className="h-full bg-white/20"
                style={{
                  width: `${(cat.neutral / cat.total_mentioned) * 100}%`,
                }}
              />
              {/* Negative */}
              <div
                className="h-full bg-[var(--alert-red)]"
                style={{
                  width: `${(cat.negative / cat.total_mentioned) * 100}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
