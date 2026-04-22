"use client";

import React from "react";
import { X, Clock, TrendingUp, TrendingDown, Minus, Building2, Calendar } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface IntradayStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: any[] | null;
  hotelName: string;
}

export default function IntradayStoryModal({
  isOpen,
  onClose,
  events,
  hotelName,
}: IntradayStoryModalProps) {
  const { t } = useI18n();
  if (!events || events.length === 0) return null;

  // Sort events by time with safety check
  const sortedEvents = [...(events || [])].sort(
    (a, b) => {
      const dateA = a.recorded_at ? new Date(a.recorded_at).getTime() : 0;
      const dateB = b.recorded_at ? new Date(b.recorded_at).getTime() : 0;
      return dateA - dateB;
    }
  );

  const firstEvent = sortedEvents[0] || { price: 0 };
  const lastEvent = sortedEvents[sortedEvents.length - 1] || { price: 0 };
  const priceDiff = (lastEvent.price || 0) - (firstEvent.price || 0);
  const isUp = priceDiff > 0;
  const isDown = priceDiff < 0;

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-4 transition-all duration-500 ${
        isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
      }`}
    >
      <div
        className="absolute inset-0 bg-[var(--deep-ocean)]/80 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl glass-modal border border-[var(--glass-border)] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 bg-[var(--deep-ocean)]">
        <header className="p-8 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] relative">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-xl border border-[var(--glass-border)] hover:bg-white/5 transition-colors group"
          >
            <X className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--overlay-text)]" />
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 flex items-center justify-center shadow-lg shadow-[var(--soft-gold-glow)]/5">
              <Clock className="w-7 h-7 text-[var(--soft-gold)]" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-[var(--overlay-text)] tracking-tight uppercase leading-none italic">
                {t("intradayStory.modalTitle")}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-black text-[var(--soft-gold)] uppercase tracking-[.2em] opacity-80">
                  Rate Evolution Timeline
                </span>
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--soft-gold)] animate-pulse" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--glass-border)] shadow-inner">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1.5 flex items-center gap-2">
                <Building2 className="w-3 h-3" />
                Target Entity
              </span>
              <span className="text-lg font-black text-[var(--overlay-text)] tracking-tight italic truncate max-w-[250px]">{hotelName}</span>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1.5">Movement</span>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${
                  isUp ? "bg-red-500/10 border-red-500/20 text-red-400" : 
                  isDown ? "bg-green-500/10 border-green-500/20 text-green-400" :
                  "bg-white/5 border-[var(--overlay-border)] text-[var(--text-muted)]"
                }`}>
                  {isUp ? <TrendingUp className="w-3 h-3" /> : isDown ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                  <span className="text-xs font-black uppercase tracking-wider">
                    {isUp ? "Increase" : isDown ? "Decrease" : "Stable"}
                  </span>
                </div>
              </div>

              <div className="w-[1px] h-10 bg-[var(--glass-border)]" />

              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1.5 text-right w-full">Net Change</span>
                <span className={`text-xl font-black tracking-tight ${isUp ? "text-red-400" : isDown ? "text-green-400" : "text-[var(--overlay-text)]"}`}>
                  {isUp ? "+" : ""}{priceDiff.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[var(--deep-ocean)]">
          <div className="relative pl-8 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-[var(--soft-gold)]/40 before:to-transparent">
            {sortedEvents.map((event, index) => {
              const previousPrice = index > 0 ? sortedEvents[index - 1].price : null;
              const diff = previousPrice ? event.price - previousPrice : 0;
              const evIsUp = diff > 0;
              const evIsDown = diff < 0;

              return (
                <div key={index} className="relative group/step">
                  {/* Timeline Node */}
                  <div className={`absolute -left-[26px] top-1.5 w-4 h-4 rounded-full border-4 border-[var(--deep-ocean)] z-10 transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)] ${
                    index === 0 ? "bg-[var(--soft-gold)]" : "bg-[var(--glass-border-accent)]"
                  } group-hover/step:scale-125 group-hover/step:ring-4 group-hover/step:ring-[var(--soft-gold)]/10`} />

                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-black text-[var(--soft-gold)] tracking-wide">
                          {new Date(event.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                        {event.vendor && (
                          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-[var(--overlay-border)] text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                            {event.vendor}
                          </span>
                        )}
                        {event.label && (
                          <span className="px-2 py-0.5 rounded-md bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 text-[9px] font-black text-[var(--soft-gold)] uppercase tracking-widest">
                            {(() => {
                              const rawLabel = event.label || "";
                              if (rawLabel.toLowerCase() === "force scan") return "Live Check";
                              if (rawLabel.toLowerCase() === "price scan") return "Automated Check";
                              return t(`intradayStory.labels.${rawLabel}`, { defaultValue: rawLabel.replace(/_/g, " ") });
                            })()}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <span className="text-3xl font-black text-[var(--overlay-text)] tracking-tighter">
                          {event.price ? event.price.toLocaleString() : "—"}
                        </span>
                        
                        {index > 0 && diff !== 0 && (
                          <div className={`flex items-center gap-1 font-black text-[10px] uppercase tracking-wider px-2 py-1 rounded-lg border shadow-sm ${
                            evIsUp ? "text-red-400 border-red-500/20 bg-red-500/5" : "text-green-400 border-green-500/20 bg-green-500/5"
                          }`}>
                            {evIsUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {evIsUp ? "+" : ""}{diff.toLocaleString()}
                          </div>
                        )}
                      </div>

                      {event.narrative && (
                        <p className="mt-3 text-sm font-medium text-[var(--text-secondary)] leading-relaxed max-w-lg italic border-l-2 border-[var(--soft-gold)]/20 pl-4 py-1 bg-white/5 rounded-r-lg">
                          “{event.narrative}”
                        </p>
                      )}
                    </div>

                    {index === 0 && (
                      <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[.25em] rotate-180 [writing-mode:vertical-lr] opacity-40">
                        Initial Capture
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <footer className="p-8 border-t border-[var(--glass-border)] bg-[var(--glass-bg)] bg-gradient-to-t from-[var(--glass-bg)] to-transparent">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[.2em] text-[var(--text-muted)] opacity-60">
            <div className="flex items-center gap-2">
              <Calendar className="w-3 h-3" />
              <span>Session Log</span>
            </div>
            <span>Auto-Generated Report</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
