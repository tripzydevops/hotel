import { Star, ExternalLink } from "lucide-react";
import { HotelWithPrice } from "@/types";

interface TabReviewsProps {
  other_sites_reviews: any[];
  sentiment_breakdown: any[];
  guest_mentions: any[];
  t: (key: string) => string;
}

export function TabReviews({ other_sites_reviews, sentiment_breakdown, guest_mentions, t }: TabReviewsProps) {
  return (
            <div className="space-y-8">
              {/* CROSS PLATFORM SOURCES */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tighter italic">
                      {t("common.crossPlatformIntelligence")}
                    </h3>
                    <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest mt-1">
                      Synchronized market reputation data
                    </p>
                  </div>
                  {other_sites_reviews && other_sites_reviews.length > 0 && (
                    <div className="px-3 py-1 bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 rounded-full">
                      <span className="text-[9px] font-black text-[var(--soft-gold)] uppercase tracking-widest">
                        {other_sites_reviews.length} SOURCES DETECTED
                      </span>
                    </div>
                  )}
                </div>

                {other_sites_reviews && other_sites_reviews.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {other_sites_reviews.map((site, index) => {
                      const normalized = site.title.toLowerCase();
                      let brandColor = "var(--soft-gold)";
                      let brandBg = "rgba(212, 175, 55, 0.1)";
                      
                      if (normalized.includes("google")) {
                        brandColor = "#4285F4";
                        brandBg = "rgba(66, 133, 244, 0.1)";
                      } else if (normalized.includes("booking")) {
                        brandColor = "#003580";
                        brandBg = "rgba(0, 53, 128, 0.1)";
                      } else if (normalized.includes("tripadvisor")) {
                        brandColor = "#34E0A1";
                        brandBg = "rgba(52, 224, 161, 0.1)";
                      } else if (normalized.includes("hotels.com") || normalized.includes("expedia")) {
                        brandColor = "#D32F2F";
                        brandBg = "rgba(211, 47, 47, 0.1)";
                      }

                      const rating = site.rating || 0;
                      const ratingMax = site.rating_max || 5;
                      const ratingPercent = (rating / ratingMax) * 100;

                      return (
                        <div 
                          key={index} 
                          className="bg-[var(--glass-bg)] p-5 border border-[var(--glass-border)] rounded-2xl relative overflow-hidden group hover:border-[var(--soft-gold)]/40 transition-all duration-500 hover:shadow-2xl hover:shadow-[var(--soft-gold)]/5"
                        >
                          {/* Platform Header */}
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg transition-transform group-hover:scale-110"
                                style={{ backgroundColor: brandColor }}
                              >
                                {site.title.charAt(0)}
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight truncate max-w-[150px]">
                                  {site.title}
                                </h4>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <div className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: brandColor }} />
                                  <span className="text-[8px] text-[var(--text-muted)] font-bold uppercase tracking-widest">Live Feed</span>
                                </div>
                              </div>
                            </div>
                            {site.url && (
                              <a 
                                href={site.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--glass-bg-accent)] text-[var(--text-muted)] hover:text-[var(--soft-gold)] hover:bg-[var(--soft-gold)]/10 transition-all"
                                title="View Original Source"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                          
                          {/* Rating Display */}
                          <div className="flex items-end justify-between relative z-10">
                            <div>
                              <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-black text-[var(--text-primary)] tracking-tighter italic">
                                  {site.rating?.toFixed(1)}
                                </span>
                                {site.rating_max && (
                                  <span className="text-sm text-[var(--text-muted)] font-bold italic opacity-40">
                                    /{site.rating_max}
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-0.5 mt-2">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star 
                                    key={s} 
                                    className={`w-2.5 h-2.5 ${s <= Math.round(site.rating || 0) ? 'text-[var(--soft-gold)] fill-[var(--soft-gold)]' : 'text-[var(--text-muted)] opacity-20'}`} 
                                  />
                                ))}
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <div className="text-xl font-black text-[var(--text-primary)] italic tracking-tighter">
                                {site.review_count?.toLocaleString()}
                              </div>
                              <p className="text-[8px] text-[var(--text-muted)] uppercase font-black tracking-[0.2em] mt-1 opacity-60">
                                Total Verified Reviews
                              </p>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="mt-6 relative">
                            <div className="h-1.5 w-full bg-[var(--glass-bg-accent)] rounded-full overflow-hidden border border-[var(--glass-border)]/20">
                              <div 
                                className="h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(212,175,55,0.3)]"
                                style={{ 
                                  width: `${ratingPercent}%`,
                                  background: `linear-gradient(90deg, ${brandColor} 0%, var(--soft-gold) 100%)`
                                }}
                              />
                            </div>
                          </div>
                          
                          {/* Decorative Background Elements */}
                          <div className="absolute top-0 right-0 p-4 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                            <Star className="w-32 h-32 rotate-12" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-[var(--glass-bg)] rounded-3xl border border-[var(--glass-border)] relative overflow-hidden">
                    <div className="relative z-10">
                      <div className="w-12 h-12 bg-[var(--glass-bg-accent)] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[var(--glass-border)]">
                        <Star className="w-6 h-6 text-[var(--text-muted)] opacity-20" />
                      </div>
                      <h4 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest mb-1">
                        No Source Reviews Yet
                      </h4>
                      <p className="text-[10px] text-[var(--text-muted)] max-w-[240px] mx-auto uppercase font-bold tracking-tight leading-relaxed opacity-60">
                        Reputation data from multiple channels is still pending aggregation.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* THEME SENTIMENT ANALYSIS */}
              {sentiment_breakdown && sentiment_breakdown.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-[var(--glass-border)]">
                  <div>
                    <h3 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tighter italic">
                      Theme Sentiment Breakdown
                    </h3>
                    <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest mt-1">
                      Guest feedback categories and polarity distribution
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {sentiment_breakdown.map((theme, index) => {
                      const hasRawData = 'summary' in theme;
                      const score = theme.rating || 0;
                      // Display percentage out of 5 stars or scale to 100
                      const scorePercent = (score / 5) * 100;
                      return (
                        <div key={index} className="bg-[var(--glass-bg)] p-4 border border-[var(--glass-border)] rounded-xl space-y-3 relative group overflow-hidden">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-[var(--text-primary)] uppercase tracking-tight">
                              {theme.name}
                            </span>
                            <span className="text-xs font-black text-[var(--soft-gold)] italic">
                              {score.toFixed(1)}/5
                            </span>
                          </div>
                          
                          {/* Breakdown Bar */}
                          <div className="h-1.5 w-full bg-[var(--glass-bg-accent)] rounded-full overflow-hidden border border-[var(--glass-border)]/20">
                            <div 
                              className="h-full bg-gradient-to-r from-[var(--soft-gold)] via-amber-400 to-yellow-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(212,175,55,0.2)]"
                              style={{ width: `${Math.min(100, Math.max(0, scorePercent))}%` }}
                            />
                          </div>

                          {/* Details like total / positives if available */}
                          {(theme.positive !== undefined || theme.neutral !== undefined || theme.negative !== undefined) && (
                            <div className="flex justify-between items-center text-[9px] uppercase font-bold text-[var(--text-muted)] tracking-wider">
                              <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {theme.positive || 0} Positive
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                {theme.neutral || 0} Neutral
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                {theme.negative || 0} Negative
                              </span>
                            </div>
                          )}

                          {(theme as any).summary && (
                            <p className="text-[10px] text-[var(--text-secondary)] italic font-medium leading-relaxed mt-1 opacity-80 group-hover:opacity-100">
                              "{(theme as any).summary}"
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* GUEST MENTIONS & KEYWORDS */}
              {guest_mentions && guest_mentions.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-[var(--glass-border)]">
                  <div>
                    <h3 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tighter italic">
                      Guest Mentions & Keywords
                    </h3>
                    <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-widest mt-1">
                      Direct sentiment-tagged review keywords
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {guest_mentions.map((mention, index) => {
                      const mentionSentiment = (mention.sentiment || "neutral").toLowerCase();
                      let pillColor = "bg-[var(--glass-bg-accent)] text-[var(--text-primary)] border-[var(--glass-border)]";
                      let dotColor = "bg-slate-400";
                      
                      if (mentionSentiment === "positive") {
                        pillColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                        dotColor = "bg-emerald-500";
                      } else if (mentionSentiment === "negative") {
                        pillColor = "bg-rose-500/10 text-rose-400 border-rose-500/20";
                        dotColor = "bg-rose-500";
                      }

                      return (
                        <div 
                          key={index} 
                          className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all duration-300 hover:scale-105 hover:bg-[var(--glass-bg-accent)] ${pillColor}`}
                          title={mention.text || mention.raw_keyword}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                          <span className="uppercase tracking-tight">
                            {mention.keyword}
                          </span>
                          {mention.count > 0 && (
                            <span className="px-1.5 py-0.5 bg-black/30 rounded-full font-black tracking-widest text-[9px]">
                              {mention.count}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
  );
}
