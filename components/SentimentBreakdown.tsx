import React from "react";
import { motion } from "framer-motion";

interface ReviewItem {
  name: string;
  rating: number; // e.g. 4.5
}

interface SentimentBreakdownProps {
  items: ReviewItem[];
}

export const SentimentBreakdown: React.FC<SentimentBreakdownProps> = ({
  items,
}) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="mt-3 bg-slate-900/50 rounded-lg p-3 border border-slate-800">
      <h4 className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
        Guest Sentiment
      </h4>
      <div className="space-y-2">
        {items.slice(0, 4).map((item, idx) => (
          <div key={idx} className="flex items-center text-xs">
            <span className="w-16 text-slate-400 truncate">{item.name}</span>
            <div className="flex-1 mx-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(item.rating / 5) * 100}%` }}
                className={`h-full rounded-full ${
                  item.rating >= 4.0
                    ? "bg-emerald-500"
                    : item.rating >= 3.0
                      ? "bg-amber-500"
                      : "bg-rose-500"
                }`}
              />
            </div>
            <span
              className={`w-8 text-right font-medium ${
                item.rating >= 4.0
                  ? "text-emerald-400"
                  : item.rating >= 3.0
                    ? "text-amber-400"
                    : "text-rose-400"
              }`}
            >
              {item.rating}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
