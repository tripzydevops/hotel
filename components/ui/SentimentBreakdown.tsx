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
    <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] p-8 sm:p-10 rounded-2xl relative overflow-hidden backdrop-blur-xl">
      <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
        <MessageSquare className="w-32 h-32" />
      </div>

      <div className="flex items-start gap-4 mb-10 relative z-10">
        <div className="p-3 rounded-xl bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] border border-[var(--soft-gold)]/20 shadow-[0_0_25px_rgba(212,175,55,0.1)]">
          <ThumbsUp className="w-6 h-6 sm:w-7 sm:h-7" />
        </div>
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tighter uppercase italic leading-none mb-2">
            Intelligence Sentiment Breakdown
          </h3>
          <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-[0.3em] opacity-80">
            Automated linguistic analysis of tactical review streams
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-10 relative z-10">
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
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="relative group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex flex-col gap-1">
                  <h4 className="text-sm font-black text-[var(--text-primary)] group-hover:text-[var(--soft-gold)] transition-colors uppercase tracking-widest">
                    {item.name}
                  </h4>
                  <span className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest opacity-60">
                    {item.total_mentioned} SIGNAL DETECTIONS
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1.5 grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                        <ThumbsUp className="w-3 h-3 text-optimal-green" />
                        <span className="text-xs font-black text-[var(--text-primary)]">{posPercent}%</span>
                    </div>
                    <div className="flex items-center gap-1.5 grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all mt-0.5">
                        <ThumbsDown className="w-3 h-3 text-alert-red" />
                        <span className="text-[10px] font-black text-[var(--text-muted)]">{negPercent}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Graphical Integrity Line */}
              <div className="h-1 w-full bg-[var(--deep-ocean-accent)] rounded-full overflow-hidden mb-4 border border-[var(--glass-border)]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${posPercent}%` }}
                  className="h-full bg-gradient-to-r from-optimal-green/20 via-optimal-green/40 to-optimal-green/60 group-hover:from-[var(--soft-gold)]/40 group-hover:to-[var(--soft-gold)] transition-all duration-500"
                />
              </div>

              {/* Decrypted Review Snippet */}
              {item.description && (
                <div className="flex items-start gap-3 py-3 px-4 bg-[var(--deep-ocean-accent)]/30 border border-[var(--glass-border)] rounded-xl group-hover:bg-[var(--deep-ocean-accent)]/50 transition-all relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--soft-gold)]/20" />
                  <MessageSquare className="w-3.5 h-3.5 text-[var(--soft-gold)] opacity-40 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-[var(--text-secondary)] italic leading-relaxed font-medium opacity-90">
                    "{item.description}"
                  </p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default SentimentBreakdown;
