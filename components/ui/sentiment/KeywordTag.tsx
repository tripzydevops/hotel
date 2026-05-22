"use client";

import { motion } from "framer-motion";
import { KEYWORD_TRANSLATIONS } from "./sentimentUIHelpers";

/**
 * ── KeywordTag ──
 * Premium sentiment pill showing keyword mentions with count and sentiment color.
 * Features gradient backgrounds, spring hover scale, and glass-panel tooltips.
 */
export const KeywordTag = ({
  text,
  count,
  sentiment,
  size = "sm",
  description,
}: {
  text: string;
  count: number;
  sentiment: "positive" | "negative" | "neutral";
  size?: "sm" | "md";
  description?: string;
}) => {
  const t_name = KEYWORD_TRANSLATIONS[text.toLowerCase()] || text;

  // Gradient-based pill styling per sentiment bucket
  const colors = {
    positive:
      "bg-gradient-to-r from-emerald-500/10 to-emerald-400/5 text-emerald-400 border-emerald-500/15",
    negative:
      "bg-gradient-to-r from-red-500/10 to-red-400/5 text-red-400 border-red-500/15",
    neutral:
      "bg-gradient-to-r from-gray-500/10 to-gray-400/5 text-gray-400 border-gray-500/15",
  };

  return (
    <motion.div
      className="group relative inline-block"
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <span
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-medium cursor-default transition-colors ${
          colors[sentiment]
        } ${size === "md" ? "text-sm" : "text-[11px]"}`}
      >
        <span className="capitalize">{t_name}</span>
        <span className="w-[1px] h-3 bg-white/10" />
        <span className="text-[10px] font-black opacity-80">
          {count > 999 ? (count / 1000).toFixed(1) + "k" : count}
        </span>
      </span>
      {/* Glass-panel tooltip with review snippet */}
      {description && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2.5 bg-gray-900/95 backdrop-blur-xl border border-[var(--overlay-border)] rounded-xl text-[10px] text-[var(--text-secondary)] font-medium italic leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
          "{description}"
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900/95" />
        </div>
      )}
    </motion.div>
  );
};
