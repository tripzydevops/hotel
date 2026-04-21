"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Terminal, Activity, ChevronRight } from "lucide-react";

interface StreamingNarrativeProps {
  text: string;
  isStreaming: boolean;
}

export default function StreamingNarrative({ text, isStreaming }: StreamingNarrativeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightedText, setHighlightedText] = useState<string>("");

  // Process text to add highlights for known entities (numbers, percentages, specific hotel names if known)
  useEffect(() => {
    const processText = (raw: string) => {
      // Bold numbers, percentages, and currencies
      return raw.replace(/(\d+%|\d+\s?TL|\d+\$|ARI|ADR|Sentiment Index)/gi, (match) => {
        return `<span class="text-[var(--soft-gold)] font-black">${match}</span>`;
      });
    };
    setHighlightedText(processText(text));
  }, [text]);

  // Auto-scroll to bottom of the narrative container
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [highlightedText]);

  return (
    <div className="command-card min-h-[300px] flex flex-col relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--soft-gold)]/5 to-transparent pointer-events-none" />
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-[var(--soft-gold)]/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/5 relative z-10 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] ${isStreaming ? "animate-pulse" : ""}`}>
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Autonomous Advisor</h3>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isStreaming ? "bg-[var(--optimal-green)] animate-pulse" : "bg-[var(--text-muted)]"}`} />
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
                {isStreaming ? "Processing Real-time Vector Data" : "Analysis Complete"}
              </span>
            </div>
          </div>
        </div>
        
        {isStreaming && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--optimal-green)]/10 border border-[var(--optimal-green)]/20">
            <Activity className="w-3 h-3 text-[var(--optimal-green)] animate-bounce" />
            <span className="text-[9px] font-black text-[var(--optimal-green)] uppercase tracking-widest">LIVE STREAM</span>
          </div>
        )}
      </div>

      {/* Narrative Body */}
      <div 
        ref={containerRef}
        className="flex-1 p-6 overflow-y-auto scrollbar-hide relative z-10"
      >
        <div className="font-mono text-sm leading-relaxed text-white/80 space-y-4">
          <div 
            className="whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: highlightedText }}
          />
          
          {isStreaming && (
            <motion.span
              animate={{ opacity: [0, 1, 0] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="inline-block w-2.5 h-4 bg-[var(--soft-gold)] ml-1 align-middle"
            />
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 border-t border-white/5 bg-white/[0.01] relative z-10 flex items-center justify-between">
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
            <Terminal className="w-3 h-3" />
            GPT-4o Matrix Output
          </div>
        </div>
        
        {!isStreaming && text && (
          <button className="flex items-center gap-2 text-[10px] font-black text-[var(--soft-gold)] uppercase tracking-widest hover:text-white transition-colors group">
            Apply Recommendations
            <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </button>
        )}
      </div>
    </div>
  );
}
