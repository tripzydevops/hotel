"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Rewind,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Sparkles,
  CheckCircle2,
  Clock,
  ListVideo,
  MonitorPlay,
  Film,
  Radio,
  ExternalLink,
  ShieldAlert,
  Calendar,
  TrendingUp,
  TrendingDown,
  Eye,
  Layers,
  Crown,
  Search,
  MessageSquare
} from "lucide-react";
import { GuideArticle, VideoChapter } from "./guideData";
import { useI18n } from "@/lib/i18n";

interface GuideVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: GuideArticle;
}

// Helper to convert MM:SS string to total seconds
function timeStringToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":").map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

// Helper to format seconds as MM:SS
function secondsToTimeString(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function GuideVideoModal({
  isOpen,
  onClose,
  article,
}: GuideVideoModalProps) {
  const { locale } = useI18n();
  const isTr = locale === "tr";

  const totalDurationSec = useMemo(() => {
    return timeStringToSeconds(article.video.duration) || 135;
  }, [article.video.duration]);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isNarrationVoiceActive, setIsNarrationVoiceActive] = useState<boolean>(false);
  const [playerMode, setPlayerMode] = useState<"screencast" | "stream">("screencast");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Dynamic interactive simulation state
  const [simActiveTab, setSimActiveTab] = useState<string>("Offers");
  const [isScanningSim, setIsScanningSim] = useState<boolean>(false);
  const [simCopilotAnswer, setSimCopilotAnswer] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Chapters with parsed start timestamps
  const chaptersWithTime = useMemo(() => {
    return article.video.chapters.map((ch, idx, arr) => {
      const startSec = timeStringToSeconds(ch.time);
      const nextCh = arr[idx + 1];
      const endSec = nextCh ? timeStringToSeconds(nextCh.time) : totalDurationSec;
      return {
        ...ch,
        index: idx,
        startSec,
        endSec,
      };
    });
  }, [article.video.chapters, totalDurationSec]);

  // Determine current active chapter based on currentTimeSec
  const currentChapter = useMemo(() => {
    const found = chaptersWithTime.find(
      (ch) => currentTimeSec >= ch.startSec && currentTimeSec < ch.endSec
    );
    return found || chaptersWithTime[0] || {
      title: article.video.title,
      time: "00:00",
      description: article.summary,
      startSec: 0,
      endSec: totalDurationSec,
      index: 0,
    };
  }, [chaptersWithTime, currentTimeSec, article.video.title, article.summary, totalDurationSec]);

  // Timer loop for video playback
  useEffect(() => {
    if (!isOpen || !isPlaying || playerMode !== "screencast") return;

    const interval = setInterval(() => {
      setCurrentTimeSec((prev) => {
        const next = prev + 0.25 * playbackSpeed;
        if (next >= totalDurationSec) {
          setIsPlaying(false);
          return totalDurationSec;
        }
        return next;
      });
    }, 250);

    return () => clearInterval(interval);
  }, [isOpen, isPlaying, playbackSpeed, totalDurationSec, playerMode]);

  // Reset playback on article change or modal open
  useEffect(() => {
    if (isOpen) {
      setCurrentTimeSec(0);
      setIsPlaying(true);
      setSimActiveTab("Offers");
      setIsScanningSim(false);
      setSimCopilotAnswer(false);
    }
  }, [isOpen, article.id]);

  // Dynamic interactive state transitions based on chapter progression
  useEffect(() => {
    const chapterIdx = currentChapter.index;

    // Trigger tab changes in hotel-modal
    if (article.screenMockup.screenType === "hotel-modal") {
      if (chapterIdx === 0) setSimActiveTab("Overview");
      else if (chapterIdx === 1) setSimActiveTab("Rooms");
      else if (chapterIdx === 2) setSimActiveTab("Offers");
      else if (chapterIdx >= 3) setSimActiveTab("Reviews");
    }

    // Trigger scan animation in dashboard-grid
    if (article.screenMockup.screenType === "dashboard-grid") {
      if (chapterIdx === 3) {
        setIsScanningSim(true);
      } else {
        setIsScanningSim(false);
      }
    }

    // Trigger Copilot dynamic typing
    if (article.screenMockup.screenType === "copilot-panel") {
      if (chapterIdx >= 2) {
        setSimCopilotAnswer(true);
      } else {
        setSimCopilotAnswer(false);
      }
    }
  }, [currentChapter.index, article.screenMockup.screenType]);

  // Optional Voice Narration using Web Speech API
  useEffect(() => {
    if (!isOpen || !isNarrationVoiceActive || isMuted || typeof window === "undefined" || !("speechSynthesis" in window)) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      return;
    }

    if (isPlaying && currentChapter.description) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(
        `${currentChapter.title}. ${currentChapter.description}`
      );
      utterance.lang = isTr ? "tr-TR" : "en-US";
      utterance.rate = Math.min(1.2, Math.max(0.9, playbackSpeed));
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } else {
      window.speechSynthesis.cancel();
    }

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [currentChapter.index, isPlaying, isNarrationVoiceActive, isMuted, playbackSpeed, isOpen]);

  // Handle seeking to a specific chapter
  const handleSeekToChapter = (chapterStartSec: number) => {
    setCurrentTimeSec(chapterStartSec);
    setIsPlaying(true);
  };

  // Skip -5s / +5s
  const handleSkip = (secondsDelta: number) => {
    setCurrentTimeSec((prev) => {
      const next = Math.max(0, Math.min(totalDurationSec, prev + secondsDelta));
      return next;
    });
  };

  // Scrubber click handler
  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    setCurrentTimeSec(ratio * totalDurationSec);
  };

  if (!isOpen) return null;

  // Virtual animated cursor position calculation based on chapter progress
  const chapterProgress =
    currentChapter.endSec > currentChapter.startSec
      ? (currentTimeSec - currentChapter.startSec) /
        (currentChapter.endSec - currentChapter.startSec)
      : 0;

  // Target coordinates for cursor based on screenType and chapter
  const getCursorCoordinates = () => {
    const st = article.screenMockup.screenType;
    const idx = currentChapter.index;

    if (st === "dashboard-grid") {
      if (idx === 0) return { x: 26, y: 32 }; // Target hotel card
      if (idx === 1) return { x: 70, y: 32 }; // Market avg / Undercut card
      if (idx === 2) return { x: 30, y: 65 }; // Parity badge on card
      return { x: 88, y: 15 }; // Quick Scan button
    }
    if (st === "hotel-modal") {
      if (idx === 0) return { x: 20, y: 18 }; // Tab 1
      if (idx === 1) return { x: 36, y: 18 }; // Tab 2 Rooms
      if (idx === 2) return { x: 50, y: 48 }; // Tab 3 Offers table
      return { x: 68, y: 18 }; // Tab 4 Reviews
    }
    if (st === "rate-calendar") {
      if (idx === 0) return { x: 30, y: 22 };
      if (idx === 1) return { x: 50, y: 50 };
      if (idx === 2) return { x: 70, y: 50 };
      return { x: 85, y: 22 };
    }
    if (st === "copilot-panel") {
      if (idx <= 1) return { x: 50, y: 86 }; // Typing prompt
      return { x: 45, y: 45 }; // AI response card
    }
    if (st === "parity-monitor") {
      if (idx <= 1) return { x: 35, y: 40 };
      return { x: 40, y: 75 }; // Export evidence packet
    }
    return { x: 45, y: 40 };
  };

  const cursorTarget = getCursorCoordinates();
  // Animate cursor moving gently during chapter
  const cursorX = cursorTarget.x + Math.sin(chapterProgress * Math.PI * 2) * 2;
  const cursorY = cursorTarget.y + Math.cos(chapterProgress * Math.PI * 2) * 2;
  const isClicking = chapterProgress > 0.4 && chapterProgress < 0.55;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/90 backdrop-blur-2xl">
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className={`bg-[#071120] border border-[var(--glass-border)] rounded-2xl sm:rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col transition-all ${
            isFullscreen ? "fixed inset-0 max-w-none rounded-none z-50 h-full" : "max-h-[94vh]"
          }`}
        >
          {/* Top Modal Navigation Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-3.5 border-b border-white/10 bg-[#050C17]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--soft-gold)]/20 text-[var(--soft-gold)] flex items-center justify-center shrink-0">
                <ListVideo className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span className="truncate max-w-[280px] sm:max-w-md">{article.video.title}</span>
                  <span className="text-[10px] bg-[var(--soft-gold)]/20 text-[var(--soft-gold)] px-2 py-0.5 rounded-full font-mono shrink-0">
                    {article.video.duration}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  {isTr ? "Özellik Video Anlatımı" : "Feature Walkthrough Video"} • {article.title}
                </p>
              </div>
            </div>

            {/* Video Mode Selector & Close */}
            <div className="flex items-center gap-2">
              <div className="bg-white/5 p-1 rounded-xl border border-white/10 flex items-center gap-1">
                <button
                  onClick={() => setPlayerMode("screencast")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    playerMode === "screencast"
                      ? "bg-[var(--soft-gold)] text-black font-bold shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title={isTr ? "İnteraktif animasyonlu yazılım anlatımı" : "Interactive animated software walkthrough"}
                >
                  <MonitorPlay className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">
                    {isTr ? "İnteraktif Demo" : "Interactive Demo"}
                  </span>
                </button>
                <button
                  onClick={() => setPlayerMode("stream")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    playerMode === "stream"
                      ? "bg-blue-600 text-white font-bold shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title={isTr ? "Video akışı eğitimi" : "Video stream tutorial"}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">
                    {isTr ? "Video Akışı" : "Video Stream"}
                  </span>
                </button>
              </div>

              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors ml-1"
                title="Close Video"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* MAIN VIDEO PLAYER CANVAS */}
          <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden group select-none">
            {playerMode === "stream" ? (
              // STREAM / EMBED MODE
              <div className="relative w-full h-full bg-black flex items-center justify-center">
                {article.video.embedUrl ? (
                  article.video.embedUrl.endsWith(".mp4") ||
                  article.video.embedUrl.endsWith(".webm") ? (
                    <video
                      src={article.video.embedUrl}
                      controls
                      autoPlay
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <iframe
                      src={
                        article.video.embedUrl.includes("?")
                          ? `${article.video.embedUrl}&autoplay=1`
                          : `${article.video.embedUrl}?autoplay=1&rel=0`
                      }
                      title={article.video.title}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  )
                ) : (
                  <div className="text-center p-8 max-w-md space-y-4">
                    <div className="w-16 h-16 rounded-3xl bg-blue-600/20 text-blue-400 flex items-center justify-center mx-auto border border-blue-500/30">
                      <Film className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-white mb-1">
                        {isTr ? "Yüksek Çözünürlüklü Video Akışı" : "High-Definition Video Stream"}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {isTr
                          ? "Bu özelliğin gerçek zamanlı tanıtımını izleyin. İmleç hareketlerini ve sekme geçişlerini görmek için interaktif demoya geçin."
                          : "Watch this feature demonstrated in real-time. Switch to our interactive animated screencast to see cursor actions and tab walkthroughs."}
                      </p>
                    </div>
                    <button
                      onClick={() => setPlayerMode("screencast")}
                      className="px-4 py-2 rounded-xl bg-[var(--soft-gold)] text-black font-bold text-xs hover:opacity-90 transition-opacity"
                    >
                      {isTr
                        ? "İnteraktif Demo Anlatımına Geç"
                        : "Switch to Interactive Screencast Walkthrough"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // INTERACTIVE SCREENCAST VIDEO SIMULATOR MODE
              <div className="relative w-full h-full flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#071324] via-[#050D18] to-[#02050B]">
                {/* Ambient dynamic radial glow */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(212,175,55,0.08),transparent_70%)] pointer-events-none" />

                {/* Top Video Overlay Ribbon */}
                <div className="relative z-20 flex items-center justify-between p-3 sm:p-4 bg-gradient-to-b from-black/80 to-transparent">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-black/60 border border-white/10 text-[11px] font-mono text-white flex items-center gap-2 backdrop-blur-md">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isPlaying ? "bg-red-500 animate-pulse" : "bg-slate-500"
                        }`}
                      />
                      <span>
                        Ch {currentChapter.index + 1}/{chaptersWithTime.length}:{" "}
                        <strong className="text-[var(--soft-gold)]">{currentChapter.title}</strong>
                      </span>
                    </span>
                  </div>

                  {/* Narration Equalizer & Timestamp */}
                  <div className="flex items-center gap-3">
                    {/* Live Voiceover Waveform Animation */}
                    <div
                      className="flex items-center gap-0.5 px-2.5 py-1 rounded-full bg-black/50 border border-white/10"
                      title={isPlaying ? "Voiceover narration active" : "Narration paused"}
                    >
                      {[0.4, 0.8, 0.5, 0.9, 0.3, 0.7, 0.5].map((h, i) => (
                        <motion.span
                          key={i}
                          animate={
                            isPlaying
                              ? {
                                  height: ["4px", `${Math.round(h * 16)}px`, "4px"],
                                }
                              : { height: "4px" }
                          }
                          transition={{
                            duration: 0.5 + i * 0.1,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                          className="w-0.5 bg-[var(--soft-gold)] rounded-full inline-block"
                        />
                      ))}
                      <span className="text-[10px] text-slate-300 font-mono ml-1.5 hidden sm:inline">
                        {isTr ? "Seslendirme" : "Voiceover"}
                      </span>
                    </div>

                    <span className="text-xs font-mono font-bold text-white bg-black/60 px-2.5 py-1 rounded-full border border-white/10 backdrop-blur-md">
                      {secondsToTimeString(currentTimeSec)} / {secondsToTimeString(totalDurationSec)}
                    </span>
                  </div>
                </div>

                {/* Simulated Software Canvas with Animated Screencast */}
                <div className="relative z-10 flex-1 px-4 sm:px-8 py-2 overflow-hidden flex items-center justify-center">
                  <div className="w-full max-w-3xl transform scale-95 sm:scale-100 transition-transform">
                    {article.screenMockup.screenType === "dashboard-grid" && (
                      <DashboardGridVideoScene isScanning={isScanningSim} />
                    )}
                    {article.screenMockup.screenType === "hotel-modal" && (
                      <HotelModalVideoScene
                        activeTab={simActiveTab}
                        setActiveTab={setSimActiveTab}
                      />
                    )}
                    {article.screenMockup.screenType === "rate-calendar" && (
                      <RateCalendarVideoScene activeIndex={currentChapter.index} />
                    )}
                    {article.screenMockup.screenType === "sentiment-radar" && (
                      <SentimentRadarVideoScene activeIndex={currentChapter.index} />
                    )}
                    {article.screenMockup.screenType === "copilot-panel" && (
                      <CopilotVideoScene showAnswer={simCopilotAnswer} />
                    )}
                    {article.screenMockup.screenType === "parity-monitor" && (
                      <ParityMonitorVideoScene activeIndex={currentChapter.index} />
                    )}
                  </div>

                  {/* VIRTUAL ANIMATED MOUSE CURSOR */}
                  <motion.div
                    animate={{
                      left: `${cursorX}%`,
                      top: `${cursorY}%`,
                    }}
                    transition={{
                      type: "spring",
                      damping: 24,
                      stiffness: 120,
                    }}
                    className="absolute z-30 pointer-events-none transform -translate-x-1 -translate-y-1"
                  >
                    <div className="relative">
                      {/* Cursor pointer SVG */}
                      <svg
                        className={`w-6 h-6 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] transition-transform ${
                          isClicking ? "scale-90" : "scale-100"
                        }`}
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M4.5 3L10.5 21L13.5 13.5L21 10.5L4.5 3Z"
                          fill="#D4AF37"
                          stroke="#000000"
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                        />
                      </svg>

                      {/* Click shockwave ripple ring */}
                      {isClicking && (
                        <motion.span
                          initial={{ scale: 0.5, opacity: 1 }}
                          animate={{ scale: 2.2, opacity: 0 }}
                          transition={{ duration: 0.4 }}
                          className="absolute -top-1 -left-1 w-8 h-8 rounded-full border-2 border-[var(--soft-gold)] pointer-events-none"
                        />
                      )}

                      {/* Cursor user badge */}
                      <span className="absolute left-4 top-4 bg-[var(--soft-gold)] text-black text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow">
                        {isTr ? "Sunucu" : "Presenter"}
                      </span>
                    </div>
                  </motion.div>
                </div>

                {/* Subtitle / Closed Caption Bar */}
                <div className="relative z-20 px-4 sm:px-8 py-2 text-center">
                  <div className="inline-block max-w-2xl px-4 py-2 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 text-xs sm:text-sm text-slate-200 leading-relaxed shadow-lg">
                    <span className="text-[var(--soft-gold)] font-bold mr-1.5">
                      [{currentChapter.time}]
                    </span>
                    {currentChapter.description}
                  </div>
                </div>

                {/* Video Controls Bottom Bar */}
                <div className="relative z-20 bg-gradient-to-t from-black via-black/90 to-transparent p-3 sm:p-4 space-y-2">
                  {/* Timeline Scrubber Bar with Chapter Ticks */}
                  <div
                    onClick={handleScrubberClick}
                    className="relative w-full h-2 bg-white/20 hover:h-3 rounded-full overflow-hidden cursor-pointer group/scrub transition-all"
                  >
                    {/* Chapter markers */}
                    {chaptersWithTime.map((ch, idx) => {
                      const posPercent = (ch.startSec / totalDurationSec) * 100;
                      return (
                        <div
                          key={idx}
                          style={{ left: `${posPercent}%` }}
                          className="absolute top-0 bottom-0 w-0.5 bg-black/80 z-20 pointer-events-none"
                          title={ch.title}
                        />
                      );
                    })}

                    {/* Elapsed Progress Fill */}
                    <div
                      className="bg-gradient-to-r from-[var(--soft-gold)] via-[var(--soft-gold-bright)] to-[var(--soft-gold)] h-full transition-all duration-150 relative"
                      style={{
                        width: `${(currentTimeSec / totalDurationSec) * 100}%`,
                      }}
                    >
                      {/* Scrubber thumb */}
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md scale-0 group-hover/scrub:scale-100 transition-transform" />
                    </div>
                  </div>

                  {/* Playback Buttons & Utility Controls */}
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 sm:gap-3">
                      {/* Play / Pause */}
                      <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="w-8 h-8 rounded-xl bg-[var(--soft-gold)] text-black flex items-center justify-center hover:opacity-90 transition-all font-bold"
                        title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                      >
                        {isPlaying ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </button>

                      {/* Restart */}
                      <button
                        onClick={() => {
                          setCurrentTimeSec(0);
                          setIsPlaying(true);
                        }}
                        className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                        title="Restart from beginning"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>

                      {/* -5s / +5s */}
                      <button
                        onClick={() => handleSkip(-5)}
                        className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors hidden xs:block"
                        title="Rewind 5 seconds"
                      >
                        <Rewind className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleSkip(5)}
                        className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors hidden xs:block"
                        title="Forward 5 seconds"
                      >
                        <FastForward className="w-4 h-4" />
                      </button>

                      {/* Voice narration TTS Toggle */}
                      <button
                        onClick={() => setIsNarrationVoiceActive(!isNarrationVoiceActive)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                          isNarrationVoiceActive
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : "bg-white/5 text-slate-400 border-white/10 hover:text-white"
                        }`}
                        title="Read out narration captions with synthesized speech"
                      >
                        <Radio className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">
                          {isTr
                            ? `Seslendirme ${isNarrationVoiceActive ? "AÇIK" : "KAPALI"}`
                            : `Audio Voice ${isNarrationVoiceActive ? "ON" : "OFF"}`}
                        </span>
                      </button>

                      {/* Mute */}
                      <button
                        onClick={() => setIsMuted(!isMuted)}
                        className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                        title={isMuted ? "Unmute" : "Mute"}
                      >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Speed selector & Fullscreen */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg border border-white/10">
                        {[1, 1.25, 1.5].map((speed) => (
                          <button
                            key={speed}
                            onClick={() => setPlaybackSpeed(speed)}
                            className={`text-[10px] font-mono px-2 py-0.5 rounded transition-all ${
                              playbackSpeed === speed
                                ? "bg-[var(--soft-gold)] text-black font-bold"
                                : "text-slate-400 hover:text-white"
                            }`}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                      >
                        {isFullscreen ? (
                          <Minimize2 className="w-4 h-4" />
                        ) : (
                          <Maximize2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chapters & Key Takeaways Panel */}
          <div className="p-4 sm:p-6 bg-[#050C17] border-t border-white/10 overflow-y-auto max-h-[35vh]">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Chapters list (7 cols) */}
              <div className="md:col-span-7 space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-xs font-bold text-[var(--soft-gold)] uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />{" "}
                    {isTr ? "Video Bölümleri (Atlamak İçin Tıklayın)" : "Video Chapters (Click to Jump)"}
                  </h5>
                  <span className="text-[11px] text-slate-400">
                    {chaptersWithTime.length} {isTr ? "Bölüm" : "Chapters"}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {chaptersWithTime.map((ch) => {
                    const isActive = currentChapter.index === ch.index;
                    return (
                      <button
                        key={ch.index}
                        onClick={() => handleSeekToChapter(ch.startSec)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-all ${
                          isActive
                            ? "bg-[var(--soft-gold)]/15 text-[var(--soft-gold)] border border-[var(--soft-gold)]/40 font-bold shadow-sm"
                            : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                        }`}
                      >
                        <span className="flex items-center gap-2.5 truncate">
                          <span className="font-mono text-[11px] text-slate-500 bg-black/40 px-1.5 py-0.5 rounded">
                            {ch.time}
                          </span>
                          <span className="truncate">{ch.title}</span>
                        </span>
                        {isActive && (
                          <span className="w-2 h-2 rounded-full bg-[var(--soft-gold)] animate-pulse shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Key Takeaways (5 cols) */}
              <div className="md:col-span-5 space-y-2">
                <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {isTr ? "Temel Çıkarımlar" : "Key Takeaways"}
                </h5>
                <div className="space-y-2 bg-white/[0.02] p-3.5 rounded-2xl border border-white/5">
                  {article.video.keyTakeaways.map((point, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// -------------------------------------------------------------
// DYNAMIC VIDEO SIMULATION SCENES FOR EACH SCREEN TYPE
// -------------------------------------------------------------

function DashboardGridVideoScene({ isScanning }: { isScanning: boolean }) {
  return (
    <div className="space-y-3 font-sans text-xs bg-[#091526]/90 p-4 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl">
      {/* Top Bar Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-[#0f213d] p-3 rounded-xl border border-[var(--soft-gold)]/40 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-[var(--soft-gold)] font-bold uppercase tracking-wider">
              Target Property Direct
            </span>
            <Crown className="w-3.5 h-3.5 text-[var(--soft-gold)]" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-white">$145</span>
            <span className="text-[10px] text-emerald-400 flex items-center">
              <TrendingUp className="w-3 h-3" /> +2.5%
            </span>
          </div>
          <span className="text-[10px] text-slate-400 truncate block">Grand Bosphorus Luxury</span>
        </div>

        <div className="bg-[#0e1c33] p-3 rounded-xl border border-white/5">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
            Market Average
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-white">$158</span>
            <span className="text-[10px] text-slate-400">8 rivals</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-semibold">+$13 Direct Spread</span>
        </div>

        <div className="bg-[#1e1427] p-3 rounded-xl border border-red-500/30">
          <span className="text-[9px] text-red-400 font-bold uppercase tracking-wider block">
            Undercutting OTAs
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-red-400">2 Channels</span>
            <span className="text-[10px] text-red-300">Active leak</span>
          </div>
          <span className="text-[10px] text-red-400/80">Agoda -$18 • Trip -$12</span>
        </div>

        <div className="bg-[#0e1c33] p-3 rounded-xl border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-400 uppercase font-bold">Quick Scan</span>
            <span
              className={`w-2 h-2 rounded-full ${
                isScanning ? "bg-amber-400 animate-ping" : "bg-emerald-400"
              }`}
            />
          </div>
          <div className="text-[10px] text-slate-300 mt-1">
            {isScanning ? (
              <span className="text-amber-300 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 animate-spin" /> Scanning 9 OTAs...
              </span>
            ) : (
              <span>Last scanned: 4m ago</span>
            )}
          </div>
          <button className="mt-1 w-full py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold text-center">
            {isScanning ? "Job In Flight" : "Scan All Hotels"}
          </button>
        </div>
      </div>

      {/* Row of Simulated Hotel Tiles */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="p-3 rounded-xl bg-gradient-to-r from-[#0d1e37] to-[#0a182f] border border-[var(--soft-gold)]/30 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-white flex items-center gap-1.5">
              <Crown className="w-3 h-3 text-[var(--soft-gold)]" /> Grand Bosphorus Luxury
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">5-Star • Taksim, Istanbul</span>
          </div>
          <div className="text-right">
            <span className="text-base font-black text-white">$145</span>
            <span className="text-[9px] text-emerald-400 block">Best Direct</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#0a1628] border border-red-500/30 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-white flex items-center gap-1">
              Rival Palace Istanbul
            </span>
            <span className="text-[10px] text-red-400 font-semibold block mt-0.5">
              Undercutting by $18
            </span>
          </div>
          <div className="text-right">
            <span className="text-base font-black text-red-400">$127</span>
            <span className="text-[9px] text-slate-400 block">Agoda Deal</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HotelModalVideoScene({
  activeTab,
  setActiveTab,
}: {
  activeTab: string;
  setActiveTab: (t: string) => void;
}) {
  const tabs = ["Overview", "Rooms", "Offers", "Reviews"];
  return (
    <div className="space-y-3 font-sans text-xs bg-[#091526]/90 p-4 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl">
      {/* Modal Top Nav Tabs */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white text-sm">Grand Bosphorus Luxury</span>
          <span className="text-[10px] bg-[var(--soft-gold)]/20 text-[var(--soft-gold)] px-2 py-0.5 rounded font-mono">
            Taksim Square
          </span>
        </div>
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                activeTab === tab
                  ? "bg-[var(--soft-gold)] text-black"
                  : "bg-white/5 text-slate-400 hover:text-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content Display */}
      {activeTab === "Offers" && (
        <div className="space-y-1.5">
          <div className="bg-white/5 p-2 rounded-lg flex items-center justify-between">
            <span className="font-bold text-white">Direct Website</span>
            <span className="text-slate-300">Deluxe King Room</span>
            <span className="font-black text-white">$145</span>
            <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded text-[10px]">
              Target Benchmark
            </span>
          </div>
          <div className="bg-red-950/20 border border-red-500/30 p-2 rounded-lg flex items-center justify-between">
            <span className="font-bold text-white">Agoda Private Promo</span>
            <span className="text-slate-300">Deluxe King Room</span>
            <span className="font-black text-red-400">$127</span>
            <span className="text-red-400 font-bold bg-red-500/20 px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Undercut -$18 (-12%)
            </span>
          </div>
        </div>
      )}

      {activeTab === "Reviews" && (
        <div className="p-3 bg-white/5 rounded-xl space-y-2">
          <div className="flex justify-between items-center text-[11px]">
            <span className="font-bold text-white">Cleanliness & Comfort</span>
            <span className="text-emerald-400 font-bold">96% Positive</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 w-[96%]" />
          </div>
          <p className="text-[10px] text-slate-300 italic pt-1">
            &ldquo;Exceptional rooftop breakfast and attentive concierge. Quiet bosphorus view suites.&rdquo;
          </p>
        </div>
      )}

      {activeTab === "Rooms" && (
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
            <span className="font-bold text-white block">Deluxe Sea View</span>
            <span className="text-slate-400 text-[10px]">35m² • King Bed • Balcony</span>
            <span className="font-black text-[var(--soft-gold)] block mt-1">$145 / night</span>
          </div>
          <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
            <span className="font-bold text-white block">Executive Presidential Suite</span>
            <span className="text-slate-400 text-[10px]">70m² • Panoramic Lounge</span>
            <span className="font-black text-[var(--soft-gold)] block mt-1">$320 / night</span>
          </div>
        </div>
      )}

      {activeTab === "Overview" && (
        <div className="p-3 bg-white/5 rounded-xl text-[11px] space-y-1">
          <p className="text-white font-bold">Grand Bosphorus Luxury Hotel Istanbul</p>
          <p className="text-slate-300 text-[10px]">
            Official GPS: 41.0369° N, 28.9850° E • 142 Keys • Star Rating: 5.0
          </p>
        </div>
      )}
    </div>
  );
}

function RateCalendarVideoScene({ activeIndex }: { activeIndex: number }) {
  const days = [
    { date: "Oct 12", target: "$145", market: "$150", status: "ok" },
    { date: "Oct 13", target: "$145", market: "$152", status: "ok" },
    { date: "Oct 14", target: "$165", market: "$185", status: "spike" },
    { date: "Oct 15", target: "$170", market: "$155", status: "undercut" },
    { date: "Oct 16", target: "$140", market: "$145", status: "ok" },
  ];

  return (
    <div className="space-y-3 font-sans text-xs bg-[#091526]/90 p-4 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between pb-1 border-b border-white/10">
        <span className="font-bold text-white flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-[var(--soft-gold)]" /> 30-Day Forward Rate Horizon
        </span>
        <span className="text-[10px] text-slate-400">Taksim Market • Standard Double</span>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {days.map((d, i) => (
          <div
            key={i}
            className={`p-2.5 rounded-xl border text-center transition-all ${
              d.status === "undercut"
                ? "bg-red-950/30 border-red-500/50"
                : d.status === "spike"
                ? "bg-amber-950/30 border-amber-500/50"
                : "bg-white/5 border-white/10"
            }`}
          >
            <span className="text-[9px] text-slate-400 font-bold block">{d.date}</span>
            <span className="text-sm font-black text-white block my-1">{d.target}</span>
            <span className="text-[9px] text-slate-400 block">Avg: {d.market}</span>
            {d.status === "undercut" && (
              <span className="inline-block mt-1 text-[8px] font-bold bg-red-500 text-white px-1 rounded">
                Undercut
              </span>
            )}
            {d.status === "spike" && (
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

function SentimentRadarVideoScene({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="space-y-3 font-sans text-xs bg-[#091526]/90 p-4 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between pb-1 border-b border-white/10">
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
          <span className="text-[9px] font-bold text-[var(--soft-gold)] uppercase tracking-wider block mb-1">
            Top Rival Weakness
          </span>
          <p className="text-[10px] text-slate-300">
            Competitor B has 34 complaints about street noise. Highlight soundproof suites in your direct marketing!
          </p>
        </div>
      </div>
    </div>
  );
}

function CopilotVideoScene({ showAnswer }: { showAnswer: boolean }) {
  return (
    <div className="space-y-3 font-sans text-xs bg-[#091526]/90 p-4 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl">
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
            occupancy forecast dropped below 60%, prompting an aggressive markdown.
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

function ParityMonitorVideoScene({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="space-y-3 font-sans text-xs bg-[#091526]/90 p-4 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between pb-1 border-b border-white/10">
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
          <button className="bg-red-500 text-white font-bold px-2 py-1 rounded text-[10px]">
            Export Evidence Packet
          </button>
          <button className="bg-white/5 text-slate-300 font-medium px-2 py-1 rounded text-[10px]">
            Verify Live OTA Link
          </button>
        </div>
      </div>
    </div>
  );
}
