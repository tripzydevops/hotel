"use client";

import { Cpu, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";

interface ReasoningShardProps {
  title: string;
  insight: string;
  type?: "positive" | "negative" | "warning" | "neutral";
  className?: string;
}

export default function ReasoningShard({
  title,
  insight,
  type = "neutral",
  className = "",
}: ReasoningShardProps) {
  const getIcon = () => {
    switch (type) {
      case "positive":
        return <TrendingUp className="w-4 h-4 text-optimal-green" />;
      case "negative":
        return <TrendingDown className="w-4 h-4 text-alert-red" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      default:
        return <Cpu className="w-4 h-4 text-[var(--soft-gold)]" />;
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case "positive":
        return "group-hover:border-optimal-green/30";
      case "negative":
        return "group-hover:border-alert-red/30";
      case "warning":
        return "group-hover:border-amber-400/30";
      default:
        return "group-hover:border-[var(--soft-gold)]/30";
    }
  };

  return (
    <div
      className={`glass-panel-premium p-5 rounded-2xl group relative overflow-hidden ${className}`}
    >
      {/* Background Glow */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-[var(--soft-gold)]/5 rounded-full blur-3xl group-hover:bg-[var(--soft-gold)]/10 transition-colors" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 shadow-inner">
            {getIcon()}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            Agent Insight
          </span>
        </div>

        <h3 className="text-sm font-bold text-white mb-1 group-hover:text-gradient-gold transition-all">
          {title}
        </h3>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          {insight}
        </p>
      </div>

      {/* Dynamic Border Overlay */}
      <div
        className={`absolute inset-0 border border-transparent ${getBorderColor()} rounded-2xl transition-colors pointer-events-none`}
      />
    </div>
  );
}
