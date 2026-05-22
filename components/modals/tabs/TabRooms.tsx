import { useState } from "react";
import { Building2, Sparkles, SlidersHorizontal, Wifi, Coffee, ShieldCheck } from "lucide-react";
import { HotelWithPrice } from "@/types";
import { parsePrice, resolveOtaName } from "@/lib/utils";
import { getStandardizedRoomCategory } from "@/utils/roomNormalization";

interface TabRoomsProps {
  hotel: HotelWithPrice;
  t: (key: string) => string;
}

export function TabRooms({ hotel, t }: TabRoomsProps) {
  const [showStandardInRooms, setShowStandardInRooms] = useState(true);

  return (
            <div className="space-y-4">
              {(() => {
                // AGENT_FIX: Full fallback chain with cleaning and deduplication
                const raw_rooms = (hotel?.price_info?.room_types?.length ? hotel.price_info.room_types : null)
                  || (hotel?.room_types?.length ? hotel.room_types : null)
                  || [];

                // 1. Map and ensure fallback to "Standard Room"
                const processedRooms = raw_rooms.map((room: any) => {
                  if (typeof room === "string") {
                    return { name: room.trim() || "Standard Room" };
                  }
                  if (!room) {
                    return { name: "Standard Room" };
                  }
                  let name = (room.original_name || room.name || room.room_type || "").toString().trim();
                  if (!name) name = "Standard Room";
                  return { ...room, name };
                });

                // 2. Deduplicate by Name + Price + Source
                const seenKeys = new Set<string>();
                const room_types: any[] = [];
                processedRooms.forEach((room: any) => {
                  const normPrice = parsePrice(room.price);
                  const key = `${room.name.toLowerCase()}_${normPrice}_${((room as any).source || "").toLowerCase()}`.trim();
                  if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    room_types.push(room);
                  }
                });
                const displayCurrency = hotel?.price_info?.currency || hotel?.preferred_currency || "TRY";

                const isStandardRoom = (name?: string) => {
                  return getStandardizedRoomCategory(name || "") === "Standard";
                };

                const getRoomCategory = (name?: string) => {
                  const lower = (name || "").toLowerCase();
                  if (lower.includes("suite") || lower.includes("süit") || lower.includes("penthouse") || lower.includes("presidential") || lower.includes("royal")) {
                    return {
                      label: "Suite / Elite",
                      badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/20",
                      glowClass: "border-amber-500/20 hover:border-amber-500/50 shadow-lg shadow-amber-500/[0.02]",
                      iconBg: "bg-amber-500/10 border-amber-500/30 text-amber-300",
                    };
                  }
                  if (lower.includes("deluxe") || lower.includes("delüks") || lower.includes("luxury")) {
                    return {
                      label: "Deluxe",
                      badgeClass: "bg-rose-500/10 text-rose-300 border-rose-500/20",
                      glowClass: "border-rose-500/20 hover:border-rose-500/50 shadow-lg shadow-rose-500/[0.02]",
                      iconBg: "bg-rose-500/10 border-rose-500/30 text-rose-300",
                    };
                  }
                  if (lower.includes("executive") || lower.includes("club") || lower.includes("villa")) {
                    return {
                      label: "Executive",
                      badgeClass: "bg-violet-500/10 text-violet-300 border-violet-500/20",
                      glowClass: "border-violet-500/20 hover:border-violet-500/50 shadow-lg shadow-violet-500/[0.02]",
                      iconBg: "bg-violet-500/10 border-violet-500/30 text-violet-300",
                    };
                  }
                  if (lower.includes("superior") || lower.includes("süperior") || lower.includes("premium")) {
                    return {
                      label: "Superior",
                      badgeClass: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
                      glowClass: "border-indigo-500/20 hover:border-indigo-500/50 shadow-lg shadow-indigo-500/[0.02]",
                      iconBg: "bg-indigo-500/10 border-indigo-500/30 text-indigo-300",
                    };
                  }
                  if (lower.includes("family") || lower.includes("aile") || lower.includes("connecting") || lower.includes("studio")) {
                    return {
                      label: "Family / Studio",
                      badgeClass: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
                      glowClass: "border-emerald-500/20 hover:border-emerald-500/50 shadow-lg shadow-emerald-500/[0.02]",
                      iconBg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
                    };
                  }
                  const isStd = isStandardRoom(name);
                  if (isStd) {
                    return {
                      label: "Base",
                      badgeClass: "bg-slate-500/10 text-slate-300 border-slate-500/20",
                      glowClass: "border-[var(--glass-border)] hover:border-[var(--soft-gold)]/30",
                      iconBg: "bg-[var(--deep-ocean-accent)] border-[var(--glass-border)] text-[var(--soft-gold)] group-hover:border-[var(--soft-gold)]/30",
                    };
                  }
                  return {
                    label: "Premium Option",
                    badgeClass: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
                    glowClass: "border-cyan-500/20 hover:border-cyan-500/50 shadow-lg shadow-cyan-500/[0.02]",
                    iconBg: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300",
                  };
                };

                const premiumRooms = room_types.filter(room => !isStandardRoom(room.name));
                const roomsToRender = showStandardInRooms ? room_types : premiumRooms;
                const hasStandardRoomsFiltered = room_types.length > premiumRooms.length;

                return (
                  <div className="space-y-4">
                    {/* Premium Filtering Control Banner */}
                    {hasStandardRoomsFiltered && (
                      <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-[var(--soft-gold)]/20 transition-all">
                        <div>
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-[var(--soft-gold)] animate-pulse" />
                            <h4 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
                              Smart Room Filtering Active
                            </h4>
                          </div>
                          <p className="text-xs text-[var(--text-muted)] mt-1">
                            {showStandardInRooms 
                              ? "Showing all room types (including standard base rooms)." 
                              : "Currently showing only premium upgrades and suite alternatives. Standard base rooms are hidden."}
                          </p>
                        </div>
                        <button
                          onClick={() => setShowStandardInRooms(!showStandardInRooms)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--deep-ocean-accent)] hover:bg-[var(--soft-gold)] hover:text-[var(--deep-ocean)] text-xs font-bold uppercase tracking-wider text-[var(--soft-gold)] transition-all border border-[var(--glass-border)] hover:border-transparent cursor-pointer"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          {showStandardInRooms ? "Hide Standard Rooms" : "Show All Rooms"}
                        </button>
                      </div>
                    )}

                    {roomsToRender.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4">
                        {roomsToRender.map((room, index) => {
                          const category = getRoomCategory(room.name);
                          
                          return (
                            <div 
                              key={index} 
                              className={`bg-[var(--glass-bg)] p-5 flex justify-between items-center group hover:bg-[var(--glass-bg-accent)] transition-all border rounded-xl ${category.glowClass}`}
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-all ${category.iconBg}`}>
                                  <Building2 className="w-5 h-5" />
                                </div>
                                {(() => {
                                  const ota = resolveOtaName((room as any).source);
                                  const r = room as any;
                                  const nameLower = (r.name || "").toLowerCase();
                                  
                                  // Smart dynamic feature extraction
                                  const hasWifi = r.attributes?.has_wifi ?? r.has_wifi ?? r.wifi ?? nameLower.includes("wifi");
                                  const hasBreakfast = r.attributes?.has_breakfast ?? r.has_breakfast ?? r.breakfast ?? (
                                    nameLower.includes("breakfast") || 
                                    nameLower.includes("kahvalt") || 
                                    nameLower.includes("bb")
                                  );
                                  const isRefundable = r.attributes?.is_refundable ?? r.is_refundable ?? r.refundable ?? (
                                    nameLower.includes("refundable") || 
                                    nameLower.includes("cancellation") || 
                                    nameLower.includes("iade") || 
                                    nameLower.includes("i̇ade")
                                  );

                                  return (
                                    <div className="space-y-2">
                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <h4 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest group-hover:text-[var(--soft-gold)] transition-colors">
                                            {room.name}
                                          </h4>
                                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border rounded ${category.badgeClass}`}>
                                            {category.label}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-[var(--text-muted)] mt-1 uppercase font-bold tracking-tight opacity-60">
                                          {ota.name} · {ota.type}
                                        </p>
                                      </div>

                                      {/* High-fidelity micro-attributes */}
                                      <div className="flex items-center gap-2 flex-wrap pt-1">
                                        {hasWifi && (
                                          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 shadow-sm shadow-indigo-500/[0.05]">
                                            <Wifi className="w-2.5 h-2.5" />
                                            WiFi
                                          </span>
                                        )}
                                        {hasBreakfast && (
                                          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 shadow-sm shadow-amber-500/[0.05]">
                                            <Coffee className="w-2.5 h-2.5" />
                                            Breakfast
                                          </span>
                                        )}
                                        {isRefundable && (
                                          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 shadow-sm shadow-emerald-500/[0.05]">
                                            <ShieldCheck className="w-2.5 h-2.5" />
                                            Refundable
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
                                  }).format(parsePrice(room.price))}
                                </div>
                                <span className="text-[9px] text-optimal-green font-black uppercase tracking-widest mt-1 block">
                                  {t("common.availableNow")}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] p-8 text-center rounded-xl space-y-4">
                        <div className="w-12 h-12 rounded-full bg-[var(--deep-ocean-accent)] flex items-center justify-center border border-[var(--glass-border)] mx-auto">
                          <Building2 className="w-6 h-6 text-[var(--soft-gold)]" />
                        </div>
                        <div className="max-w-xs mx-auto">
                          <h4 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
                            {room_types.length === 0 ? "No Room Data Available" : "No Premium Upgrades Detected"}
                          </h4>
                          <p className="text-xs text-[var(--text-muted)] mt-1">
                            {room_types.length === 0 
                              ? "We couldn't retrieve specific room types for this property yet. Please check again after the next automated scan."
                              : "Only standard room types are available for this property. Would you like to view the base room rates?"}
                          </p>
                        </div>
                        {room_types.length > 0 && (
                          <button
                            onClick={() => setShowStandardInRooms(true)}
                            className="px-4 py-2 bg-[var(--soft-gold)] text-[var(--deep-ocean)] text-xs font-black uppercase tracking-widest rounded-lg hover:bg-white transition-all cursor-pointer"
                          >
                            Show Base Room Rates
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
  );
}
