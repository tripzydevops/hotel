import React from "react";
import { motion } from "framer-motion";

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
    <div className="glass-card p-6 border-l-4 border-l-[var(--soft-gold)]">
      <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--soft-gold)] animate-pulse" />
        Guest Sentiment Deep Dive
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {items.map((item, idx) => {
          const posPercent = (item.positive / item.total_mentioned) * 100;
          const negPercent = (item.negative / item.total_mentioned) * 100;
          const neuPercent = (item.neutral / item.total_mentioned) * 100;

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">{item.name}</h4>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {item.description}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-white px-2 py-0.5 rounded bg-white/5 uppercase">
                    {item.total_mentioned} Mentions
                  </span>
                </div>
              </div>

              {/* Multi-segment Bar */}
              <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden flex">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${posPercent}%` }}
                  className="h-full bg-[var(--optimal-green)]/80"
                  title={`Positive: ${item.positive}`}
                />
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${neuPercent}%` }}
                  className="h-full bg-white/20"
                  title={`Neutral: ${item.neutral}`}
                />
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${negPercent}%` }}
                  className="h-full bg-[var(--alert-red)]/80"
                  title={`Negative: ${item.negative}`}
                />
              </div>

              <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-tighter">
                <span className="text-[var(--optimal-green)]">
                  {item.positive} Pos
                </span>
                <span className="text-white/40">{item.neutral} Neu</span>
                <span className="text-[var(--alert-red)]">
                  {item.negative} Neg
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default SentimentBreakdown;
