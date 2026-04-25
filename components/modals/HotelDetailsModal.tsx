"use client";

import { HotelWithPrice } from "@/types";
import { parsePrice } from "@/lib/utils";
import { useState } from "react";
import {
  Building2,
  X,
  Image as ImageIcon,
  List,
  Tag,
  Lock,
  Check,
  Phone,
  Mail,
  Globe,
  MapPin,
  Info,
} from "lucide-react";
import FallbackImage from "@/components/ui/FallbackImage";
import { useI18n } from "@/lib/i18n";

interface HotelDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  hotel: HotelWithPrice | null;
  isEnterprise: boolean;
  onUpgrade?: () => void;
}

export default function HotelDetailsModal({
  isOpen,
  onClose,
  hotel,
  isEnterprise,
  onUpgrade,
}: HotelDetailsModalProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<
    "overview" | "amenities" | "offers" | "gallery" | "rooms"
  >("overview");

  if (!hotel) return null;

  const tabs: {
    id: "overview" | "amenities" | "offers" | "gallery" | "rooms";
    label: string;
    icon: any;
  }[] = [
    { id: "overview", label: t("hotelDetails.overview"), icon: Building2 },
    { id: "gallery", label: t("hotelDetails.gallery"), icon: ImageIcon },
    { id: "amenities", label: t("hotelDetails.amenities"), icon: List },
    { id: "offers", label: t("hotelDetails.offers"), icon: Tag },
    { id: "rooms", label: t("hotelDetails.rooms"), icon: Building2 },
  ];

  // Normalize images to always be an array of objects
  const rawImages = hotel.images || [];
  const normalizedImages = rawImages.map(img => {
    if (typeof img === 'string') {
      return { original: img, thumbnail: img };
    }
    return {
      original: img.original || img.thumbnail || "",
      thumbnail: img.thumbnail || img.original || ""
    };
  }).filter(img => img.original || img.thumbnail);

  // If we have a main image_url and it's not in the gallery, add it at the beginning
  if (hotel.image_url && !normalizedImages.some(img => img.original === hotel.image_url || img.thumbnail === hotel.image_url)) {
    normalizedImages.unshift({ original: hotel.image_url, thumbnail: hotel.image_url });
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-500 ${isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}`}
    >
      <div
        className="absolute inset-0 bg-[var(--deep-ocean)]/80 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="relative w-full max-w-4xl glass-modal border border-[var(--glass-border)] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Header: Tactical Briefing */}
        <div className="p-4 sm:p-6 border-b border-[var(--glass-border)] flex flex-col sm:flex-row sm:items-start justify-between bg-[var(--glass-bg)] gap-4">
          <div className="flex items-center gap-3 sm:gap-4 order-2 sm:order-1">
            {hotel.image_url ? (
              <div className="relative w-12 h-12 sm:w-16 sm:h-16 rounded-lg overflow-hidden border border-[var(--glass-border)] ring-2 ring-[var(--soft-gold)]/10">
                <FallbackImage
                  src={hotel.image_url}
                  alt={hotel.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 48px, 64px"
                />
              </div>
            ) : (
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg bg-[var(--deep-ocean-accent)] flex items-center justify-center border border-[var(--glass-border)]">
                <Building2 className="w-6 h-6 sm:w-8 sm:h-8 text-[var(--soft-gold)]" />
              </div>
            )}
            <div>
              <h2 className="text-xl sm:text-3xl font-black text-[var(--text-primary)] max-w-[200px] sm:max-w-lg truncate tracking-tighter uppercase italic">
                {hotel.name}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-[10px] sm:text-xs text-[var(--text-muted)] mt-1 uppercase font-bold tracking-widest">
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--deep-ocean-accent)] border border-[var(--glass-border)]">
                    <MapPin className="w-3 h-3 text-[var(--soft-gold)]" />
                    {hotel.location}
                </span>
                {hotel.stars && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--deep-ocean-accent)] border border-[var(--glass-border)]">
                    <span className="text-[var(--soft-gold)]">★</span>
                    {hotel.stars} {t("hotelDetails.stars").replace("{0}", "").trim()}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="self-end sm:self-start p-2 rounded-full hover:bg-[var(--glass-bg-accent)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all order-1 sm:order-2 border border-[var(--glass-border)]"
            aria-label={t("common.close") || "Close"}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs: Stream Selection */}
        <div className="flex border-b border-[var(--glass-border)] overflow-x-auto bg-[var(--deep-ocean-card)]/30 px-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                        flex items-center gap-2 px-6 py-4 text-[10px] uppercase tracking-[0.2em] font-black transition-all border-b-2 whitespace-nowrap
                        ${
                          activeTab === tab.id
                            ? "border-[var(--soft-gold)] text-[var(--soft-gold)] bg-[var(--soft-gold)]/10"
                            : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-accent)]"
                        }
                    `}
            >
              <tab.icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? "text-[var(--soft-gold)]" : "text-current"}`} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-[var(--deep-ocean)] custom-scrollbar">
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
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
                        currency: hotel.price_info?.currency || "USD",
                      }).format(parsePrice(hotel.price_info?.current_price || 0))}
                    </span>
                    <span className="text-[var(--text-muted)] mb-2 uppercase font-bold text-[10px] tracking-widest">
                      / {t("common.perNight")}
                    </span>
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-[0.1em] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-optimal-green animate-pulse"></span>
                    {t("hotelDetails.foundVia")}{" "}
                    <span className="text-[var(--text-secondary)]">{hotel.price_info?.vendor || "SerpApi"}</span>
                  </div>
                </div>

                {/* Rating Distribution Box */}
                {hotel.rating_distribution && hotel.rating_distribution.length > 0 && (
                  <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] p-6 rounded-xl shadow-inner-glow">
                    <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-4">
                      {t("hotelDetails.ratingDistribution") || "Rating Distribution"}
                    </h3>
                    <div className="space-y-2">
                      {hotel.rating_distribution.sort((a,b) => b.rating - a.rating).map((dist) => {
                        const maxCount = Math.max(...(hotel.rating_distribution?.map(d => d.count) || [1]));
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
          )}

          {/* GALLERIES TAB (Locked) */}
          {activeTab === "gallery" && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {normalizedImages.map((img, idx) => (
                <div
                  key={idx}
                  className="aspect-video rounded-lg overflow-hidden bg-[var(--deep-ocean-accent)] relative group cursor-pointer border border-[var(--glass-border)]"
                >
                  <FallbackImage
                    src={img.original || img.thumbnail || ""}
                    alt={`Gallery ${idx}`}
                    fill
                    className="object-cover transition-all duration-700 group-hover:scale-110 group-hover:rotate-1"
                    sizes="(max-width: 768px) 50vw, 33vw"
                    // @ts-ignore
                    iconClassName="w-6 h-6 text-[var(--soft-gold)]/20"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--deep-ocean)]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3 z-10">
                    <span className="text-[9px] font-black text-[var(--overlay-text)] uppercase tracking-widest px-2 py-1 bg-[var(--soft-gold)]/20 backdrop-blur-md rounded border border-[var(--overlay-border)]">
                      {t("common.view")} Full Res
                    </span>
                  </div>
                </div>
              ))}
              {normalizedImages.length === 0 && (
                <div className="col-span-full py-20 text-center flex flex-col items-center gap-4 text-[var(--text-muted)] bg-[var(--glass-bg)] rounded-xl border border-dashed border-[var(--glass-border)]">
                   <ImageIcon className="w-12 h-12 opacity-10" />
                  <p className="text-[10px] uppercase font-black tracking-widest">{t("hotelDetails.noImages")}</p>
                </div>
              )}
            </div>
          )}

          {/* AMENITIES TAB (Locked) */}
          {activeTab === "amenities" && (
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
          )}

          {/* OFFERS TAB (Locked) */}
          {activeTab === "offers" && (
            <div className="overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)]">
              <table className="w-full text-left text-xs uppercase font-black tracking-widest">
                <thead className="bg-[var(--deep-ocean-accent)] text-[var(--text-muted)] border-b border-[var(--glass-border)]">
                  <tr>
                    <th className="p-4">{t("hotelDetails.vendor")}</th>
                    <th className="p-4 text-right">
                      {t("hotelDetails.price")}
                    </th>
                    <th className="p-4 text-right">
                      {t("hotelDetails.diff")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--glass-border)]">
                  {((hotel as any).price_info?.offers || (hotel as any).offers || []).map((offer: any, idx: number) => {
                    const diff =
                      (offer.price || 0) -
                      parsePrice(hotel.price_info?.current_price || 0);
                    return (
                      <tr
                        key={idx}
                        className="group hover:bg-[var(--glass-bg-accent)] transition-all cursor-default"
                      >
                        <td className="p-4 font-black text-[var(--text-primary)]">
                          {offer.vendor || offer.source || "Unknown Source"}
                        </td>
                        <td className="p-4 text-right text-[var(--soft-gold)] font-black text-sm italic">
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: hotel.price_info?.currency || "USD",
                          }).format(parsePrice(offer.price || 0))}
                        </td>
                        <td
                          className={`p-4 text-right font-black ${diff > 0 ? "text-alert-red" : diff < 0 ? "text-optimal-green" : "text-[var(--text-muted)]"}`}
                        >
                          <span className={`px-2 py-1 rounded ${diff > 0 ? "bg-rose-500/10" : diff < 0 ? "bg-emerald-500/10" : "bg-white/5"}`}>
                              {diff > 0 ? "+" : ""}{diff.toFixed(0)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(!hotel.price_info?.offers ||
                hotel.price_info.offers.length === 0) && (
                <div className="p-12 text-center text-[var(--text-muted)]">
                   <p className="text-[10px] uppercase font-black tracking-widest">{t("hotelDetails.noOffers")}</p>
                </div>
              )}
            </div>
          )}

          {/* ROOM TYPES TAB */}
          {activeTab === "rooms" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                {((hotel as any).price_info?.room_types || (hotel as any).room_types || []).map((room: any, idx: number) => (
                  <div
                    key={idx}
                    className="bg-[var(--glass-bg)] p-5 flex justify-between items-center group hover:bg-[var(--glass-bg-accent)] transition-all border border-[var(--glass-border)] hover:border-[var(--soft-gold)]/40 rounded-xl"
                  >
                    <div>
                      <h4 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest group-hover:text-[var(--soft-gold)] transition-colors">
                        {room.name || "Target Chamber"}
                      </h4>
                      <p className="text-[10px] text-[var(--text-muted)] mt-1 uppercase font-bold tracking-tight opacity-60">
                        {t("hotelDetails.foundVia")} reconnaissance
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black text-[var(--soft-gold)] italic">
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency:
                            room.currency ||
                            hotel.price_info?.currency ||
                            "USD",
                        }).format(parsePrice(room.price || 0))}
                      </div>
                      <span className="text-[9px] text-optimal-green font-black uppercase tracking-widest mt-1 block">
                        {t("common.availableNow")}
                      </span>
                    </div>
                  </div>
                ))}
                {(!hotel.price_info?.room_types ||
                  hotel.price_info.room_types.length === 0) && (
                  <div className="py-20 text-center flex flex-col items-center gap-4 text-[var(--text-muted)] bg-[var(--glass-bg)] rounded-xl border border-dashed border-[var(--glass-border)]">
                    <Building2 className="w-12 h-12 opacity-10" />
                    <p className="text-[10px] uppercase font-black tracking-widest">{t("hotelDetails.noRooms")}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LockedFeature({
  children,
  isEnterprise,
  onUpgrade,
  title,
  description,
}: {
  children: React.ReactNode;
  isEnterprise: boolean;
  onUpgrade?: () => void;
  title: string;
  description: string;
}) {
  const { t } = useI18n();
  if (isEnterprise) return <>{children}</>;

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-8 text-center min-h-[400px] flex flex-col items-center justify-center">
      {/* Blurry Background Mockup: Encrypted Stream */}
      <div className="absolute inset-0 opacity-20 blur-xl pointer-events-none select-none overflow-hidden scale-110">
        <div className="grid grid-cols-3 gap-6 p-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
            <div key={i} className="h-32 bg-[var(--soft-gold)]/20 rounded-xl border border-[var(--soft-gold)]/10 animate-pulse" style={{ animationDelay: `${i * 100}ms` }}></div>
          ))}
        </div>
      </div>

      <div className="relative z-10 max-w-sm mx-auto p-8 rounded-2xl bg-[var(--deep-ocean)]/60 backdrop-blur-xl border border-[var(--glass-border)] shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--soft-gold)]/20 to-transparent flex items-center justify-center mx-auto mb-6 text-[var(--soft-gold)] border border-[var(--soft-gold)]/30 group animate-float">
          <Lock className="w-8 h-8 group-hover:scale-110 transition-transform" />
        </div>
        <h3 className="text-2xl font-black text-[var(--text-primary)] mb-3 uppercase tracking-tighter italic">{title}</h3>
        <p className="text-[var(--text-secondary)] mb-8 text-sm font-medium leading-relaxed">
          {description}
        </p>
        <button 
          onClick={onUpgrade} 
          className="btn-gold w-full py-4 text-xs font-black uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] transition-all"
        >
          {t("hotelDetails.unlockButton")}
        </button>
        <p className="mt-4 text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest opacity-50 flex items-center justify-center gap-2">
            <Info className="w-3 h-3" />
            Security Clearance Required
        </p>
      </div>
    </div>
  );
}
