"use client";

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
  Zap,
  Sparkles,
  Target,
  BarChart3,
  Waves,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";

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
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl transition-all duration-500 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
    >
      <div className="relative w-full max-w-5xl premium-card shadow-[0_50px_100px_rgba(0,0,0,0.8)] flex flex-col max-h-[90vh] overflow-hidden bg-black/40 border-[var(--gold-primary)]/10">
        {/* Silk Glow Aura */}
        <div className="absolute -top-48 -right-48 w-96 h-96 bg-[var(--gold-glow)] opacity-10 blur-[150px] pointer-events-none" />

        {/* Header */}
        <div className="px-8 py-8 border-b border-white/5 flex flex-col sm:flex-row sm:items-start justify-between bg-black/40 backdrop-blur-3xl relative z-10 gap-6">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="absolute inset-0 bg-[var(--gold-primary)]/20 blur-xl rounded-2xl group-hover:blur-2xl transition-all" />
              {hotel.image_url ? (
                <img
                  src={hotel.image_url}
                  alt={hotel.name}
                  className="w-20 h-20 rounded-2xl object-cover border border-[var(--gold-primary)]/20 relative z-10 shadow-2xl"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center relative z-10">
                  <Building2 className="w-8 h-8 text-white/20" />
                </div>
              )}
              <div className="absolute -bottom-2 -right-2 bg-[var(--gold-gradient)] p-1.5 rounded-lg text-black shadow-xl z-20">
                <Target className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-[var(--gold-primary)] bg-[var(--gold-primary)]/10 px-2 py-0.5 rounded-md">
                  Deep_Analysis_Node
                </span>
                {hotel.stars && (
                  <div className="flex gap-0.5">
                    {[...Array(hotel.stars)].map((_, i) => (
                      <Sparkles
                        key={i}
                        size={10}
                        className="text-[var(--gold-primary)]"
                      />
                    ))}
                  </div>
                )}
              </div>
              <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-none border-b border-transparent hover:border-[var(--gold-primary)]/20 transition-all cursor-default">
                {hotel.name}
              </h2>
              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                  <Waves className="w-3 h-3 text-[var(--gold-primary)]" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                    {hotel.location}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 rounded-2xl hover:bg-white/5 text-[var(--text-muted)] hover:text-white transition-all group"
          >
            <X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
          </button>
        </div>

        {/* Global Tabs Navigation */}
        <div className="flex px-4 border-b border-white/5 bg-black/20 overflow-x-auto custom-scrollbar no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                flex items-center gap-3 px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative
                ${
                  activeTab === tab.id
                    ? "text-[var(--gold-primary)]"
                    : "text-[var(--text-muted)] hover:text-white"
                }
              `}
            >
              <tab.icon
                className={`w-4 h-4 transition-transform ${activeTab === tab.id ? "scale-125" : "group-hover:scale-110"}`}
              />
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-6 right-6 h-[3px] bg-[var(--gold-gradient)] rounded-t-full shadow-[0_0_15px_var(--gold-primary)]" />
              )}
            </button>
          ))}
        </div>

        {/* High-Octane Content Area */}
        <div className="flex-1 overflow-y-auto p-10 bg-[var(--bg-deep)] custom-scrollbar">
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
                <div className="lg:col-span-3 space-y-8">
                  <div className="premium-card p-10 bg-black/40 border-[var(--gold-primary)]/20 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                      <BarChart3
                        size={120}
                        className="text-[var(--gold-primary)]"
                      />
                    </div>
                    <h3 className="text-[10px] font-black text-[var(--gold-primary)] uppercase tracking-[0.4em] mb-6 flex items-center gap-3">
                      <Zap className="w-4 h-4 animate-pulse" />
                      Live_Market_Valuation
                    </h3>
                    <div className="flex items-baseline gap-4 mb-4">
                      <span className="text-7xl font-black text-white tracking-tighter">
                        {api.formatCurrency(
                          hotel.price_info?.current_price || 0,
                          hotel.price_info?.currency || "USD",
                        )}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest leading-none mb-1">
                          Base_Unit
                        </span>
                        <span className="text-sm font-bold text-white/40">
                          / {t("common.perNight")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 pt-6 border-t border-white/5">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest opacity-60">
                          Source_Node
                        </span>
                        <span className="text-xs font-bold text-[var(--gold-primary)]">
                          {hotel.price_info?.vendor || "Nexus_Intelligence"}
                        </span>
                      </div>
                      <div className="w-[1px] h-8 bg-white/10" />
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest opacity-60">
                          Sync_Protocol
                        </span>
                        <span className="text-xs font-bold text-emerald-500">
                          OPTIMIZED_LIVE
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white/[0.03] p-8 rounded-3xl border border-white/5 space-y-6">
                    <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em] border-b border-white/5 pb-4">
                      Intel_Matrix_Summary
                    </h3>
                    <div className="space-y-6">
                      {[
                        {
                          label: t("hotelDetails.amenitiesCount"),
                          value: hotel.amenities?.length || 0,
                          icon: List,
                        },
                        {
                          label: t("hotelDetails.offersCount"),
                          value: hotel.price_info?.offers?.length || 0,
                          icon: Tag,
                        },
                        {
                          label: t("hotelDetails.imagesCount"),
                          value: hotel.images?.length || 0,
                          icon: ImageIcon,
                        },
                      ].map((stat, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center group/stat"
                        >
                          <div className="flex items-center gap-3">
                            <stat.icon className="w-4 h-4 text-[var(--gold-primary)] opacity-40 group-hover/stat:opacity-100 transition-opacity" />
                            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">
                              {stat.label}
                            </span>
                          </div>
                          <span className="text-xl font-black text-white tracking-tight">
                            {stat.value}
                          </span>
                        </div>
                      ))}
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-in fade-in duration-500">
                {(hotel.images || []).map((img, idx) => (
                  <div
                    key={idx}
                    className="aspect-video rounded-2xl overflow-hidden bg-black/40 border border-white/5 relative group cursor-pointer shadow-2xl"
                  >
                    <img
                      src={img.original || img.thumbnail}
                      alt={`Gallery ${idx}`}
                      className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:rotate-1"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                      <div className="p-3 bg-white/10 rounded-full border border-white/20">
                        <ImageIcon className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                ))}
                {(!hotel.images || hotel.images.length === 0) && (
                  <div className="col-span-full py-24 text-center">
                    <ImageIcon className="w-16 h-16 text-white/5 mx-auto mb-6" />
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.4em]">
                      {t("hotelDetails.noImages")}
                    </p>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in duration-500">
                {(hotel.amenities || []).map((amenity, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-[var(--gold-primary)]/20 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[var(--gold-primary)]/10 flex items-center justify-center shrink-0 border border-[var(--gold-primary)]/10 group-hover:bg-[var(--gold-primary)]/20 transition-colors">
                      <Check className="w-4 h-4 text-[var(--gold-primary)]" />
                    </div>
                    <span className="text-[11px] font-black text-white/80 uppercase tracking-tight">
                      {amenity}
                    </span>
                  </div>
                ))}
                {(!hotel.amenities || hotel.amenities.length === 0) && (
                  <div className="col-span-full py-24 text-center">
                    <List className="w-16 h-16 text-white/5 mx-auto mb-6" />
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.4em]">
                      {t("hotelDetails.noAmenities")}
                    </p>
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
              <div className="overflow-hidden rounded-3xl border border-white/5 bg-black/40 shadow-2xl animate-in fade-in duration-500">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 text-[var(--text-muted)] border-b border-white/5">
                    <tr>
                      <th className="px-8 py-5 font-black uppercase tracking-widest">
                        {t("hotelDetails.vendor")}
                      </th>
                      <th className="px-8 py-5 text-right font-black uppercase tracking-widest">
                        {t("hotelDetails.price")}
                      </th>
                      <th className="px-8 py-5 text-right font-black uppercase tracking-widest">
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
                          className="group hover:bg-white/[0.03] transition-colors"
                        >
                          <td className="px-8 py-6 font-black text-white uppercase tracking-tight">
                            {offer.vendor || "Nexus_Internal"}
                          </td>
                          <td className="px-8 py-6 text-right font-bold text-white/60">
                            {api.formatCurrency(
                              offer.price || 0,
                              hotel.price_info?.currency || "USD",
                            )}
                          </td>
                          <td className="px-8 py-6 text-right">
                            <span
                              className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black tracking-widest font-mono ${diff > 0 ? "bg-red-500/10 text-red-500" : diff < 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-white/5 text-[var(--text-muted)]"}`}
                            >
                              {diff > 0 ? "+" : ""}
                              {diff.toFixed(0)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {(!hotel.price_info?.offers ||
                  hotel.price_info.offers.length === 0) && (
                  <div className="p-24 text-center">
                    <Tag className="w-16 h-16 text-white/5 mx-auto mb-6" />
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.4em]">
                      {t("hotelDetails.noOffers")}
                    </p>
                  </div>
                )}
              </div>
            </LockedFeature>
          )}

          {/* ROOM TYPES TAB (Locked) */}
          {activeTab === "rooms" && (
            <LockedFeature
              isEnterprise={isEnterprise}
              onUpgrade={onUpgrade}
              title={t("hotelDetails.lockedTitle").replace(
                "{0}",
                t("hotelDetails.rooms"),
              )}
              description={t("hotelDetails.lockedDesc")}
            >
              <div className="grid grid-cols-1 gap-6 animate-in fade-in duration-500">
                {(hotel.price_info?.room_types || []).map((room, idx) => (
                  <div
                    key={idx}
                    className="premium-card p-8 flex justify-between items-center group hover:bg-white/5 transition-all border border-white/5 hover:border-[var(--gold-primary)]/20"
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:border-[var(--gold-primary)]/20 transition-all">
                        <Building2 className="w-8 h-8 text-[var(--gold-primary)] opacity-40 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-white uppercase tracking-tight group-hover:text-[var(--gold-primary)] transition-colors">
                          {room.name || "Precision_Standard_Unit"}
                        </h4>
                        <div className="flex items-center gap-2 mt-2">
                          <Zap className="w-3 h-3 text-[var(--gold-primary)]" />
                          <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                            Found_via_Property_Direct
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-black text-[var(--gold-primary)] uppercase tracking-widest mb-1 block">
                        Live_Valuation
                      </span>
                      <div className="text-3xl font-black text-white tracking-tighter bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
                        {api.formatCurrency(
                          room.price || 0,
                          room.currency || hotel.price_info?.currency || "USD",
                        )}
                      </div>
                      <div className="flex items-center justify-end gap-2 mt-2">
                        <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] text-emerald-500 font-black uppercase tracking-widest">
                          Inventory_Confirmed
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {(!hotel.price_info?.room_types ||
                  hotel.price_info.room_types.length === 0) && (
                  <div className="py-24 text-center">
                    <Building2 className="w-16 h-16 text-white/5 mx-auto mb-6" />
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.4em]">
                      {t("hotelDetails.noRooms")}
                    </p>
                  </div>
                )}
              </div>
            </LockedFeature>
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
    <div className="relative overflow-hidden rounded-[40px] border border-white/10 bg-black/40 p-16 text-center min-h-[450px] flex flex-col items-center justify-center shadow-2xl group">
      {/* Blurry Background Mockup */}
      <div className="absolute inset-0 opacity-10 blur-xl pointer-events-none select-none overflow-hidden group-hover:opacity-20 transition-opacity">
        <div className="grid grid-cols-4 gap-6 p-8">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="h-32 bg-white/20 rounded-3xl border border-white/10"
            ></div>
          ))}
        </div>
      </div>

      <div className="relative z-10 max-w-lg mx-auto">
        <div className="relative mb-10">
          <div className="absolute inset-0 bg-[var(--gold-primary)]/20 blur-2xl rounded-full scale-150" />
          <div className="relative w-20 h-20 rounded-3xl bg-black border border-[var(--gold-primary)]/40 flex items-center justify-center mx-auto text-[var(--gold-primary)] transform group-hover:scale-110 transition-transform duration-700">
            <Lock className="w-10 h-10" />
          </div>
        </div>
        <h3 className="text-3xl font-black text-white mb-4 tracking-tighter uppercase italic">
          {title}
        </h3>
        <p className="text-[var(--text-muted)] mb-10 text-xs font-bold uppercase tracking-widest leading-relaxed">
          {description}
        </p>
        <button
          onClick={onUpgrade}
          className="btn-premium px-12 py-5 w-full group/btn relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
          <div className="relative z-10 flex items-center justify-center gap-3">
            <Zap className="w-5 h-5 text-black" />
            <span className="font-black uppercase tracking-[0.2em]">
              {t("hotelDetails.unlockButton")}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
