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
  Star,
  ExternalLink,
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
    "overview" | "amenities" | "offers" | "gallery" | "rooms" | "reviews"
  >("overview");

  if (!hotel) return null;

  const tabs: {
    id: "overview" | "amenities" | "offers" | "gallery" | "rooms" | "reviews";
    label: string;
    icon: any;
  }[] = [
    { id: "overview", label: t("hotelDetails.overview"), icon: Building2 },
    { id: "gallery", label: t("hotelDetails.gallery"), icon: ImageIcon },
    { id: "amenities", label: t("hotelDetails.amenities"), icon: List },
    { id: "offers", label: t("hotelDetails.offers"), icon: Tag },
    { id: "rooms", label: t("hotelDetails.rooms"), icon: Building2 },
    { id: "reviews", label: "Reviews", icon: Star },
  ];

  // Fix the "reviews" type mismatch
  const reviewsObj = hotel?.reviews as any;
  const priceInfoReviewsObj = (hotel?.price_info as any)?.reviews as any;

  // Extract other_sites_reviews
  let other_sites_reviews: any[] = [];
  if (Array.isArray(hotel?.other_sites_reviews) && hotel.other_sites_reviews.length > 0) {
    other_sites_reviews = hotel.other_sites_reviews;
  } else if (reviewsObj && Array.isArray(reviewsObj.other_sites_reviews) && reviewsObj.other_sites_reviews.length > 0) {
    other_sites_reviews = reviewsObj.other_sites_reviews;
  } else if (priceInfoReviewsObj && Array.isArray(priceInfoReviewsObj.other_sites_reviews) && priceInfoReviewsObj.other_sites_reviews.length > 0) {
    other_sites_reviews = priceInfoReviewsObj.other_sites_reviews;
  } else if (hotel?.price_info && Array.isArray((hotel.price_info as any).other_sites_reviews) && (hotel.price_info as any).other_sites_reviews.length > 0) {
    other_sites_reviews = (hotel.price_info as any).other_sites_reviews;
  }

  // Normalize other_sites_reviews to handle nested rating objects
  other_sites_reviews = other_sites_reviews.map(site => ({
    ...site,
    rating: typeof site.rating === 'object' ? site.rating.value : site.rating,
    rating_max: typeof site.rating === 'object' ? (site.rating.max || site.rating_max || 5) : (site.rating_max || 5),
    review_count: typeof site.rating === 'object' ? (site.rating.count || site.review_count) : site.review_count
  }));

  // Extract sentiment_breakdown
  let sentiment_breakdown: any[] = [];
  if (Array.isArray(hotel?.sentiment_breakdown) && hotel.sentiment_breakdown.length > 0) {
    sentiment_breakdown = hotel.sentiment_breakdown;
  } else if (reviewsObj && Array.isArray(reviewsObj.sentiment_breakdown) && reviewsObj.sentiment_breakdown.length > 0) {
    sentiment_breakdown = reviewsObj.sentiment_breakdown;
  } else if (priceInfoReviewsObj && Array.isArray(priceInfoReviewsObj.sentiment_breakdown) && priceInfoReviewsObj.sentiment_breakdown.length > 0) {
    sentiment_breakdown = priceInfoReviewsObj.sentiment_breakdown;
  }

  // Normalize sentiment_breakdown to ensure rating exists
  sentiment_breakdown = sentiment_breakdown.map(theme => {
    let rating = theme.rating;
    if (rating === undefined && theme.total > 0) {
      rating = ((theme.positive || 0) / theme.total) * 5;
    }
    return { ...theme, rating: rating || 0 };
  });

  // Extract guest_mentions
  let guest_mentions: any[] = [];
  if (Array.isArray(hotel?.guest_mentions) && hotel.guest_mentions.length > 0) {
    guest_mentions = hotel.guest_mentions;
  } else if (reviewsObj && Array.isArray(reviewsObj.guest_mentions) && reviewsObj.guest_mentions.length > 0) {
    guest_mentions = reviewsObj.guest_mentions;
  } else if (reviewsObj && Array.isArray(reviewsObj.mentions) && reviewsObj.mentions.length > 0) {
    guest_mentions = reviewsObj.mentions;
  } else if (priceInfoReviewsObj && Array.isArray(priceInfoReviewsObj.guest_mentions) && priceInfoReviewsObj.guest_mentions.length > 0) {
    guest_mentions = priceInfoReviewsObj.guest_mentions;
  } else if (priceInfoReviewsObj && Array.isArray(priceInfoReviewsObj.mentions) && priceInfoReviewsObj.mentions.length > 0) {
    guest_mentions = priceInfoReviewsObj.mentions;
  }

  // Normalize guest_mentions to match expected keys
  guest_mentions = guest_mentions.map(mention => ({
    ...mention,
    keyword: mention.keyword || mention.title,
    count: mention.count || mention.total_count,
    sentiment: mention.sentiment || (
      (mention.positive_count || 0) > (mention.negative_count || 0) ? "positive" : 
      ((mention.negative_count || 0) > (mention.positive_count || 0) ? "negative" : "neutral")
    )
  }));

  // Extract rating_distribution
  let rating_distribution: any[] = [];
  let raw_dist = hotel?.rating_distribution || reviewsObj?.rating_distribution || priceInfoReviewsObj?.rating_distribution;

  if (Array.isArray(raw_dist)) {
    rating_distribution = raw_dist;
  } else if (raw_dist && typeof raw_dist === 'object') {
    rating_distribution = Object.entries(raw_dist).map(([key, value]) => ({
      rating: parseInt(key),
      count: Number(value)
    }));
  }

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

      <div
        className="relative w-full max-w-4xl glass-modal border border-[var(--glass-border)] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: Tactical Briefing */}
        <div className="p-4 sm:p-6 border-b border-[var(--glass-border)] flex flex-col sm:flex-row sm:items-start justify-between bg-[var(--glass-bg)] gap-4 shrink-0">
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
        <div className="flex border-b border-[var(--glass-border)] overflow-x-auto bg-[var(--deep-ocean-card)]/30 px-2 shrink-0">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab(tab.id);
              }}
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
                        currency: hotel.price_info?.currency || hotel.currency || hotel.preferred_currency || "TRY",
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

          {activeTab === "offers" && (
            <div className="space-y-4">
              {(() => {
                // AGENT_FIX: Full fallback chain — price_info.offers (processed by backend) -> hotel-level market_offers/parity_offers/offers (raw from DB)
                const offers = (hotel?.price_info?.offers?.length ? hotel.price_info.offers : null)
                  || (hotel?.market_offers?.length ? hotel.market_offers : null)
                  || (hotel?.parity_offers?.length ? hotel.parity_offers : null)
                  || (hotel?.offers?.length ? hotel.offers : null)
                  || [];
                const displayCurrency = hotel?.price_info?.currency || hotel?.currency || hotel?.preferred_currency || "TRY";
                if (offers && offers.length > 0) {
                  return (
                    <div className="grid grid-cols-1 gap-4">
                      {offers.map((offer, index) => (
                        <div key={index} className="bg-[var(--glass-bg)] p-5 flex justify-between items-center group hover:bg-[var(--glass-bg-accent)] transition-all border border-[var(--glass-border)] hover:border-[var(--soft-gold)]/40 rounded-xl">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-[var(--deep-ocean-accent)] flex items-center justify-center border border-[var(--glass-border)] group-hover:border-[var(--soft-gold)]/30 transition-all">
                              <Tag className="w-5 h-5 text-[var(--soft-gold)]" />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest group-hover:text-[var(--soft-gold)] transition-colors">
                                {offer.vendor || offer.source || "Market Partner"}
                              </h4>
                              <p className="text-[10px] text-[var(--text-muted)] mt-1 uppercase font-bold tracking-tight opacity-60">
                                Market Partner
                              </p>
                            </div>
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
          )}

          {activeTab === "rooms" && (
            <div className="space-y-4">
              {(() => {
                // AGENT_FIX: Full fallback chain for room_types
                const room_types = (hotel?.price_info?.room_types?.length ? hotel.price_info.room_types : null)
                  || (hotel?.room_types?.length ? hotel.room_types : null)
                  || [];
                const displayCurrency = hotel?.price_info?.currency || hotel?.currency || hotel?.preferred_currency || "TRY";
                if (room_types && room_types.length > 0) {
                  return (
                    <div className="grid grid-cols-1 gap-4">
                      {room_types.map((room, index) => (
                        <div key={index} className="bg-[var(--glass-bg)] p-5 flex justify-between items-center group hover:bg-[var(--glass-bg-accent)] transition-all border border-[var(--glass-border)] hover:border-[var(--soft-gold)]/40 rounded-xl">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-[var(--deep-ocean-accent)] flex items-center justify-center border border-[var(--glass-border)] group-hover:border-[var(--soft-gold)]/30 transition-all">
                              <Building2 className="w-5 h-5 text-[var(--soft-gold)]" />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest group-hover:text-[var(--soft-gold)] transition-colors">
                                {room.name}
                              </h4>
                              <p className="text-[10px] text-[var(--text-muted)] mt-1 uppercase font-bold tracking-tight opacity-60">
                                Verified Specification
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-black text-[var(--soft-gold)] italic">
                              {new Intl.NumberFormat("en-US", {
                                style: "currency",
                                currency: displayCurrency,
                              }).format(parsePrice(room.price))}
                            </div>
                            <span className="text-[9px] text-optimal-green font-black uppercase tracking-widest mt-1 block">
                              {t("common.availableNow")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }
                return (
                  <div className="p-4 text-center text-slate-400 uppercase text-xs tracking-wider">
                    No room data available.
                  </div>
                );
              })()}
            </div>
          )}

          {activeTab === "reviews" && (
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
