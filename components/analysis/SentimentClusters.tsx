"use client";

import {
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Activity,
  Sparkles,
  BrainCircuit,
} from "lucide-react";

interface SentimentTopic {
  keyword: string;
  sentiment: "positive" | "negative" | "neutral";
  count: number;
}

const mockTopics: SentimentTopic[] = [
  { keyword: "Breakfast", sentiment: "positive", count: 42 },
  { keyword: "Cleanliness", sentiment: "positive", count: 35 },
  { keyword: "Noise", sentiment: "negative", count: 18 },
  { keyword: "Location", sentiment: "positive", count: 28 },
  { keyword: "Staff", sentiment: "positive", count: 25 },
  { keyword: "Price", sentiment: "neutral", count: 15 },
  { keyword: "WiFi", sentiment: "negative", count: 12 },
  { keyword: "Parking", sentiment: "neutral", count: 8 },
];

export default function SentimentClusters() {
  return (
    <div className="p-8 relative overflow-hidden group">
      {/* Background Ambience */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-br from-[var(--gold-primary)]/5 via-transparent to-transparent pointer-events-none opacity-40" />

      <div className="flex flex-wrap gap-4 relative z-10">
        {mockTopics.map((topic, i) => (
          <div
            key={i}
            className={`
              px-6 py-4 rounded-3xl border backdrop-blur-3xl transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-2xl relative group/node
              ${
                topic.sentiment === "positive"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-500/20"
                  : topic.sentiment === "negative"
                    ? "bg-red-500/10 border-red-500/20 text-red-500 hover:border-red-500/40 hover:bg-red-500/20"
                    : "bg-white/5 border-white/10 text-[var(--text-muted)] hover:border-[var(--gold-primary)]/20 hover:bg-white/10"
              }
            `}
          >
            {/* Active Node Glow */}
            <div
              className={`absolute inset-0 blur-xl opacity-0 group-hover/node:opacity-40 transition-opacity rounded-full -z-10 ${
                topic.sentiment === "positive"
                  ? "bg-emerald-500/20"
                  : topic.sentiment === "negative"
                    ? "bg-red-500/20"
                    : "bg-white/10"
              }`}
            />

            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="font-black text-sm uppercase tracking-tight italic group-hover/node:text-white transition-colors">
                  {topic.keyword}
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-40 leading-none">
                    Capture_Density:
                  </span>
                  <span className="text-[9px] font-black tracking-widest leading-none">
                    {topic.count}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1 ml-2">
                {topic.sentiment === "positive" && (
                  <ThumbsUp className="w-4 h-4 text-emerald-500 group-hover/node:scale-125 transition-transform" />
                )}
                {topic.sentiment === "negative" && (
                  <ThumbsDown className="w-4 h-4 text-red-500 group-hover/node:scale-125 transition-transform" />
                )}
                {topic.sentiment === "neutral" && (
                  <Activity className="w-4 h-4 text-white/20 group-hover/node:scale-125 transition-transform" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 flex items-center justify-between opacity-10 relative z-10 pointer-events-none">
        <div className="flex items-center gap-2">
          <BrainCircuit size={14} className="text-[var(--gold-primary)]" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white">
            Semantic_Graph_Nodes
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[var(--gold-primary)]" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white">
            Clusters_Identified
          </span>
        </div>
      </div>
    </div>
  );
}
