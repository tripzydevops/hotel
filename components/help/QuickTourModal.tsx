"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  LayoutGrid,
  Eye,
  Calendar,
  ShieldAlert,
  Crown,
  CheckCircle2,
  ExternalLink
} from "lucide-react";

interface QuickTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGuide?: (guideId: string) => void;
}

const TOUR_SLIDES = [
  {
    step: 1,
    title: "1. The Target Hotel Benchmark",
    subtitle: "Your hotel direct rate is the sovereign anchor of rate parity",
    guideId: "getting-started",
    icon: Crown,
    iconColor: "text-[var(--soft-gold)]",
    badge: "Architecture Core",
    content:
      "On HotelPlus, your hotel is marked with a gold crown as the Target Property. All undercut alerts, price variances, and parity penalties are calculated in real-time against this benchmark rate.",
    proTip: "Make sure your direct website URL and official rates are configured so undercutting OTAs are immediately detected.",
  },
  {
    step: 2,
    title: "2. Google Hotels Live Price Grid",
    subtitle: "Catching rogue OTAs and tracking competitor pricing velocity",
    guideId: "dashboard-grid",
    icon: LayoutGrid,
    iconColor: "text-blue-400",
    badge: "Daily Monitoring",
    content:
      "The Live Dashboard displays your hotel alongside your competitor basket. Red badges highlight OTAs selling rooms below your direct rate. Click 'Quick Scan' to trigger an immediate live crawl through our DataForSEO pipeline.",
    proTip: "A quick scan updates all live rates in under 15 seconds across Google Hotels, Booking.com, and Expedia.",
  },
  {
    step: 3,
    title: "3. 6-Tab Deep Forensic Inspection",
    subtitle: "Audit room tiers, OTA offers, sentiment, and amenities",
    guideId: "hotel-inspection",
    icon: Eye,
    iconColor: "text-emerald-400",
    badge: "Forensics",
    content:
      "Clicking 'View Details' on any hotel reveals the 6-tab modal. Compare side-by-side OTA offers, normalized room catalogs (Deluxe vs Deluxe), AI review sentiment themes, and amenity sets.",
    proTip: "Sort the 'Offers' tab to isolate which specific intermediary is leaking unauthorized promotions.",
  },
  {
    step: 4,
    title: "4. 30-Day Rate Calendar & AI Discovery",
    subtitle: "Forward rate heatmaps and vector semantic rival matchmaking",
    guideId: "rate-calendar",
    icon: Calendar,
    iconColor: "text-purple-400",
    badge: "Yield & Strategy",
    content:
      "The Rate Calendar plots forward rates across 30 days to catch demand spikes. Meanwhile, the Discovery Engine uses pgvector & Gemini embeddings to discover non-obvious rival hotels based on guest personas.",
    proTip: "Vector discovery finds hotels competing for your exact guest segment, not just nearby hotels.",
  },
  {
    step: 5,
    title: "5. Autonomous Copilot (Gemini 3.1 Pro)",
    subtitle: "Conversational revenue reasoning with zero hallucinations",
    guideId: "copilot-ai",
    icon: Sparkles,
    iconColor: "text-[var(--soft-gold)]",
    badge: "Next-Gen AI",
    content:
      "Ask questions in natural language: 'Why did Competitor A drop rates by 15%?' The Copilot analyzes competitor Pricing DNA (Volume Leader vs Yield Seeker) and recommends tactical rate adjustments.",
    proTip: "Click prompt chips inside the Copilot drawer for instant morning market digests.",
  },
];

export default function QuickTourModal({
  isOpen,
  onClose,
  onSelectGuide,
}: QuickTourModalProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);

  if (!isOpen) return null;

  const currentSlide = TOUR_SLIDES[currentSlideIndex];
  const IconComponent = currentSlide.icon;

  const handleNext = () => {
    if (currentSlideIndex < TOUR_SLIDES.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="bg-[#0A1629] border border-[var(--soft-gold)]/30 rounded-2xl sm:rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
        >
          {/* Top Progress bar */}
          <div className="h-1 bg-white/10 w-full overflow-hidden">
            <motion.div
              className="h-full bg-[var(--soft-gold)]"
              animate={{
                width: `${((currentSlideIndex + 1) / TOUR_SLIDES.length) * 100}%`,
              }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Modal Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 pt-3.5 sm:pt-5 pb-2 sm:pb-3">
            <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-[var(--soft-gold)] bg-[var(--soft-gold)]/10 px-2.5 sm:px-3 py-1 rounded-full border border-[var(--soft-gold)]/20">
              Onboarding • Step {currentSlideIndex + 1} of {TOUR_SLIDES.length}
            </span>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Slide Content */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide.step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center ${currentSlide.iconColor}`}
                  >
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                      {currentSlide.badge}
                    </span>
                    <h3 className="text-xl font-black text-white">{currentSlide.title}</h3>
                  </div>
                </div>

                <p className="text-sm font-semibold text-[var(--soft-gold)]">
                  {currentSlide.subtitle}
                </p>

                <p className="text-sm text-slate-300 leading-relaxed">
                  {currentSlide.content}
                </p>

                {/* Pro Tip Box */}
                <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-300 leading-relaxed">
                    <strong>Pro Tip:</strong> {currentSlide.proTip}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer Controls */}
          <div className="px-6 py-4 bg-[#07101E] border-t border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={currentSlideIndex === 0}
                className="p-2 rounded-xl text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-white/5 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex gap-1.5">
                {TOUR_SLIDES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSlideIndex(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      currentSlideIndex === i
                        ? "bg-[var(--soft-gold)] w-6"
                        : "bg-white/20 hover:bg-white/40"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onSelectGuide && (
                <button
                  onClick={() => {
                    onSelectGuide(currentSlide.guideId);
                    onClose();
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-[var(--soft-gold)] hover:bg-[var(--soft-gold)]/10 transition-colors flex items-center gap-1"
                >
                  Read Full Guide <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={handleNext}
                className="px-5 py-2 rounded-xl bg-[var(--soft-gold)] text-black font-bold text-xs hover:opacity-90 transition-opacity flex items-center gap-1 shadow-lg"
              >
                {currentSlideIndex === TOUR_SLIDES.length - 1 ? "Finish Tour" : "Next Step"}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
