import React from "react";
import { motion } from "framer-motion";
import { ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";

interface SentimentItem {
  name: string;
  total_mentioned: number;
  positive: number;
  negative: number;
  neutral: number;
  description?: string;
  serpapi_link?: string;
}

import { ExternalLink } from "lucide-react";

interface SentimentBreakdownProps {
  items: SentimentItem[];
}

export const SentimentBreakdown: React.FC<SentimentBreakdownProps> = ({
  items,
}) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="glass-card p-10 border-white/5 bg-black/20">
      <div className="flex items-start gap-4 mb-10">
        <div className="p-3 rounded-2xl bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] border border-[var(--soft-gold)]/20 shadow-[0_0_15px_rgba(255,215,0,0.1)]">
          <ThumbsUp className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-xl font-black text-white tracking-tight leading-none mb-1">
            Sentiment Deep Dive
          </h3>
          <p className="text-[11px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em] opacity-60">
            Granular analysis of review text & themes
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-20 gap-y-12">
        {items.map((item, idx) => {
          const total = item.total_mentioned || 0;
          const posPercent =
            total > 0 && !Number.isNaN(item.positive)
              ? Math.round(((item.positive || 0) / total) * 100)
              : 0;
          const negPercent =
            total > 0 && !Number.isNaN(item.negative)
              ? Math.round(((item.negative || 0) / total) * 100)
              : 0;

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="relative group lg:px-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white group-hover:text-[var(--soft-gold)] transition-colors">
                    {item.name}
                  </h4>
                  {item.serpapi_link && (
                    <a
                      href={item.serpapi_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-[var(--soft-gold)] transition-all"
                      title="View Source on Google"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-tighter ml-auto">
                    {item.total_mentioned} MENTIONS
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                    <ThumbsUp className="w-3.5 h-3.5 text-[var(--optimal-green)]" />
                    <span className="text-xs font-black text-white">
                      {posPercent}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                    <ThumbsDown className="w-3.5 h-3.5 text-[var(--alert-red)]" />
                    <span className="text-xs font-black text-white">
                      {negPercent}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Minimalist Progress Bar */}
              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${posPercent}%` }}
                  className="h-full bg-white/20 group-hover:bg-[var(--soft-gold)]/30 transition-colors"
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default SentimentBreakdown;
