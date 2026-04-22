"use client";

import React, { useRef } from "react";
import { useMarketEvents, MarketEvent } from "@/hooks/useMarketEvents";
import { format, parseISO } from "date-fns";
import { CalendarDays, MapPin, ChevronLeft, ChevronRight, Loader2, AlertTriangle } from "lucide-react";

export function GlobalEventCalendar() {
  const { events, loading, error } = useMarketEvents(); // No city param = global
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -400, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 400, behavior: "smooth" });
    }
  };

  if (loading) {
    return (
      <div className="card-blur rounded-[2rem] p-8 border border-[var(--overlay-border)] flex flex-col items-center justify-center min-h-[250px] bg-gradient-to-r from-[#0A1629]/50 to-[#050B18]/50">
        <Loader2 className="w-8 h-8 text-[#F6C344] animate-spin mb-4" />
        <p className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest animate-pulse">
          Loading Global Market Calendar...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-blur rounded-[2rem] p-8 border border-rose-500/20 flex flex-col items-center justify-center min-h-[250px] bg-rose-500/5">
        <AlertTriangle className="w-8 h-8 text-rose-500 mb-4" />
        <p className="text-sm font-bold text-rose-400 uppercase tracking-widest">
          Failed to load calendar data
        </p>
        <p className="text-xs text-rose-500/70 mt-2">{error}</p>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="card-blur rounded-[2rem] p-8 border border-[var(--overlay-border)] flex flex-col items-center justify-center min-h-[250px] bg-gradient-to-r from-[#0A1629]/50 to-[#050B18]/50">
        <CalendarDays className="w-8 h-8 text-slate-600 mb-4" />
        <p className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest">
          No Upcoming Events Detected
        </p>
      </div>
    );
  }

  // Group events by month
  const groupedEvents: { [month: string]: MarketEvent[] } = {};
  events.forEach((event) => {
    const monthKey = format(parseISO(event.start_date), "MMMM yyyy");
    if (!groupedEvents[monthKey]) {
      groupedEvents[monthKey] = [];
    }
    groupedEvents[monthKey].push(event);
  });

  return (
    <div className="card-blur rounded-[2.5rem] p-8 bg-gradient-to-br from-[#0A1629]/80 to-[#050B18] border border-[var(--overlay-border)] shadow-2xl relative overflow-hidden group">
      {/* Background Accent */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#F6C344]/5 rounded-full blur-3xl -z-10 transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

      <div className="flex items-center justify-between mb-8 relative z-10">
        <div>
          <h2 className="text-xl font-black text-[var(--overlay-text)] uppercase tracking-widest flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#F6C344]/10 border border-[#F6C344]/20 shadow-[0_0_15px_rgba(246,195,68,0.1)]">
                <CalendarDays className="w-5 h-5 text-[#F6C344]" />
            </div>
            Global Market Calendar
          </h2>
          <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-[0.2em] font-bold flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Live Market Feed • Cross-City Intelligence
          </p>
        </div>
        
        {/* Navigation Controls */}
        <div className="flex items-center gap-2">
          <button 
            onClick={scrollLeft}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[var(--overlay-text)] transition-all border border-[var(--overlay-border)] hover:border-white/20 active:scale-95"
            aria-label="Scroll Left"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button 
            onClick={scrollRight}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[var(--overlay-text)] transition-all border border-[var(--overlay-border)] hover:border-white/20 active:scale-95"
            aria-label="Scroll Right"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Compact Monthly Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6 relative z-10 max-h-[600px] overflow-y-auto pr-2 scrollbar-custom">
        {Object.entries(groupedEvents).map(([month, monthEvents]) => (
          <div key={month} className="flex flex-col bg-white/[0.02] rounded-2xl p-4 border border-[var(--overlay-border)]">
            <h3 className="text-[11px] font-black text-[#F6C344] uppercase tracking-[0.2em] mb-4 flex items-center justify-between">
              <span>{month}</span>
              <span className="text-[9px] text-slate-500 font-bold">{monthEvents.length} Events</span>
            </h3>
            
            <div className="space-y-2">
              {monthEvents.map((event, idx) => {
                const isFair = event.type === 'fair';
                const accentColor = isFair ? "#A855F7" : "#F97316";
                
                const startDateStr = format(parseISO(event.start_date), "MMM d");
                const endDateStr = event.end_date ? format(parseISO(event.end_date), "MMM d") : null;
                const dateDisplay = endDateStr && startDateStr !== endDateStr 
                  ? `${startDateStr}-${endDateStr}`
                  : startDateStr;

                return (
                  <div 
                    key={event.id || idx} 
                    className="group/item p-2.5 rounded-xl bg-[#050B18]/40 hover:bg-[#050B18]/60 border border-[var(--overlay-border)] hover:border-[var(--overlay-border)] transition-all duration-200"
                  >
                    <div className="flex items-start gap-3">
                      {/* Date Indicator Block */}
                      <div className="flex flex-col items-center justify-center min-w-[40px] py-1 rounded-lg bg-white/5 border border-[var(--overlay-border)]">
                        <span className="text-[10px] font-black text-[var(--overlay-text)] leading-none">
                            {format(parseISO(event.start_date), "dd")}
                        </span>
                        <span className="text-[7px] font-bold text-slate-500 uppercase">
                            {format(parseISO(event.start_date), "MMM")}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span 
                                className="w-1.5 h-1.5 rounded-full" 
                                style={{ backgroundColor: accentColor }}
                            />
                            <h4 className="font-bold text-[var(--overlay-text)] text-[11px] leading-tight truncate group-hover/item:text-[#F6C344] transition-colors">
                                {event.name}
                            </h4>
                        </div>
                        
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-[9px] text-slate-500 font-medium">
                                <MapPin className="w-2.5 h-2.5" />
                                <span className="truncate max-w-[80px]">{event.city}</span>
                            </div>
                            
                            {event.intensity_score && (
                                <div className="flex gap-0.5 items-center">
                                    <div 
                                        className="h-1 rounded-full overflow-hidden bg-white/5 w-8"
                                    >
                                        <div 
                                            className="h-full transition-all duration-500"
                                            style={{ 
                                                width: `${(event.intensity_score / 10) * 100}%`,
                                                backgroundColor: accentColor
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
