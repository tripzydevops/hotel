"use client";

import { HotelWithPrice } from "@/types";
import { useState } from "react";
import {
  Building2,
  X,
  Image as ImageIcon,
  List,
  Tag,
  Star,
  MapPin,
} from "lucide-react";
import FallbackImage from "@/components/ui/FallbackImage";
import { useI18n } from "@/lib/i18n";

import { useHotelDetailsData } from "@/hooks/useHotelDetailsData";
import { TabOverview } from "./tabs/TabOverview";
import { TabGallery } from "./tabs/TabGallery";
import { TabAmenities } from "./tabs/TabAmenities";
import { TabOffers } from "./tabs/TabOffers";
import { TabRooms } from "./tabs/TabRooms";
import { TabReviews } from "./tabs/TabReviews";
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
  const [showStandardInRooms, setShowStandardInRooms] = useState(true);

  const {
    other_sites_reviews,
    sentiment_breakdown,
    guest_mentions,
    rating_distribution,
    normalizedImages
  } = useHotelDetailsData(hotel);

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
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
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
          {activeTab === "overview" && <TabOverview hotel={hotel} rating_distribution={rating_distribution} t={t} />}
          {activeTab === "gallery" && <TabGallery normalizedImages={normalizedImages} t={t} />}
          {activeTab === "amenities" && <TabAmenities hotel={hotel} t={t} />}
          {activeTab === "offers" && <TabOffers hotel={hotel} />}
          {activeTab === "rooms" && <TabRooms hotel={hotel} t={t} />}
          {activeTab === "reviews" && <TabReviews other_sites_reviews={other_sites_reviews} sentiment_breakdown={sentiment_breakdown} guest_mentions={guest_mentions} t={t} />}
        </div>
      </div>
    </div>
  );
}
