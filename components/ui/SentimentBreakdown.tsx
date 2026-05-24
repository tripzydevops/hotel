import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThumbsUp, ThumbsDown, MessageSquare, ChevronDown } from "lucide-react";

interface SentimentItem {
  name: string;
  total_mentioned: number;
  positive: number;
  negative: number;
  neutral: number;
  description?: string;
  serpapi_link?: string;
}

import { useI18n } from "@/lib/i18n";

interface SentimentBreakdownProps {
  items: SentimentItem[];
  mentions?: Array<{
    keyword: string;
    category: string;
    count: number;
    sentiment: string;
  }>;
}

export const SentimentBreakdown: React.FC<SentimentBreakdownProps> = ({
  items,
  mentions,
}) => {
  const { locale } = useI18n();
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] p-8 sm:p-10 rounded-2xl relative overflow-hidden backdrop-blur-xl">
      <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
        <MessageSquare className="w-32 h-32" />
      </div>

      <div className="flex items-start gap-4 mb-10 relative z-10">
        <div className="p-3 rounded-xl bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] border border-[var(--soft-gold)]/20 shadow-[0_0_25px_rgba(212,175,55,0.1)]">
          <ThumbsUp className="w-6 h-6 sm:w-7 sm:h-7" />
        </div>
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tighter uppercase italic leading-none mb-2">
            {locale === 'tr' ? "Zeka Duyarlılık Analizi" : "Intelligence Sentiment Breakdown"}
          </h3>
          <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-[0.3em] opacity-80">
            {locale === 'tr' ? "Taktiksel inceleme akışlarının otomatik dilsel analizi" : "Automated linguistic analysis of tactical review streams"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-8 relative z-10">
        {items.map((item, idx) => {
          const total = item.total_mentioned || 0;
          const posPercent =
            total > 0 && !Number.isNaN(item.positive)
              ? Math.round(((item.positive || 0) / total) * 100)
              : 0;
          const negPercent =
            total > 0 && !Number.isNaN(item.negative)
              ? Math.round(((item.negative || 0) / total) * 100)
              : 0;

          const isExpanded = !!expandedCategories[item.name];
          
          // Filter matching mentions for this category (case insensitive matching)
          const categoryMentions = mentions?.filter(m => {
            const mCat = (m.category || "").toLowerCase().trim();
            const iName = (item.name || "").toLowerCase().trim();
            return mCat === iName;
          }) || [];

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => toggleCategory(item.name)}
              className="relative group cursor-pointer p-4 -mx-4 rounded-2xl hover:bg-[var(--deep-ocean-accent)]/20 transition-all duration-300 border border-transparent hover:border-[var(--glass-border)]/30"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex flex-col gap-1">
                  <h4 className="text-sm font-black text-[var(--text-primary)] group-hover:text-[var(--soft-gold)] transition-colors uppercase tracking-widest">
                    {item.name}
                  </h4>
                  <span className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest opacity-60">
                    {item.total_mentioned} {locale === 'tr' ? "SİNYAL TESPİTİ" : "SIGNAL DETECTIONS"}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1.5 grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                        <ThumbsUp className="w-3 h-3 text-optimal-green" />
                        <span className="text-xs font-black text-[var(--text-primary)]">{posPercent}%</span>
                    </div>
                    <div className="flex items-center gap-1.5 grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all mt-0.5">
                        <ThumbsDown className="w-3 h-3 text-alert-red" />
                        <span className="text-[10px] font-black text-[var(--text-muted)]">{negPercent}%</span>
                    </div>
                  </div>
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-[var(--text-muted)] opacity-60 group-hover:opacity-100 group-hover:text-[var(--soft-gold)] transition-colors"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </motion.div>
                </div>
              </div>

              {/* Graphical Integrity Line */}
              <div className="h-1 w-full bg-[var(--deep-ocean-accent)] rounded-full overflow-hidden mb-1 border border-[var(--glass-border)]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${posPercent}%` }}
                  className="h-full bg-gradient-to-r from-optimal-green/20 via-optimal-green/40 to-optimal-green/60 group-hover:from-[var(--soft-gold)]/40 group-hover:to-[var(--soft-gold)] transition-all duration-500"
                />
              </div>

              {/* Collapsible details section */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                    animate={{ height: "auto", opacity: 1, marginTop: 12 }}
                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    {/* Decrypted Review Snippet */}
                    {item.description && (
                      <div className="flex items-start gap-3 py-3 px-4 bg-[var(--deep-ocean-accent)]/30 border border-[var(--glass-border)] rounded-xl relative overflow-hidden mb-3">
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--soft-gold)]/20" />
                        <MessageSquare className="w-3.5 h-3.5 text-[var(--soft-gold)] opacity-40 mt-0.5 flex-shrink-0" />
                        <p className="text-[11px] text-[var(--text-secondary)] italic leading-relaxed font-medium opacity-90">
                          &ldquo;{item.description}&rdquo;
                        </p>
                      </div>
                    )}

                    {/* Associated Keywords */}
                    {categoryMentions.length > 0 ? (
                      <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-[var(--glass-border)]/20">
                        <span className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-wider mb-1">
                          {locale === 'tr' ? "İlişkili Anahtar Kelimeler" : "Associated Keywords"}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {categoryMentions.map((mention: any, index: number) => {
                            let pillStyle = "";
                            let countBadgeStyle = "";
                            let dotColor = "";
                            
                            if (mention.sentiment === "positive") {
                              pillStyle = "bg-gradient-to-r from-emerald-500/10 to-teal-500/5 text-emerald-500 border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-[0_0_12px_rgba(16,185,129,0.25)]";
                              countBadgeStyle = "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
                              dotColor = "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]";
                            } else if (mention.sentiment === "negative") {
                              pillStyle = "bg-gradient-to-r from-rose-500/10 to-red-500/5 text-rose-500 border-rose-500/20 hover:border-rose-500/40 hover:shadow-[0_0_12px_rgba(244,63,94,0.25)]";
                              countBadgeStyle = "bg-rose-500/20 text-rose-400 border border-rose-500/30";
                              dotColor = "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]";
                            } else {
                              pillStyle = "bg-gradient-to-r from-slate-500/10 to-gray-500/5 text-[var(--text-secondary)] border-[var(--glass-border)] hover:border-slate-500/40 hover:shadow-[0_0_12px_rgba(100,116,139,0.2)]";
                              countBadgeStyle = "bg-slate-500/20 text-[var(--text-primary)] border border-[var(--glass-border)]";
                              dotColor = "bg-slate-400 shadow-[0_0_6px_rgba(148,163,184,0.4)]";
                            }

                            return (
                              <motion.div 
                                key={`${mention.keyword}-${index}`}
                                whileHover={{ scale: 1.05, y: -1 }}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-xl text-[10px] font-bold transition-all duration-300 cursor-default backdrop-blur-[2px] select-none ${pillStyle}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                                <span className="tracking-wide leading-none font-semibold">
                                  {mention.keyword}
                                </span>
                                {mention.count > 0 && (
                                  <span className={`ml-0.5 px-1 py-0.2 rounded text-[8px] font-black tracking-wider transition-colors duration-300 ${countBadgeStyle}`}>
                                    {mention.count}
                                  </span>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-[var(--text-muted)] italic mt-2">
                        {locale === 'tr' ? "Bu kategori için detaylı anahtar kelime bulunmamaktadır." : "No specific keyword signals found for this category."}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default SentimentBreakdown;
