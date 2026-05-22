import { Check, List } from "lucide-react";
import { HotelWithPrice } from "@/types";

interface TabAmenitiesProps {
  hotel: HotelWithPrice;
  t: (key: string) => string;
}

export function TabAmenities({ hotel, t }: TabAmenitiesProps) {
  return (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {(hotel.amenities || []).map((amenity, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-4 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] group hover:border-[var(--soft-gold)]/30 transition-colors"
                >
                  <div className="w-6 h-6 rounded bg-[var(--soft-gold)]/10 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-[var(--soft-gold)]" />
                  </div>
                  <span className="text-xs font-bold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                    {amenity}
                  </span>
                </div>
              ))}
              {(!hotel.amenities || hotel.amenities.length === 0) && (
                <div className="col-span-full py-20 text-center flex flex-col items-center gap-4 text-[var(--text-muted)] bg-[var(--glass-bg)] rounded-xl border border-dashed border-[var(--glass-border)]">
                   <List className="w-12 h-12 opacity-10" />
                  <p className="text-[10px] uppercase font-black tracking-widest">{t("hotelDetails.noAmenities")}</p>
                </div>
              )}
            </div>
  );
}
