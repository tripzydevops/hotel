import { HotelWithPrice } from "@/types";
import { useState } from "react";
import {
  Building2,
  X,
  Image as ImageIcon,
  List,
  Tag,
  Lock,
  Check,
} from "lucide-react";
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

  const tabs = [
    { id: "overview", label: t("hotelDetails.overview"), icon: Building2 },
    { id: "gallery", label: t("hotelDetails.gallery"), icon: ImageIcon },
    { id: "amenities", label: t("hotelDetails.amenities"), icon: List },
    { id: "offers", label: t("hotelDetails.offers"), icon: Tag },
    { id: "rooms", label: t("hotelDetails.rooms"), icon: Building2 },
  ];

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isOpen ? "" : "hidden"}`}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-4xl bg-[var(--deep-ocean)] border border-white/10 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-white/10 flex flex-col sm:flex-row sm:items-start justify-between bg-white/5 gap-4">
          <div className="flex items-center gap-3 sm:gap-4 order-2 sm:order-1">
            {hotel.image_url ? (
              <img
                src={hotel.image_url}
                alt={hotel.name}
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover border border-white/10"
              />
            ) : (
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg bg-white/5 flex items-center justify-center">
                <Building2 className="w-6 h-6 sm:w-8 sm:h-8 text-white/20" />
              </div>
            )}
            <div>
              <h2 className="text-lg sm:text-2xl font-bold text-white max-w-[200px] sm:max-w-lg truncate leading-tight">
                {hotel.name}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[var(--text-muted)] mt-1">
                <span>{hotel.location}</span>
                {hotel.stars && (
                  <span>
                    •{" "}
                    {t("hotelDetails.stars").replace(
                      "{0}",
                      hotel.stars.toString(),
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="self-end sm:self-start p-2 rounded-full hover:bg-white/10 text-[var(--text-muted)] transition-colors order-1 sm:order-2"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                        flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap
                        ${
                          activeTab === tab.id
                            ? "border-[var(--soft-gold)] text-[var(--soft-gold)] bg-[var(--soft-gold)]/5"
                            : "border-transparent text-[var(--text-muted)] hover:text-white hover:bg-white/5"
                        }
                    `}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-[var(--deep-ocean)]">
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card p-6">
                  <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mb-4">
                    {t("hotelDetails.liveRates")}
                  </h3>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-4xl font-black text-white">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: hotel.price_info?.currency || "USD",
                      }).format(hotel.price_info?.current_price || 0)}
                    </span>
                    <span className="text-[var(--text-muted)] mb-1">
                      / {t("common.perNight")}
                    </span>
                  </div>
                  <div className="text-sm text-[var(--text-muted)]">
                    {t("hotelDetails.foundVia")}{" "}
                    {hotel.price_info?.vendor || "SerpApi"}
                  </div>
                </div>

                <div className="glass-card p-6">
                  <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mb-4">
                    {t("hotelDetails.intelSummary")}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">
                        {t("hotelDetails.amenitiesCount")}
                      </span>
                      <span className="text-white font-bold">
                        {hotel.amenities?.length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">
                        {t("hotelDetails.offersCount")}
                      </span>
                      <span className="text-white font-bold">
                        {hotel.price_info?.offers?.length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">
                        {t("hotelDetails.imagesCount")}
                      </span>
                      <span className="text-white font-bold">
                        {hotel.images?.length || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* GALLERIES TAB (Locked) */}
          {activeTab === "gallery" && (
            <LockedFeature
              isEnterprise={isEnterprise}
              onUpgrade={onUpgrade}
              title={t("hotelDetails.lockedTitle").replace(
                "{0}",
                t("hotelDetails.visualIntel"),
              )}
              description={t("hotelDetails.lockedDesc")}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {(hotel.images || []).map((img, idx) => (
                  <div
                    key={idx}
                    className="aspect-video rounded-lg overflow-hidden bg-white/5 relative group cursor-pointer"
                  >
                    <img
                      src={img.original || img.thumbnail}
                      alt={`Gallery ${idx}`}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-xs font-bold text-white bg-black/50 px-2 py-1 rounded">
                        {t("common.view")}
                      </span>
                    </div>
                  </div>
                ))}
                {(!hotel.images || hotel.images.length === 0) && (
                  <div className="col-span-full py-12 text-center text-[var(--text-muted)]">
                    {t("hotelDetails.noImages")}
                  </div>
                )}
              </div>
            </LockedFeature>
          )}

          {/* AMENITIES TAB (Locked) */}
          {activeTab === "amenities" && (
            <LockedFeature
              isEnterprise={isEnterprise}
              onUpgrade={onUpgrade}
              title={t("hotelDetails.lockedTitle").replace(
                "{0}",
                t("hotelDetails.featureAnalysis"),
              )}
              description={t("hotelDetails.lockedDesc")}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {(hotel.amenities || []).map((amenity, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/5"
                  >
                    <Check className="w-4 h-4 text-[var(--soft-gold)]" />
                    <span className="text-sm text-[var(--text-secondary)]">
                      {amenity}
                    </span>
                  </div>
                ))}
                {(!hotel.amenities || hotel.amenities.length === 0) && (
                  <div className="col-span-full py-12 text-center text-[var(--text-muted)]">
                    {t("hotelDetails.noAmenities")}
                  </div>
                )}
              </div>
            </LockedFeature>
          )}

          {/* OFFERS TAB (Locked) */}
          {activeTab === "offers" && (
            <LockedFeature
              isEnterprise={isEnterprise}
              onUpgrade={onUpgrade}
              title={t("hotelDetails.lockedTitle").replace(
                "{0}",
                t("hotelDetails.marketDepth"),
              )}
              description={t("hotelDetails.lockedDesc")}
            >
              <div className="overflow-hidden rounded-xl border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-[var(--text-muted)] font-medium">
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
                  <tbody className="divide-y divide-white/5">
                    {(hotel.price_info?.offers || []).map((offer, idx) => {
                      const diff =
                        (offer.price || 0) -
                        (hotel.price_info?.current_price || 0);
                      return (
                        <tr
                          key={idx}
                          className="group hover:bg-white/5 transition-colors"
                        >
                          <td className="p-4 font-medium text-white">
                            {offer.vendor || "Unknown"}
                          </td>
                          <td className="p-4 text-right text-[var(--text-secondary)]">
                            {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: hotel.price_info?.currency || "USD",
                            }).format(offer.price || 0)}
                          </td>
                          <td
                            className={`p-4 text-right font-bold ${diff > 0 ? "text-[var(--danger)]" : diff < 0 ? "text-[var(--success)]" : "text-[var(--text-muted)]"}`}
                          >
                            {diff > 0 ? "+" : ""}
                            {diff.toFixed(0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {(!hotel.price_info?.offers ||
                  hotel.price_info.offers.length === 0) && (
                  <div className="p-8 text-center text-[var(--text-muted)]">
                    {t("hotelDetails.noOffers")}
                  </div>
                )}
              </div>
            </LockedFeature>
          )}

          {/* ROOM TYPES TAB */}
          {activeTab === "rooms" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                {(hotel.price_info?.room_types || []).map((room, idx) => (
                  <div
                    key={idx}
                    className="glass-card p-4 flex justify-between items-center group hover:bg-white/5 transition-all border border-white/5 hover:border-[var(--soft-gold)]/30"
                  >
                    <div>
                      <h4 className="font-bold text-white group-hover:text-[var(--soft-gold)] transition-colors">
                        {room.name || "Standard Room"}
                      </h4>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        {t("hotelDetails.foundVia")} property
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-white">
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency:
                            room.currency ||
                            hotel.price_info?.currency ||
                            "USD",
                        }).format(room.price || 0)}
                      </div>
                      <span className="text-[10px] text-[var(--soft-gold)] font-bold uppercase tracking-wider">
                        {t("common.availableNow")}
                      </span>
                    </div>
                  </div>
                ))}
                {(!hotel.price_info?.room_types ||
                  hotel.price_info.room_types.length === 0) && (
                  <div className="py-12 text-center text-[var(--text-muted)] flex flex-col items-center gap-3">
                    <Building2 className="w-12 h-12 opacity-20" />
                    <p>{t("hotelDetails.noRooms")}</p>
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
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-8 text-center min-h-[300px] flex flex-col items-center justify-center">
      {/* Blurry Background Mockup */}
      <div className="absolute inset-0 opacity-10 blur-sm pointer-events-none select-none overflow-hidden">
        <div className="grid grid-cols-3 gap-4 p-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div key={i} className="h-24 bg-white/20 rounded-lg"></div>
          ))}
        </div>
      </div>

      <div className="relative z-10 max-w-sm mx-auto">
        <div className="w-12 h-12 rounded-full bg-[var(--soft-gold)]/20 flex items-center justify-center mx-auto mb-4 text-[var(--soft-gold)]">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-[var(--text-secondary)] mb-6 text-sm">
          {description}
        </p>
        <button onClick={onUpgrade} className="btn-gold px-8 py-3 w-full">
          {t("hotelDetails.unlockButton")}
        </button>
      </div>
    </div>
  );
}
