import { HotelWithPrice } from "@/types";
import { Building2, MapPin, Phone, Mail, Globe, Info } from "lucide-react";
import { parsePrice, resolveOtaName } from "@/lib/utils";

interface TabOverviewProps {
  hotel: HotelWithPrice;
  rating_distribution: any[];
  t: (key: string) => string;
}

export function TabOverview({ hotel, rating_distribution, t }: TabOverviewProps) {
  return (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Live Rates Box */}
                <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] p-6 rounded-xl shadow-inner-glow relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-10">
                    <Building2 className="w-12 h-12" />
                  </div>
                  <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-4">
                    {t("hotelDetails.liveRates")}
                  </h3>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-5xl font-black text-[var(--soft-gold)] tracking-tighter italic">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: hotel.price_info?.currency || hotel.preferred_currency || "TRY",
                      }).format(parsePrice(hotel.price_info?.current_price || 0))}
                    </span>
                    <span className="text-[var(--text-muted)] mb-2 uppercase font-bold text-[10px] tracking-widest">
                      / {t("common.perNight")}
                    </span>
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-[0.1em] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-optimal-green animate-pulse"></span>
                    {t("hotelDetails.foundVia")}{" "}
                    <span className="text-[var(--text-secondary)]">{resolveOtaName(hotel.price_info?.vendor || "SerpApi").name}</span>
                  </div>
                </div>

                {/* Rating Distribution Box */}
                {rating_distribution && rating_distribution.length > 0 && (
                  <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] p-6 rounded-xl shadow-inner-glow">
                    <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-4">
                      {t("hotelDetails.ratingDistribution") || "Rating Distribution"}
                    </h3>
                    <div className="space-y-2">
                      {rating_distribution.sort((a: any, b: any) => b.rating - a.rating).map((dist: any) => {
                        const maxCount = Math.max(...(rating_distribution?.map((d: any) => d.count) || [1]));
                        const percentage = (dist.count / maxCount) * 100;
                        return (
                          <div key={dist.rating} className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-[var(--text-primary)] w-4 italic">
                              {dist.rating}★
                            </span>
                            <div className="flex-1 h-1.5 bg-[var(--deep-ocean-accent)] rounded-full overflow-hidden border border-[var(--glass-border)]">
                              <div 
                                className="h-full bg-gradient-to-r from-[var(--soft-gold)] to-[var(--soft-gold)]/50 rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-[9px] font-bold text-[var(--text-muted)] w-8 text-right tabular-nums">
                              {dist.count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* New Contact & Description Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(hotel.phone || hotel.email || hotel.website || hotel.address) && (
                  <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] p-6 rounded-xl">
                    <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                       <Phone className="w-3.5 h-3.5 text-[var(--soft-gold)]" />
                       {t("hotelDetails.contactInfo") || "Contact Details"}
                    </h3>
                    <div className="space-y-4">
                      {hotel.address && (
                        <div className="flex items-start gap-4 p-2 rounded bg-[var(--deep-ocean-accent)]/50 border border-[var(--glass-border)]">
                          <MapPin className="w-4 h-4 text-[var(--soft-gold)] mt-1 flex-shrink-0" />
                          <div>
                            <p className="text-[10px] text-[var(--text-muted)] uppercase font-black tracking-widest opacity-50">Base Address</p>
                            <p className="text-sm text-[var(--text-primary)] font-medium leading-relaxed">{hotel.address}</p>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        {hotel.phone && (
                          <div className="flex items-start gap-3 p-2 rounded bg-[var(--deep-ocean-accent)]/30 border border-[var(--glass-border)]">
                            <Phone className="w-3.5 h-3.5 text-optimal-green/70 mt-1 flex-shrink-0" />
                            <div className="overflow-hidden">
                              <p className="text-[9px] text-[var(--text-muted)] uppercase font-black tracking-widest opacity-50">Comm Line</p>
                              <a href={`tel:${hotel.phone}`} className="text-xs text-[var(--text-primary)] hover:text-[var(--soft-gold)] transition-colors truncate block">{hotel.phone}</a>
                            </div>
                          </div>
                        )}
                        {hotel.email && (
                          <div className="flex items-start gap-3 p-2 rounded bg-[var(--deep-ocean-accent)]/30 border border-[var(--glass-border)]">
                            <Mail className="w-3.5 h-3.5 text-sky-400/70 mt-1 flex-shrink-0" />
                            <div className="overflow-hidden">
                              <p className="text-[9px] text-[var(--text-muted)] uppercase font-black tracking-widest opacity-50">Direct Mail</p>
                              <a href={`mailto:${hotel.email}`} className="text-xs text-[var(--text-primary)] hover:text-[var(--soft-gold)] transition-colors truncate block">{hotel.email}</a>
                            </div>
                          </div>
                        )}
                      </div>
                      {hotel.website && (
                          <a 
                            href={hotel.website} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex items-center justify-center gap-2 w-full py-2.5 rounded bg-[var(--soft-gold)]/5 border border-[var(--soft-gold)]/20 text-[var(--soft-gold)] text-[10px] uppercase font-black tracking-[0.2em] hover:bg-[var(--soft-gold)]/10 transition-all"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            Synchronize with Proxy
                          </a>
                        )}
                    </div>
                  </div>
                )}

                {hotel.description && (
                  <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] p-6 rounded-xl relative overflow-hidden">
                    <div className="absolute bottom-0 right-0 p-4 opacity-5 pointer-events-none">
                        <Info className="w-24 h-24" />
                    </div>
                    <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                       <Info className="w-3.5 h-3.5 text-[var(--soft-gold)]" />
                       {t("hotelDetails.description") || "Intelligence Brief"}
                    </h3>
                    <div className="max-h-[220px] overflow-y-auto pr-2 custom-scrollbar relative z-10">
                       <p className="text-sm text-[var(--text-secondary)] leading-loose italic font-medium opacity-80">
                         "{hotel.description.length > 500 ? hotel.description.substring(0, 500) + "..." : hotel.description}"
                       </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
  );
}
