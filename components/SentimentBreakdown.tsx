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
}

interface SentimentBreakdownProps {
  items: SentimentItem[];
}

export const SentimentBreakdown: React.FC<SentimentBreakdownProps> = ({
  items,
}) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="glass-card p-8 border-white/5 bg-black/20">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-xl bg-[var(--soft-gold)]/10 text-[var(--soft-gold)]">
          <MessageSquare className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-black text-white tracking-tight">
            Sentiment Deep Dive
          </h3>
          <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">
            Granular analysis of review text & themes
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
        {items.map((item, idx) => {
          const posPercent = Math.round(
            (item.positive / item.total_mentioned) * 100,
          );
          const negPercent = Math.round(
            (item.negative / item.total_mentioned) * 100,
          );

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="relative group lg:px-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="text-sm font-bold text-white group-hover:text-[var(--soft-gold)] transition-colors">
                    {item.name}
                  </h4>
                  <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-tighter mt-0.5">
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
