import { Tag } from "lucide-react";
import { HotelWithPrice } from "@/types";
import { parsePrice, resolveOtaName } from "@/lib/utils";
import { getStandardizedRoomCategory } from "@/utils/roomNormalization";

interface TabOffersProps {
  hotel: HotelWithPrice;
}

export function TabOffers({ hotel }: TabOffersProps) {
  return (
            <div className="space-y-4">
              {(() => {
                // AGENT_FIX: Full fallback chain — price_info.offers (processed by backend) -> hotel-level market_offers/parity_offers/offers (raw from DB)
                const offers = (hotel?.price_info?.offers?.length ? hotel.price_info.offers : null)
                  || (hotel?.market_offers?.length ? hotel.market_offers : null)
                  || (hotel?.parity_offers?.length ? hotel.parity_offers : null)
                  || (hotel?.offers?.length ? hotel.offers : null)
                  || [];
                const displayCurrency = hotel?.price_info?.currency || hotel?.preferred_currency || "TRY";

                // Filter to only show standard rooms
                const filteredOffers = offers.filter((offer: any) => {
                  const rName = offer.room_type || offer.room_name || offer.room || "";
                  return getStandardizedRoomCategory(rName) === "Standard";
                });

                if (filteredOffers && filteredOffers.length > 0) {
                  return (
                    <div className="grid grid-cols-1 gap-4">
                      {filteredOffers.map((offer, index) => (
                        <div key={index} className="bg-[var(--glass-bg)] p-5 flex justify-between items-center group hover:bg-[var(--glass-bg-accent)] transition-all border border-[var(--glass-border)] hover:border-[var(--soft-gold)]/40 rounded-xl">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-[var(--deep-ocean-accent)] flex items-center justify-center border border-[var(--glass-border)] group-hover:border-[var(--soft-gold)]/30 transition-all">
                              <Tag className="w-5 h-5 text-[var(--soft-gold)]" />
                            </div>
                            {(() => {
                              const ota = resolveOtaName(offer.vendor || offer.source);
                              return (
                                <div>
                                  <h4 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest group-hover:text-[var(--soft-gold)] transition-colors">
                                    {ota.name}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-tight opacity-60">
                                      {ota.type}
                                    </p>
                                    {offer.room_type && (
                                      <span className="px-1.5 py-0.5 rounded bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 text-[9px] font-bold text-[var(--soft-gold)] uppercase tracking-widest">
                                        {offer.room_type}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-black text-[var(--soft-gold)] italic">
                              {new Intl.NumberFormat("en-US", {
                                style: "currency",
                                currency: displayCurrency,
                              }).format(parsePrice(offer.price))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }
                return (
                  <div className="p-4 text-center text-slate-400 uppercase text-xs tracking-wider">
                    No additional offers found.
                  </div>
                );
              })()}
            </div>
  );
}
