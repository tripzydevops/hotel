"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Play,
  Pause,
  Clock,
  Sparkles,
  CheckCircle2,
  ListVideo,
  Volume2,
  VolumeX,
  Maximize2,
  Forward,
  RotateCcw
} from "lucide-react";
import { GuideArticle, VideoChapter } from "./guideData";

interface GuideVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: GuideArticle;
}

export default function GuideVideoModal({
  isOpen,
  onClose,
  article,
}: GuideVideoModalProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentChapter = article.video.chapters[activeChapterIndex] || article.video.chapters[0];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/85 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="bg-[#0A1629] border border-[var(--glass-border)] rounded-2xl sm:rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-[#07101E]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--soft-gold)]/20 text-[var(--soft-gold)] flex items-center justify-center">
                <ListVideo className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  {article.video.title}
                  <span className="text-[10px] bg-[var(--soft-gold)]/20 text-[var(--soft-gold)] px-2 py-0.5 rounded-full font-mono">
                    {article.video.duration}
                  </span>
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Video Masterclass • {article.title}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Video Player Display Container */}
          <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden group">
            {article.video.embedUrl ? (
              <iframe
                src={article.video.embedUrl}
                title={article.video.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              // Interactive Simulated Video Experience
              <div className="relative w-full h-full flex flex-col justify-between p-6 bg-gradient-to-br from-[#0c203b] via-[#081324] to-[#040810]">
                {/* Background ambient animation */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(212,175,55,0.12),transparent_70%)] pointer-events-none" />

                <div className="flex items-center justify-between relative z-10">
                  <span className="px-3 py-1 rounded-full bg-black/60 border border-white/10 text-xs font-mono text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    Chapter {activeChapterIndex + 1}: {currentChapter?.title}
                  </span>
                  <span className="text-xs font-mono text-[var(--soft-gold)]">
                    {currentChapter?.time}
                  </span>
                </div>

                {/* Central Play/Chapter Info Graphic */}
                <div className="text-center relative z-10 max-w-lg mx-auto py-4">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-16 h-16 rounded-full bg-[var(--soft-gold)] text-black flex items-center justify-center mx-auto mb-4 hover:scale-110 transition-all shadow-[0_0_30px_rgba(212,175,55,0.4)]"
                  >
                    {isPlaying ? (
                      <Pause className="w-7 h-7 fill-current" />
                    ) : (
                      <Play className="w-7 h-7 fill-current ml-1" />
                    )}
                  </button>
                  <h4 className="text-xl font-bold text-white mb-2">
                    {currentChapter?.title}
                  </h4>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {currentChapter?.description}
                  </p>
                </div>

                {/* Video Controls Bar */}
                <div className="relative z-10 bg-black/60 backdrop-blur-md rounded-2xl p-3 border border-white/10 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="text-white hover:text-[var(--soft-gold)] transition-colors"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() =>
                        setActiveChapterIndex(
                          (prev) => (prev + 1) % article.video.chapters.length
                        )
                      }
                      className="text-slate-400 hover:text-white transition-colors"
                      title="Next Chapter"
                    >
                      <Forward className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Progress Bar with Chapter Markers */}
                  <div className="flex-1 relative flex items-center mx-2">
                    <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden relative">
                      <div
                        className="bg-[var(--soft-gold)] h-full transition-all duration-300"
                        style={{
                          width: `${((activeChapterIndex + 1) / article.video.chapters.length) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Speed Controls */}
                  <div className="flex items-center gap-2">
                    {[1, 1.25, 1.5].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setPlaybackSpeed(speed)}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded transition-all ${
                          playbackSpeed === speed
                            ? "bg-[var(--soft-gold)] text-black font-bold"
                            : "text-slate-400 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chapters & Key Takeaways Drawer */}
          <div className="p-6 bg-[#07101E] border-t border-white/10 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Chapters list */}
              <div>
                <h5 className="text-xs font-bold text-[var(--soft-gold)] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> Video Chapters
                </h5>
                <div className="space-y-1.5">
                  {article.video.chapters.map((ch, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveChapterIndex(idx)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-all ${
                        activeChapterIndex === idx
                          ? "bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] border border-[var(--soft-gold)]/30 font-bold"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-slate-500">{ch.time}</span>
                        <span>{ch.title}</span>
                      </span>
                      {activeChapterIndex === idx && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--soft-gold)]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Key Takeaways */}
              <div>
                <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Key Takeaways
                </h5>
                <ul className="space-y-2">
                  {article.video.keyTakeaways.map((point, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
