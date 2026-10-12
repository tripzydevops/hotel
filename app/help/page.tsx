"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass,
  LayoutGrid,
  Eye,
  Calendar,
  Radar,
  ShieldAlert,
  Sparkles,
  FileText,
  Shield,
  Search,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Play,
  CheckCircle2,
  HelpCircle,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  ArrowLeft,
  Share2,
  Check,
  Clock,
  Layers,
  ArrowUpRight,
  Video,
  ListOrdered
} from "lucide-react";
import {
  GUIDE_ARTICLES,
  GUIDE_CATEGORIES,
  GuideArticle,
} from "@/components/help/guideData";
import AnnotatedScreenMockup from "@/components/help/AnnotatedScreenMockup";
import GuideVideoModal from "@/components/help/GuideVideoModal";
import QuickTourModal from "@/components/help/QuickTourModal";
import HotelPlusLogo from "@/components/ui/HotelPlusLogo";

const ICON_MAP: Record<string, React.ElementType> = {
  Compass,
  LayoutGrid,
  Eye,
  Calendar,
  Radar,
  ShieldAlert,
  Sparkles,
  FileText,
  Shield,
};

export default function HelpAndGuidePage() {
  const [selectedArticleId, setSelectedArticleId] = useState<string>("getting-started");
  const [selectedCategory, setSelectedCategory] = useState<string>("All Guides");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isVideoModalOpen, setIsVideoModalOpen] = useState<boolean>(false);
  const [isTourModalOpen, setIsTourModalOpen] = useState<boolean>(false);
  const [isMobileDirectoryOpen, setIsMobileDirectoryOpen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [feedbackGiven, setFeedbackGiven] = useState<"helpful" | "not-helpful" | null>(null);

  // Filter articles based on category and search query
  const filteredArticles = useMemo(() => {
    return GUIDE_ARTICLES.filter((article) => {
      const matchesCategory =
        selectedCategory === "All Guides" || article.category === selectedCategory;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        article.title.toLowerCase().includes(q) ||
        article.subtitle.toLowerCase().includes(q) ||
        article.summary.toLowerCase().includes(q) ||
        article.category.toLowerCase().includes(q) ||
        article.deepDiveSections.some((sec) => sec.heading.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  // Active article object
  const activeArticle = useMemo(() => {
    return (
      GUIDE_ARTICLES.find((a) => a.id === selectedArticleId) ||
      filteredArticles[0] ||
      GUIDE_ARTICLES[0]
    );
  }, [selectedArticleId, filteredArticles]);

  // Current index for next/previous navigation
  const currentIndex = GUIDE_ARTICLES.findIndex((a) => a.id === activeArticle.id);
  const prevArticle = currentIndex > 0 ? GUIDE_ARTICLES[currentIndex - 1] : null;
  const nextArticle =
    currentIndex < GUIDE_ARTICLES.length - 1 ? GUIDE_ARTICLES[currentIndex + 1] : null;

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const ActiveIcon = ICON_MAP[activeArticle.iconName] || BookOpen;

  return (
    <div className="min-h-screen bg-[#040914] text-[var(--text-primary)] font-sans antialiased selection:bg-[var(--soft-gold)] selection:text-black">
      {/* Background Ambient Glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-[var(--soft-gold-glow)] blur-[140px] pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-10 w-96 h-96 bg-blue-600/10 blur-[160px] pointer-events-none -z-10" />

      {/* Top Universal Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#060E1C]/90 backdrop-blur-xl border-b border-[var(--glass-border)]/60 px-3 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-6">
            <Link
              href="/dashboard"
              className="group flex items-center gap-1.5 sm:gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="hidden xs:inline">Back to Dashboard</span>
              <span className="xs:hidden">Back</span>
            </Link>
            <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2 sm:gap-3">
              <HotelPlusLogo variant="navbar" />
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-[var(--soft-gold)] bg-[var(--soft-gold)]/10 px-2 sm:px-2.5 py-0.5 rounded-full border border-[var(--soft-gold)]/20 hidden sm:inline-block">
                Academy & User Guide
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsTourModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] border border-[var(--soft-gold)]/30 text-xs font-bold hover:bg-[var(--soft-gold)] hover:text-black transition-all shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>2-Min Tour</span>
            </button>
            <button
              onClick={() => setIsVideoModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Video ({activeArticle.video.duration})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner with Search */}
      <section className="border-b border-[var(--glass-border)]/40 bg-gradient-to-b from-[#071326] to-[#040914] px-6 py-12">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 text-xs text-[var(--soft-gold)] font-medium">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Official HotelPlus Knowledge Base & Operational Playbook</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            Everything You Need to Master <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-white via-[var(--soft-gold-bright)] to-[var(--soft-gold)] bg-clip-text text-transparent">
              Hotel Market Intelligence
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Explore step-by-step guides, interactive visual blueprints, video walkthroughs, and
            forensic rate parity workflows for all platform pages and features.
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto pt-4 relative">
            <div className="relative flex items-center">
              <Search className="w-5 h-5 absolute left-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search features, pages, rate parity, 6-tab modal, calendar, or copilot..."
                className="w-full bg-[#0a182f]/90 border border-[var(--glass-border)] rounded-2xl pl-12 pr-12 py-3.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[var(--soft-gold)] focus:ring-2 focus:ring-[var(--soft-gold)]/20 transition-all shadow-xl"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 text-xs text-slate-400 hover:text-white bg-white/10 px-2 py-0.5 rounded"
                >
                  Clear
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-xs text-slate-400 text-left mt-2 pl-2">
                Found {filteredArticles.length} guides matching &ldquo;{searchQuery}&rdquo;
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Category Filter Pills */}
      <div className="border-b border-[var(--glass-border)]/40 bg-[#050C18] px-6 py-3 sticky top-[73px] z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar">
          {GUIDE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? "bg-[var(--soft-gold)] text-black shadow-md shadow-[var(--soft-gold)]/20"
                  : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Guide Layout (Sidebar + Article Body) */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Navigation Column: Article Directory */}
          <aside className="lg:col-span-4 space-y-3 lg:sticky lg:top-[135px]">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <button
                onClick={() => setIsMobileDirectoryOpen(!isMobileDirectoryOpen)}
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors lg:pointer-events-none"
              >
                <span>Guide Directory ({filteredArticles.length})</span>
                <ChevronDown
                  className={`w-4 h-4 lg:hidden transition-transform ${
                    isMobileDirectoryOpen ? "rotate-180 text-[var(--soft-gold)]" : ""
                  }`}
                />
              </button>
              <span className="text-[11px] text-[var(--soft-gold)] font-medium">
                {selectedCategory}
              </span>
            </div>

            <div
              className={`space-y-2 lg:max-h-[calc(100vh-220px)] overflow-y-auto pr-1 ${
                isMobileDirectoryOpen ? "block" : "hidden lg:block"
              }`}
            >
              {filteredArticles.map((article) => {
                const isSelected = activeArticle.id === article.id;
                const ItemIcon = ICON_MAP[article.iconName] || BookOpen;

                return (
                  <button
                    key={article.id}
                    onClick={() => {
                      setSelectedArticleId(article.id);
                      setFeedbackGiven(null);
                      setIsMobileDirectoryOpen(false);
                    }}
                    className={`w-full text-left p-3.5 rounded-2xl transition-all border group relative ${
                      isSelected
                        ? "bg-gradient-to-r from-[#0d223f] to-[#09172c] border-[var(--soft-gold)]/40 shadow-lg"
                        : "bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          isSelected
                            ? "bg-[var(--soft-gold)] text-black"
                            : "bg-white/5 text-slate-400 group-hover:text-white"
                        }`}
                      >
                        <ItemIcon className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider ${
                              isSelected ? "text-[var(--soft-gold)]" : "text-slate-500"
                            }`}
                          >
                            {article.category}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {article.readTime}
                          </span>
                        </div>

                        <h4
                          className={`text-sm font-bold truncate leading-snug ${
                            isSelected ? "text-white" : "text-slate-300 group-hover:text-white"
                          }`}
                        >
                          {article.title}
                        </h4>

                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                          {article.subtitle}
                        </p>
                      </div>

                      <ChevronRight
                        className={`w-4 h-4 shrink-0 transition-transform ${
                          isSelected
                            ? "text-[var(--soft-gold)] translate-x-1"
                            : "text-slate-600 group-hover:text-slate-400"
                        }`}
                      />
                    </div>
                  </button>
                );
              })}

              {filteredArticles.length === 0 && (
                <div className="p-8 text-center bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-sm font-bold text-slate-300">No guides match your search</p>
                  <p className="text-xs text-slate-500 mt-1">Try clearing your filters or search term</p>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("All Guides");
                    }}
                    className="mt-3 text-xs text-[var(--soft-gold)] font-bold hover:underline"
                  >
                    Reset Search
                  </button>
                </div>
              )}
            </div>
          </aside>

          {/* Right Main Article Content View */}
          <div className="lg:col-span-8 space-y-8">
            {/* Article Top Hero Card */}
            <article className="bg-[#081427]/80 border border-[var(--glass-border)] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 backdrop-blur-xl shadow-xl space-y-6">
              {/* Meta row */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-[var(--soft-gold)] bg-[var(--soft-gold)]/10 px-3 py-1 rounded-full border border-[var(--soft-gold)]/20">
                    {activeArticle.category}
                  </span>
                  {activeArticle.badge && (
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                      {activeArticle.badge}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    {activeArticle.readTime}
                  </span>
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                    title="Copy Guide Link"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Title & Subtitle */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] border border-[var(--soft-gold)]/30 flex items-center justify-center shrink-0">
                    <ActiveIcon className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    {activeArticle.title}
                  </h2>
                </div>
                <p className="text-base text-slate-300 font-medium">
                  {activeArticle.subtitle}
                </p>
                <p className="text-sm text-slate-400 leading-relaxed pt-1">
                  {activeArticle.summary}
                </p>
              </div>

              {/* Quick Action Ribbon */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/30 to-[#0b1f3b] border border-blue-500/20 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/30 text-blue-400 flex items-center justify-center">
                    <Video className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">
                      Video Masterclass Included
                    </h5>
                    <p className="text-[11px] text-slate-400">
                      {activeArticle.video.title} ({activeArticle.video.duration})
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsVideoModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[var(--soft-gold)] text-black text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-md"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play Video Tour</span>
                </button>
              </div>

              {/* Key Objectives */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-[var(--soft-gold)] uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Learning Objectives
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {activeArticle.objectives.map((obj, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-2.5 text-xs text-slate-300"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--soft-gold)] mt-1.5 shrink-0" />
                      <span>{obj}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* INTERACTIVE VISUAL BLUEPRINT / SCREEN MOCKUP */}
              <div className="space-y-3 pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-400" /> Interactive Visual Blueprint
                  </h4>
                  <span className="text-[11px] text-slate-400">Click any hotspot pin below</span>
                </div>

                <AnnotatedScreenMockup
                  screenType={activeArticle.screenMockup.screenType}
                  caption={activeArticle.screenMockup.caption}
                  hotspots={activeArticle.screenMockup.hotspots}
                />
              </div>

              {/* STEP-BY-STEP PROCEDURES */}
              <div className="space-y-4 pt-6 border-t border-white/10">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <ListOrdered className="w-5 h-5 text-[var(--soft-gold)]" /> Step-by-Step Instructions
                </h4>

                <div className="space-y-4">
                  {activeArticle.steps.map((st) => (
                    <div
                      key={st.stepNumber}
                      className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2 hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-[var(--soft-gold)]/20 text-[var(--soft-gold)] text-xs font-bold flex items-center justify-center">
                          {st.stepNumber}
                        </span>
                        <h5 className="font-bold text-sm text-white">{st.title}</h5>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed pl-9">
                        {st.description}
                      </p>
                      {st.tip && (
                        <div className="ml-9 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-2">
                          <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                          <span>
                            <strong>Pro Tip:</strong> {st.tip}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* DEEP DIVE ARCHITECTURE SECTION */}
              {activeArticle.deepDiveSections.map((sec, i) => (
                <div
                  key={i}
                  className="p-6 rounded-2xl bg-[#071324] border border-[var(--glass-border)] space-y-3"
                >
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[var(--soft-gold)]" /> {sec.heading}
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">{sec.content}</p>
                  {sec.highlights && (
                    <ul className="space-y-1.5 pt-2">
                      {sec.highlights.map((hl, j) => (
                        <li key={j} className="flex items-center gap-2 text-xs text-slate-400">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{hl}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}

              {/* FREQUENTLY ASKED QUESTIONS */}
              {activeArticle.faqs && activeArticle.faqs.length > 0 && (
                <div className="space-y-3 pt-6 border-t border-white/10">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-blue-400" /> Frequently Asked Questions
                  </h4>
                  <div className="space-y-2.5">
                    {activeArticle.faqs.map((faq, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1"
                      >
                        <h5 className="text-xs font-bold text-white">Q: {faq.question}</h5>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          A: {faq.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FEEDBACK & HELPFULNESS */}
              <div className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">Was this guide helpful?</span>
                  {feedbackGiven ? (
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Thank you for your feedback!
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setFeedbackGiven("helpful")}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-400 text-xs text-slate-400 transition-colors flex items-center gap-1.5"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" /> Yes
                      </button>
                      <button
                        onClick={() => setFeedbackGiven("not-helpful")}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-xs text-slate-400 transition-colors flex items-center gap-1.5"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" /> No
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Need direct engineering support?</span>
                  <a
                    href="mailto:support@hotelplus.com.tr"
                    className="text-xs text-[var(--soft-gold)] font-bold hover:underline"
                  >
                    Contact Support
                  </a>
                </div>
              </div>

              {/* Bottom Next/Previous Pagination */}
              <div className="pt-6 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {prevArticle ? (
                  <button
                    onClick={() => {
                      setSelectedArticleId(prevArticle.id);
                      setFeedbackGiven(null);
                      window.scrollTo({ top: 350, behavior: "smooth" });
                    }}
                    className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/5 text-left transition-all group"
                  >
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                      <ChevronLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
                      Previous Guide
                    </span>
                    <h5 className="text-xs font-bold text-white truncate">
                      {prevArticle.title}
                    </h5>
                  </button>
                ) : <div />}

                {nextArticle ? (
                  <button
                    onClick={() => {
                      setSelectedArticleId(nextArticle.id);
                      setFeedbackGiven(null);
                      window.scrollTo({ top: 350, behavior: "smooth" });
                    }}
                    className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/5 text-right transition-all group"
                  >
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-end gap-1 mb-1">
                      Next Guide
                      <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <h5 className="text-xs font-bold text-white truncate">
                      {nextArticle.title}
                    </h5>
                  </button>
                ) : <div />}
              </div>
            </article>
          </div>
        </div>
      </main>

      {/* Video Modal */}
      <GuideVideoModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        article={activeArticle}
      />

      {/* Onboarding Quick Tour Modal */}
      <QuickTourModal
        isOpen={isTourModalOpen}
        onClose={() => setIsTourModalOpen(false)}
        onSelectGuide={(id) => {
          setSelectedArticleId(id);
          setFeedbackGiven(null);
        }}
      />
    </div>
  );
}
