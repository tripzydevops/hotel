import {
  Cpu,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  BrainCircuit,
  Sparkles,
  Zap,
  Activity,
  Target,
} from "lucide-react";

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
        return (
          <TrendingUp className="w-6 h-6 text-emerald-400 group-hover:scale-125 transition-transform" />
        );
      case "negative":
        return (
          <TrendingDown className="w-6 h-6 text-red-500 group-hover:scale-125 transition-transform" />
        );
      case "warning":
        return (
          <AlertTriangle className="w-6 h-6 text-amber-500 group-hover:scale-125 transition-transform" />
        );
      default:
        return (
          <BrainCircuit className="w-6 h-6 text-[var(--gold-primary)] group-hover:scale-125 transition-transform" />
        );
    }
  };

  const getAccentColor = () => {
    switch (type) {
      case "positive":
        return "text-emerald-400";
      case "negative":
        return "text-red-500";
      case "warning":
        return "text-amber-500";
      default:
        return "text-[var(--gold-primary)]";
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case "positive":
        return "border-emerald-500/20";
      case "negative":
        return "border-red-500/20";
      case "warning":
        return "border-amber-500/20";
      default:
        return "border-[var(--gold-primary)]/20";
    }
  };

  return (
    <div
      className={`premium-card p-10 group relative overflow-hidden bg-black/40 border-t-2 ${getBorderColor()} shadow-[0_30px_60px_rgba(0,0,0,0.5)] ${className}`}
    >
      {/* Dynamic Glow Aura */}
      <div
        className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-[100px] opacity-10 pointer-events-none transition-all duration-1000 group-hover:opacity-30 
        ${type === "warning" ? "bg-amber-500" : type === "positive" ? "bg-emerald-500" : type === "negative" ? "bg-red-500" : "bg-[var(--gold-primary)]"}
      `}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-black border border-white/5 shadow-2xl group-hover:border-white/20 transition-all duration-500">
              {getIcon()}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--text-muted)] group-hover:text-white transition-colors">
                Market Analysis
              </span>
              <span
                className={`text-[8px] font-black uppercase tracking-[0.3em] mt-1 opacity-60 ${getAccentColor()}`}
              >
                Market Change Detected
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5">
            <Activity size={12} className={`opacity-40 ${getAccentColor()}`} />
            <span className="text-[9px] font-black text-[var(--text-muted)] tracking-widest uppercase italic">
              Live
            </span>
          </div>
        </div>

        <h3 className="text-2xl font-black text-white mb-6 tracking-tighter uppercase italic leading-tight group-hover:text-[var(--gold-primary)] transition-colors">
          {title}
        </h3>

        <p className="text-base text-[var(--text-muted)] leading-relaxed font-bold uppercase tracking-tight opacity-70 group-hover:opacity-100 transition-opacity border-l-2 border-white/5 pl-8 italic">
          {insight}
        </p>

        <div className="mt-12 pt-6 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target size={14} className={getAccentColor()} />
            <span
              className={`text-[10px] font-black uppercase tracking-[0.4em] ${getAccentColor()}`}
            >
              Confidence_Parity: 98.2%
            </span>
          </div>

          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${i <= 3 ? (type === "neutral" ? "bg-[var(--gold-primary)] shadow-[0_0_8px_var(--gold-primary)]" : "bg-white/40") : "bg-white/5"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
