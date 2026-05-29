"use client";

import React from "react";
import { format, parseISO } from "date-fns";
import { MarketEvent } from "@/hooks/useMarketEvents";
import { 
    Calendar, 
    Trophy, 
    Music, 
    Presentation, 
    Users, 
    Megaphone, 
    Award,
    ChevronRight,
    MapPin
} from "lucide-react";
import { motion } from "framer-motion";

interface CategorizedAgendaTimelineProps {
    city: string;
    events: MarketEvent[];
    loading?: boolean;
}

// Formatter helper for attendee counts
const formatAttendees = (count?: number): string => {
    if (!count || count <= 0) return "N/A";
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K`;
    return count.toString();
};

// Details for mapping event categories dynamically to high-fidelity badges
const getCategoryMetadata = (type: string) => {
    const t = type.toLowerCase().trim();
    if (t === "fair") {
        return {
            label: "Trade Fair",
            color: "bg-[#A855F7]/10 border-[#A855F7]/20 text-[#C084FC]",
            barColor: "bg-[#A855F7]",
            icon: Award
        };
    }
    if (t === "announcement") {
        return {
            label: "Tourism Announcement",
            color: "bg-[#F97316]/10 border-[#F97316]/20 text-[#FB923C]",
            barColor: "bg-[#F97316]",
            icon: Megaphone
        };
    }
    if (t.includes("sport") || t === "sports") {
        return {
            label: "Athletic Event",
            color: "bg-[#3B82F6]/10 border-[#3B82F6]/20 text-[#60A5FA]",
            barColor: "bg-[#3B82F6]",
            icon: Trophy
        };
    }
    if (t.includes("music") || t.includes("concert") || t === "festivals" || t === "performing-arts") {
        return {
            label: "Entertainment & Arts",
            color: "bg-[#10B981]/10 border-[#10B981]/20 text-[#34D399]",
            barColor: "bg-[#10B981]",
            icon: Music
        };
    }
    if (t.includes("conference") || t.includes("expo") || t === "public-holidays") {
        return {
            label: "Business Expo / Summit",
            color: "bg-[#D4AF37]/10 border-[#D4AF37]/20 text-[#F4CF62]",
            barColor: "bg-[#D4AF37]",
            icon: Presentation
        };
    }
    // Default fallback
    return {
        label: "General Event",
        color: "bg-slate-500/10 border-slate-500/20 text-slate-400",
        barColor: "bg-slate-500",
        icon: Calendar
    };
};

export const CategorizedAgendaTimeline: React.FC<CategorizedAgendaTimelineProps> = ({
    city,
    events,
    loading = false
}) => {
    // Filter and sort events to upcoming only
    const timelineEvents = React.useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return events
            .filter((e) => {
                const end = new Date(e.end_date || e.start_date);
                return end >= today;
            })
            .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
            .slice(0, 10); // Show next 10 events for clean timeline page footprint
    }, [events]);

    if (loading) {
        return (
            <div className="glass-card p-6 bg-[#0B1F3B]/40 border border-white/[0.08] rounded-3xl backdrop-blur-xl h-full flex flex-col items-center justify-center min-h-[300px]">
                <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">Aggregating stay agenda...</p>
            </div>
        );
    }

    // Container Framer Motion stagger
    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.08
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, x: -10 },
        show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 100 } }
    };

    return (
        <div className="glass-card p-6 bg-[#0B1F3B]/40 border border-white/[0.08] rounded-3xl backdrop-blur-xl h-full flex flex-col group">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-[var(--overlay-text)] flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-[#D4AF37]" />
                        Event Impact Agenda
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-black">
                        Upcoming demand compression timeline in {city}
                    </p>
                </div>
                <span className="text-[9px] text-[#D4AF37] font-black uppercase tracking-wider bg-[#D4AF37]/10 px-2 py-0.5 rounded border border-[#D4AF37]/20">
                    {timelineEvents.length} Active
                </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto pr-1 max-h-[480px] scrollbar-thin">
                {timelineEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[250px] text-center p-4">
                        <Calendar className="w-8 h-8 text-slate-600 mb-2 stroke-[1.5]" />
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">No active compression events</p>
                        <p className="text-[10px] text-slate-600 mt-1 max-w-[200px]">There are no upcoming High-Demand announcements or fairs recorded for {city}.</p>
                    </div>
                ) : (
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        className="relative pl-4 border-l border-white/[0.05] space-y-5"
                    >
                        {timelineEvents.map((evt, idx) => {
                            const meta = getCategoryMetadata(evt.type);
                            const IconComp = meta.icon;
                            
                            const startDate = parseISO(evt.start_date);
                            const day = format(startDate, "dd");
                            const month = format(startDate, "MMM");
                            
                            const intensity = (evt.intensity_score ?? evt.compression_score) || 3;
                            const compressionLevel = intensity >= 8 ? "CRITICAL" : intensity >= 5 ? "HIGH" : "MODERATE";
                            const compressionColor = intensity >= 8 ? "text-red-400" : intensity >= 5 ? "text-orange-400" : "text-blue-400";

                            return (
                                <motion.div
                                    key={evt.id || idx}
                                    variants={itemVariants}
                                    className="relative flex gap-4 group/item cursor-pointer"
                                >
                                    {/* Small circle node on line */}
                                    <div className={`absolute -left-[21px] top-4 w-2.5 h-2.5 rounded-full border-2 border-[#0B1F3B] ${meta.barColor} transition-transform group-hover/item:scale-125`} />

                                    {/* Date display block */}
                                    <div className="flex flex-col items-center justify-center min-w-[40px] h-[46px] rounded-xl bg-black/30 border border-white/5 shadow-inner">
                                        <span className="text-sm font-black text-white leading-none">{day}</span>
                                        <span className="text-[8px] font-black text-slate-500 uppercase mt-0.5">{month}</span>
                                    </div>

                                    {/* Event detail block */}
                                    <div className="flex-1 bg-white/[0.01] hover:bg-white/[0.03] border border-white/[0.03] hover:border-white/10 p-3.5 rounded-2xl transition-all duration-300 relative overflow-hidden flex flex-col gap-2">
                                        {/* Row 1: Badges */}
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border ${meta.color}`}>
                                                <IconComp className="w-2.5 h-2.5" />
                                                {meta.label}
                                            </span>
                                            
                                            <span className={`text-[8px] font-black uppercase tracking-widest ${compressionColor}`}>
                                                {compressionLevel} IMPACT
                                            </span>
                                        </div>

                                        {/* Row 2: Title */}
                                        <div>
                                            <h4 className="text-xs font-black text-white leading-tight group-hover/item:text-[#D4AF37] transition-colors line-clamp-1">
                                                {evt.name}
                                            </h4>
                                            
                                            {evt.venue && (
                                                <div className="flex items-center gap-1 text-[9px] text-slate-500 mt-1 font-bold">
                                                    <MapPin className="w-2.5 h-2.5" />
                                                    <span className="truncate max-w-[180px]">{evt.venue}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Row 3: Stats */}
                                        <div className="flex items-center justify-between pt-2 border-t border-white/[0.03]">
                                            <div className="flex items-center gap-3">
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] text-slate-500 uppercase leading-none font-bold">Attendance</span>
                                                    <span className="text-[10px] font-black text-slate-300 mt-0.5">{formatAttendees(evt.expected_attendees)}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] text-slate-500 uppercase leading-none font-bold">Impact Stance</span>
                                                    <span className="text-[10px] font-black text-slate-300 mt-0.5">{intensity} / 10</span>
                                                </div>
                                            </div>

                                            {/* Action hint indicator */}
                                            <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover/item:text-[#D4AF37] transition-all transform group-hover/item:translate-x-0.5" />
                                        </div>

                                        {/* Dynamic background progress bar tracking impact score */}
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5">
                                            <div 
                                                className={`h-full ${meta.barColor} transition-all duration-1000`} 
                                                style={{ width: `${(intensity / 10) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}
            </div>
        </div>
    );
};
