"use client";

import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { getCategoryIcon, getCategoryGlow, getCategoryDotColor, getCategoryDisplayName } from "./sentimentUIHelpers";

export const GuestMentionsMatrix = ({ groupedMentions, locale }: { groupedMentions: any[], locale: string }) => {
  if (!groupedMentions || groupedMentions.length === 0) return null;

  return (
    <div className="mb-10 pb-8 border-b border-[var(--glass-border)] relative">
                <div className="mb-10 pb-8 border-b border-[var(--glass-border)] relative">
                  <div className="flex flex-col mb-6">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-[0.2em] flex items-center gap-2">
                      <MessageSquare className="w-3 h-3 text-[var(--soft-gold)]" />
                      {locale === 'tr' ? "Kategorize Edilmiş Taktiksel Konuk Sesi" : "Categorized Tactical Guest Voice"}
                    </p>
                    <h4 className="text-sm font-semibold text-[var(--text-primary)] mt-1">
                      {locale === 'tr' ? "Gerçek konuk değerlendirmelerinden çıkarılan taktiksel içgörüler" : "Tactical insights extracted from real guest reviews"}
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                    {groupedMentions.map((group, gIdx) => (
                      <div 
                        key={group.name} 
                        className="flex flex-col p-6 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-xl hover:border-[var(--overlay-border)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] transition-all duration-500 relative overflow-hidden group"
                      >
                        {/* Ambient styling backdrop */}
                        <div className={`absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br ${getCategoryGlow(group.name)} to-transparent rounded-full blur-3xl pointer-events-none group-hover:scale-125 transition-transform duration-1000`} />
                        
                        <h5 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-[0.15em] flex items-center justify-between mb-5 pb-2.5 border-b border-[var(--glass-border)]">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-md bg-[var(--glass-border)] flex items-center justify-center">
                              {getCategoryIcon(group.name)}
                            </div>
                            {getCategoryDisplayName(group.name)}
                          </div>
                          <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${getCategoryDotColor(group.name)}`} />
                        </h5>

                        <div className="flex flex-wrap gap-2.5">
                          {group.items.map((mention: any, index: number) => {
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
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: (gIdx * 0.05) + (index * 0.02), type: "spring", stiffness: 200, damping: 20 }}
                                whileHover={{ scale: 1.05, y: -1 }}
                                className={`group/tag flex items-center gap-2 px-3 py-1.5 border rounded-xl text-[11px] font-bold transition-all duration-300 cursor-default backdrop-blur-[2px] select-none ${pillStyle}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full transition-transform duration-300 group-hover/tag:scale-125 ${dotColor}`} />
                                <span className="tracking-wide leading-none font-semibold">
                                  {mention.keyword}
                                </span>
                                {mention.count > 0 && (
                                  <span className={`ml-0.5 px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider transition-colors duration-300 ${countBadgeStyle}`}>
                                    {mention.count}
                                  </span>
                      </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
    </div>
  );
};
