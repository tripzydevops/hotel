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
      <div className="card-blur rounded-[2rem] p-8 border border-white/5 flex flex-col items-center justify-center min-h-[250px] bg-gradient-to-r from-[#0A1629]/50 to-[#050B18]/50">
        <Loader2 className="w-8 h-8 text-[#F6C344] animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">
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
      <div className="card-blur rounded-[2rem] p-8 border border-white/5 flex flex-col items-center justify-center min-h-[250px] bg-gradient-to-r from-[#0A1629]/50 to-[#050B18]/50">
        <CalendarDays className="w-8 h-8 text-slate-600 mb-4" />
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
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
    <div className="card-blur rounded-[2.5rem] p-8 bg-gradient-to-br from-[#0A1629]/80 to-[#050B18] border border-white/5 shadow-2xl relative overflow-hidden group">
      {/* Background Accent */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#F6C344]/5 rounded-full blur-3xl -z-10 transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

      <div className="flex items-center justify-between mb-8 relative z-10">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
            <CalendarDays className="w-6 h-6 text-[#F6C344]" />
            Global Market Calendar
          </h2>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">
            All Tracked Cities • Upcoming Events
          </p>
        </div>
        
        {/* Navigation Controls */}
        <div className="flex items-center gap-2">
          <button 
            onClick={scrollLeft}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all border border-white/5 hover:border-white/20 active:scale-95"
            aria-label="Scroll Left"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button 
            onClick={scrollRight}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all border border-white/5 hover:border-white/20 active:scale-95"
            aria-label="Scroll Right"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Horizontal Scrolling Timeline */}
      <div 
        ref={scrollContainerRef}
        className="flex gap-8 overflow-x-auto pb-6 scrollbar-hide snap-x relative z-10"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {Object.entries(groupedEvents).map(([month, monthEvents], monthIdx) => (
          <div key={month} className="flex-shrink-0 min-w-[320px] max-w-[400px] snap-start">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] mb-4 sticky left-0">
              {month}
            </h3>
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
              {monthEvents.map((event, idx) => {
                const isFair = event.type === 'fair';
                const typeColor = isFair ? "text-[#A855F7]" : "text-[#F97316]";
                const typeBg = isFair ? "bg-[#A855F7]/10" : "bg-[#F97316]/10";
                const typeBorder = isFair ? "border-[#A855F7]/30" : "border-[#F97316]/30";
                
                const startDateStr = format(parseISO(event.start_date), "MMM d");
                const endDateStr = event.end_date ? format(parseISO(event.end_date), "MMM d") : null;
                const dateDisplay = endDateStr && startDateStr !== endDateStr 
                  ? `${startDateStr} - ${endDateStr}`
                  : startDateStr;

                return (
                  <div key={event.id || idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group/item is-active">
                    {/* Timeline Node */}
                    <div className={`flex items-center justify-center w-5 h-5 rounded-full border-4 border-[#050B18] ${isFair ? 'bg-[#A855F7]' : 'bg-[#F97316]'} shadow shrink-0 md:order-1 md:group-odd/item:-ml-2.5 md:group-even/item:-mr-2.5 z-10`} />
                    
                    {/* Event Card */}
                    <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)]">
                      <div className={`p-4 rounded-2xl bg-[#050B18]/80 backdrop-blur border shadow-xl transition-all hover:-translate-y-1 ${typeBorder}`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className={`${typeBg} ${typeColor} text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border ${typeBorder}`}>
                            {event.type}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded">
                            {dateDisplay}
                          </span>
                        </div>
                        
                        <h4 className="font-bold text-white text-sm tracking-tight mb-2 line-clamp-2">
                          {event.name}
                        </h4>
                        
                        {event.venue && (
                          <p className="text-xs text-slate-400 mb-3 line-clamp-1 italic">
                            {event.venue}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between pt-3 border-t border-white/5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                            <MapPin className="w-3.5 h-3.5 text-slate-500" />
                            {event.city}
                          </div>
                          
                          {event.intensity_score && (
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-slate-500 uppercase font-black">Impact:</span>
                              <div className="flex">
                                {[...Array(3)].map((_, i) => (
                                  <div 
                                    key={i} 
                                    className={`w-1.5 h-3 ml-0.5 rounded-sm ${i < Math.ceil((event.intensity_score || 0) / 3.3) ? typeColor.replace('text-', 'bg-') : 'bg-white/10'}`}
                                  />
                                ))}
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
        {/* Spacer for final scroll padding */}
        <div className="flex-shrink-0 w-8"></div>
      </div>
    </div>
  );
}
