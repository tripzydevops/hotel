import React from "react";
import { motion } from "framer-motion";

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
}

const StatCard = ({
  label,
  value,
  icon: Icon,
  trend = "neutral",
}: StatCardProps) => (
  <motion.div
    whileHover={{ y: -4, scale: 1.02 }}
    className="command-card p-6 flex flex-col gap-4 relative group cursor-default"
  >
    {/* Internal Glow Effect */}
    <div className="absolute inset-0 bg-gradient-to-br from-[var(--soft-gold)]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

    <div className="flex justify-between items-start relative z-10">
      <div className="w-12 h-12 rounded-2xl bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/10 flex items-center justify-center shrink-0 group-hover:border-[var(--soft-gold)]/30 transition-all duration-500 shadow-[inset_0_0_15px_rgba(212,175,55,0.1)]">
        <Icon className="w-6 h-6 text-[var(--soft-gold)] group-hover:scale-110 transition-transform" />
      </div>

      {/* Simulated Trendlette */}
      <div className="flex gap-1 items-end h-8 h-4 mt-2">
        {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
          <div
            key={i}
            className={`w-1 rounded-full opacity-30 ${trend === "up" ? "bg-[var(--optimal-green)]" : trend === "down" ? "bg-[var(--alert-red)]" : "bg-[var(--soft-gold)]"}`}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>

    <div className="relative z-10">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors">
        {label}
      </p>
      <div className="flex items-baseline gap-2 mt-1">
        <p className="text-3xl font-black text-white tracking-tighter tabular-nums">
          {value?.toLocaleString() || 0}
        </p>
        <span
          className={`text-[10px] font-black ${trend === "up" ? "text-[var(--optimal-green)]" : "text-[var(--text-muted)]"}`}
        >
          {trend === "up" ? "+12.5%" : ""}
        </span>
      </div>
    </div>
  </motion.div>
);

export default StatCard;
