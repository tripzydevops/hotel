"use client";

import { MessageSquare, ThumbsUp, ThumbsDown } from "lucide-react";

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
    <div className="glass-panel-premium p-6 rounded-2xl relative overflow-hidden group">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-[var(--soft-gold)]" />
          Sentiment Clusters
        </h3>
        <span className="text-xs font-mono text-[var(--soft-gold)] border border-[var(--soft-gold)]/20 rounded px-2 py-1">
          Last 30 Days
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        {mockTopics.map((topic, i) => (
          <div
            key={i}
            className={`
              px-4 py-2 rounded-xl border backdrop-blur-md transition-all cursor-pointer hover:scale-105 active:scale-95
              ${
                topic.sentiment === "positive"
                  ? "bg-optimal-green/10 border-optimal-green/20 text-optimal-green hover:bg-optimal-green/20"
                  : topic.sentiment === "negative"
                    ? "bg-alert-red/10 border-alert-red/20 text-alert-red hover:bg-alert-red/20"
                    : "bg-white/5 border-white/10 text-[var(--text-secondary)] hover:bg-white/10"
              }
            `}
          >
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">{topic.keyword}</span>
              <span className="text-xs opacity-60">({topic.count})</span>
              {topic.sentiment === "positive" && (
                <ThumbsUp className="w-3 h-3" />
              )}
              {topic.sentiment === "negative" && (
                <ThumbsDown className="w-3 h-3" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Decorative background blur */}
      <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-[var(--soft-gold)]/5 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
}
