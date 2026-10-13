"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Crown,
  TrendingDown,
  TrendingUp,
  Search,
  ExternalLink,
  ShieldAlert,
  Calendar,
  CheckCircle2,
  Info,
  Maximize2,
  Minimize2,
  Eye,
  Building2,
  DollarSign,
  ChevronRight,
  MessageSquare,
  Flame,
  ArrowUpRight,
  Layers,
  Play
} from "lucide-react";
import { GuideHotspot } from "./guideData";

interface AnnotatedScreenMockupProps {
  screenType: "dashboard-grid" | "hotel-modal" | "rate-calendar" | "sentiment-radar" | "copilot-panel" | "parity-monitor";
  caption?: string;
  hotspots: GuideHotspot[];
  onWatchVideo?: () => void;
}

export default function AnnotatedScreenMockup({
  screenType,
  caption,
  hotspots,
  onWatchVideo,
}: AnnotatedScreenMockupProps) {
  const [activePin, setActivePin] = useState<GuideHotspot | null>(hotspots[0] || null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("Offers");

  return (
    <div className="bg-[#091528]/90 border border-[var(--glass-border)] rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
      {/* Top Header Bar of the Mockup */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 pb-3 sm:pb-4 border-b border-[var(--glass-border)]/50 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500/80 inline-block shadow-sm" />
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-500/80 inline-block shadow-sm" />
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500/80 inline-block shadow-sm" />
          </div>
          <span className="text-[10px] sm:text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider pl-2 border-l border-[var(--glass-border)]/40 truncate">
            Blueprint • {screenType.replace("-", " ").toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onWatchVideo && (
            <button
              onClick={onWatchVideo}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/30 text-[10px] sm:text-xs font-bold transition-all shadow-sm"
              title="Watch animated video demo for this screen"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Watch Video Demo</span>
            </button>
          )}
          <span className="text-[10px] sm:text-xs text-[var(--soft-gold)] font-medium flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-[var(--soft-gold)]/10 rounded-full border border-[var(--soft-gold)]/20">
            <Sparkles className="w-3 h-3 animate-pulse shrink-0" />
            <span className="hidden xs:inline">Click pins (①, ②, ③) to inspect</span>
            <span className="xs:hidden">Click pins</span>
          </span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[var(--text-muted)] hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            title={isExpanded ? "Collapse view" : "Expand view"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Screen Frame Container with Hotspots */}
      <div
        className={`relative w-full rounded-2xl border border-[var(--glass-border)]/40 overflow-hidden bg-[#060D1A] transition-all duration-300 ${
          isExpanded ? "min-h-[580px]" : "min-h-[440px]"
        }`}
      >
        {/* Render simulated UI based on screenType */}
        <div className="p-3 sm:p-4 md:p-6 select-none opacity-95 overflow-x-auto">
          {screenType === "dashboard-grid" && <DashboardGridSimulation />}
          {screenType === "hotel-modal" && (
            <HotelModalSimulation activeTab={activeTab} setActiveTab={setActiveTab} />
          )}
          {screenType === "rate-calendar" && <RateCalendarSimulation />}
          {screenType === "sentiment-radar" && <SentimentRadarSimulation />}
          {screenType === "copilot-panel" && <CopilotPanelSimulation />}
          {screenType === "parity-monitor" && <ParityMonitorSimulation />}
        </div>

        {/* Hotspot Pins Layer */}
        {hotspots.map((hs) => {
          const isSelected = activePin?.id === hs.id;
          return (
            <div
              key={hs.id}
              style={{
                left: `${hs.xPercent}%`,
                top: `${hs.yPercent}%`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-30"
            >
              <button
                onClick={() => setActivePin(hs)}
                onMouseEnter={() => setActivePin(hs)}
                className={`relative flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full font-bold text-[10px] sm:text-xs transition-all duration-300 shadow-xl ${
                  isSelected
                    ? "bg-[var(--soft-gold)] text-black ring-4 ring-[var(--soft-gold)]/40 scale-125 z-40"
                    : "bg-blue-600 text-white hover:bg-blue-500 hover:scale-110"
                }`}
              >
                {/* Pulsing ring animation */}
                <span
                  className={`absolute inset-0 rounded-full animate-ping opacity-60 ${
                    isSelected ? "bg-[var(--soft-gold)]" : "bg-blue-500"
                  }`}
                />
                <span className="relative z-10">{hs.pinNumber}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Active Pin Detailed Callout Drawer */}
      <AnimatePresence mode="wait">
        {activePin && (
          <motion.div
            key={activePin.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-[var(--glass-bg)] to-[#0c1f38] border border-[var(--soft-gold)]/30 shadow-lg relative"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-[var(--soft-gold)]/20 text-[var(--soft-gold)] flex items-center justify-center font-bold text-sm shrink-0 border border-[var(--soft-gold)]/40">
                  {activePin.pinNumber}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--soft-gold)] bg-[var(--soft-gold)]/10 px-2.5 py-0.5 rounded-full border border-[var(--soft-gold)]/20">
                      {activePin.label}
                    </span>
                    <h4 className="text-base font-bold text-[var(--text-primary)]">
                      {activePin.title}
                    </h4>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {activePin.description}
                  </p>
                  {activePin.actionRequired && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>
                        <strong>Action Tip:</strong> {activePin.actionRequired}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pin Selector Strip */}
      <div className="mt-4 pt-4 border-t border-[var(--glass-border)]/40 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-[var(--text-muted)] font-medium">
          Hotspots on this screen:
        </span>
        <div className="flex flex-wrap gap-2">
          {hotspots.map((hs) => (
            <button
              key={hs.id}
              onClick={() => setActivePin(hs)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activePin?.id === hs.id
                  ? "bg-[var(--soft-gold)]/20 text-[var(--soft-gold)] border border-[var(--soft-gold)]/40"
                  : "bg-white/5 text-[var(--text-muted)] hover:text-white hover:bg-white/10 border border-transparent"
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px]">
                {hs.pinNumber}
              </span>
              <span>{hs.label}</span>
            </button>
          ))}
        </div>
      </div>

      {caption && (
        <p className="text-[11px] text-[var(--text-muted)] text-center mt-3 italic">
          {caption}
        </p>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// SIMULATED UI SCREENS (Realistic, high-fidelity mockups)
// -------------------------------------------------------------

function DashboardGridSimulation() {
  return (
    <div className="space-y-4 font-sans text-xs">
      {/* Top Bar Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#0f213d] p-3 rounded-xl border border-[var(--soft-gold)]/30">
          <span className="text-[10px] text-[var(--soft-gold)] font-bold uppercase tracking-wider block">
            Target Hotel Direct
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-white">$145</span>
            <span className="text-[10px] text-emerald-400 flex items-center">
              <TrendingUp className="w-3 h-3" /> +2.5%
            </span>
          </div>
          <span className="text-[10px] text-slate-400">Grand Bosphorus Luxury</span>
        </div>

        <div className="bg-[#0e1c33] p-3 rounded-xl border border-white/5">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            Market Average
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-white">$158</span>
            <span className="text-[10px] text-slate-400">across 8 rivals</span>
          </div>
          <span className="text-[10px] text-emerald-400">+$13 Direct Spread</span>
        </div>

        <div className="bg-[#1b152b] p-3 rounded-xl border border-red-500/20">
          <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider block">
            Undercutting OTAs
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-red-400">2 Channels</span>
            <span className="text-[10px] text-red-300">Active leak</span>
          </div>
          <span className="text-[10px] text-red-400/80">Agoda -$18 • Trip.com -$12</span>
        </div>

        <div className="bg-[#0e1c33] p-3 rounded-xl border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Quick Scan</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <button className="w-full bg-[var(--soft-gold)] text-black font-bold py-1.5 px-3 rounded-lg text-xs hover:opacity-90 flex items-center justify-center gap-1 mt-2">
            <Sparkles className="w-3.5 h-3.5" /> Scan All Live
          </button>
        </div>
      </div>

      {/* Hotel Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
        {/* Target Hotel Card */}
        <div className="bg-gradient-to-b from-[#132747] to-[#0d1d36] border-2 border-[var(--soft-gold)]/60 rounded-2xl p-4 shadow-lg relative">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-[var(--soft-gold)]/20 text-[var(--soft-gold)]">
                <Crown className="w-4 h-4" />
              </span>
              <div>
                <h5 className="font-bold text-sm text-white flex items-center gap-1.5">
                  Grand Bosphorus Luxury
                  <span className="text-[9px] bg-[var(--soft-gold)] text-black px-1.5 py-0.2 rounded font-black uppercase">
                    TARGET
                  </span>
                </h5>
                <p className="text-[10px] text-slate-400">Taksim, Istanbul • 5 Stars ★★★★★</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-black text-[var(--soft-gold)]">$145</span>
              <span className="block text-[9px] text-slate-400">per night</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-white/10 text-[10px]">
            <span className="text-slate-400">OTAs:</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
              Direct $145
            </span>
            <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-medium line-through">
              Agoda $127
            </span>
            <span className="px-2 py-0.5 rounded bg-white/5 text-slate-300 font-medium">
              Booking.com $148
            </span>
            <button className="ml-auto text-[10px] text-[var(--soft-gold)] font-bold hover:underline flex items-center gap-1">
              View 6-Tabs <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Competitor Card */}
        <div className="bg-[#0d1c33] border border-white/10 rounded-2xl p-4 shadow-md relative">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-white/5 text-slate-400">
                <Building2 className="w-4 h-4" />
              </span>
              <div>
                <h5 className="font-bold text-sm text-white">The Ritz Palace Taksim</h5>
                <p className="text-[10px] text-slate-400">0.4 km away • 5 Stars ★★★★★</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-black text-white">$172</span>
              <span className="block text-[9px] text-emerald-400">+$27 vs Target</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-white/10 text-[10px]">
            <span className="text-slate-400">Pricing DNA:</span>
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold">
              Yield Seeker
            </span>
            <span className="text-slate-400">Velocity: Stable</span>
            <button className="ml-auto text-[10px] text-blue-400 font-bold hover:underline flex items-center gap-1">
              View Details <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HotelModalSimulation({
  activeTab,
  setActiveTab,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}) {
  const tabs = ["Overview", "Rooms", "Offers", "Reviews", "Amenities", "Gallery"];

  return (
    <div className="bg-[#0b172a] rounded-2xl border border-[var(--glass-border)] p-4 space-y-4 text-xs font-sans">
      {/* Modal Top Bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[var(--soft-gold)]" />
          <div>
            <h4 className="font-bold text-sm text-white">Grand Bosphorus Luxury Hotel</h4>
            <p className="text-[10px] text-slate-400">Forensic Room & OTA Inspection Console</p>
          </div>
        </div>
        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-bold text-[10px]">
          Live Parity Scan Active
        </span>
      </div>

      {/* 6 Tabs Navigation */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 border-b border-white/5">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab
                ? "bg-[var(--soft-gold)] text-black shadow-md"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content Display */}
      {activeTab === "Offers" && (
        <div className="space-y-2">
          <div className="text-[10px] text-slate-400 flex justify-between font-bold uppercase px-2">
            <span>OTA / Channel</span>
            <span>Room Designation</span>
            <span>Price (USD)</span>
            <span>Parity Status</span>
          </div>

          <div className="bg-emerald-950/20 border border-emerald-500/30 p-2.5 rounded-xl flex items-center justify-between">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-[var(--soft-gold)]" /> Official Direct Web
            </span>
            <span className="text-slate-300">Deluxe Bosphorus King</span>
            <span className="font-black text-white text-sm">$145</span>
            <span className="text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded text-[10px]">
              Direct Benchmark
            </span>
          </div>

          <div className="bg-red-950/30 border border-red-500/40 p-2.5 rounded-xl flex items-center justify-between">
            <span className="font-bold text-white">Agoda</span>
            <span className="text-slate-300">Deluxe King (Flash Deal)</span>
            <span className="font-black text-red-400 text-sm">$127</span>
            <span className="text-red-400 font-bold bg-red-500/20 px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Undercut by $18 (-12%)
            </span>
          </div>

          <div className="bg-white/5 border border-white/5 p-2.5 rounded-xl flex items-center justify-between">
            <span className="font-bold text-white">Booking.com</span>
            <span className="text-slate-300">Deluxe King w/ Breakfast</span>
            <span className="font-black text-white text-sm">$155</span>
            <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded text-[10px]">
              Compliant (+7%)
            </span>
          </div>
        </div>
      )}

      {activeTab !== "Offers" && (
        <div className="p-6 text-center text-slate-400 bg-white/5 rounded-xl">
          <p className="font-bold text-white text-sm mb-1">{activeTab} Tab View</p>
          <p className="text-xs">
            Displays normalized room-type mappings, high-res guest gallery, and Gemini review sentiment.
          </p>
        </div>
      )}
    </div>
  );
}

function RateCalendarSimulation() {
  const days = [
    { date: "Oct 12", target: "$145", market: "$150", status: "ok" },
    { date: "Oct 13", target: "$145", market: "$152", status: "ok" },
    { date: "Oct 14", target: "$165", market: "$185", status: "high-demand" },
    { date: "Oct 15", target: "$170", market: "$160", status: "undercut" },
    { date: "Oct 16", target: "$140", market: "$145", status: "ok" },
  ];

  return (
    <div className="space-y-3 font-sans text-xs">
      <div className="flex items-center justify-between">
        <span className="font-bold text-white flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-[var(--soft-gold)]" /> 30-Day Rate Forward Horizon
        </span>
        <span className="text-[10px] text-slate-400">Istanbul Submarket • Standard Double</span>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {days.map((d, i) => (
          <div
            key={i}
            className={`p-2.5 rounded-xl border text-center transition-all ${
              d.status === "undercut"
                ? "bg-red-950/30 border-red-500/50"
                : d.status === "high-demand"
                ? "bg-amber-950/30 border-amber-500/50"
                : "bg-white/5 border-white/10"
            }`}
          >
            <span className="text-[10px] text-slate-400 font-bold block">{d.date}</span>
            <span className="text-sm font-black text-white block my-1">{d.target}</span>
            <span className="text-[9px] text-slate-400 block">Avg: {d.market}</span>
            {d.status === "undercut" && (
              <span className="inline-block mt-1 text-[8px] font-bold bg-red-500 text-white px-1 rounded">
                Undercut
              </span>
            )}
            {d.status === "high-demand" && (
              <span className="inline-block mt-1 text-[8px] font-bold bg-amber-500 text-black px-1 rounded">
                Spike
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SentimentRadarSimulation() {
  return (
    <div className="space-y-3 font-sans text-xs">
      <div className="flex items-center justify-between">
        <span className="font-bold text-white flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[var(--soft-gold)]" /> AI Guest Sentiment Mining (Gemini)
        </span>
        <span className="text-emerald-400 font-bold">88% Positive Score</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
              <span>Cleanliness & Housekeeping</span>
              <span className="text-emerald-400 font-bold">96%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 w-[96%]" />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
              <span>Staff & Concierge</span>
              <span className="text-emerald-400 font-bold">92%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 w-[92%]" />
            </div>
          </div>
        </div>

        <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
          <span className="text-[10px] font-bold text-[var(--soft-gold)] uppercase tracking-wider block mb-1">
            Top Rival Weakness
          </span>
          <p className="text-[11px] text-slate-300">
            Competitor B has 34 complaints about street noise. Highlight your soundproof suites in
            ad copy!
          </p>
        </div>
      </div>
    </div>
  );
}

function CopilotPanelSimulation() {
  return (
    <div className="space-y-3 font-sans text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <span className="font-bold text-white flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[var(--soft-gold)]" /> Copilot Market Intelligence
        </span>
        <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-mono">
          Gemini 3.1 Pro
        </span>
      </div>

      <div className="space-y-2">
        <div className="bg-blue-600/20 text-blue-200 p-2.5 rounded-xl ml-6 border border-blue-500/30">
          <p className="text-[11px]">Why did The Ritz Palace drop rates by 15% next weekend?</p>
        </div>

        <div className="bg-white/5 p-3 rounded-xl mr-4 border border-white/10 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--soft-gold)]" />
            <span className="font-bold text-white text-[11px]">Pricing DNA Analysis</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Ritz Palace operates as a <strong>Volume Leader</strong> during shoulder seasons. Their
            occupancy forecast dropped below 60%, prompting an aggressive automated markdown.
          </p>
          <div className="bg-[var(--soft-gold)]/10 p-2 rounded-lg border border-[var(--soft-gold)]/20 text-[10px] text-[var(--soft-gold)] font-medium">
            Recommendation: Do NOT match. Your direct bookings for weekend dates remain stable at
            78% occupancy.
          </div>
        </div>
      </div>
    </div>
  );
}

function ParityMonitorSimulation() {
  return (
    <div className="space-y-3 font-sans text-xs">
      <div className="flex items-center justify-between">
        <span className="font-bold text-white flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-red-400" /> Active Rate Parity Leaks
        </span>
        <span className="text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded text-[10px]">
          2 Breaches Detected
        </span>
      </div>

      <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-xl space-y-2">
        <div className="flex justify-between items-center">
          <span className="font-bold text-white">Agoda VIP Flash Promotion</span>
          <span className="font-black text-red-400 text-sm">$127 vs Direct $145</span>
        </div>
        <p className="text-[10px] text-slate-300">
          Agoda is displaying an unauthorized -12% discount code on mobile user agents.
        </p>
        <div className="flex gap-2 pt-1">
          <button className="bg-red-500 text-white font-bold px-2 py-1 rounded text-[10px] hover:opacity-90">
            Export Evidence Packet
          </button>
          <button className="bg-white/5 text-slate-300 font-medium px-2 py-1 rounded text-[10px] hover:bg-white/10">
            Verify Live OTA Link
          </button>
        </div>
      </div>
    </div>
  );
}
