"use client";

import React, { useState, useMemo } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Filter,
  ChevronDown,
  Building2,
} from "lucide-react";
import { HotelWithPrice } from "@/types";

interface RateMatrixProps {
  targetHotel?: HotelWithPrice | null;
  competitors?: HotelWithPrice[];
}

const DEFAULT_OTA_COUNT = 6;

export default function RateMatrix({
  targetHotel,
  competitors = [],
}: RateMatrixProps) {
  const targetPrice = targetHotel?.price_info?.current_price || 0;
  const currency = targetHotel?.price_info?.currency || "TRY";

  // State for selected hotels
  const [selectedHotels, setSelectedHotels] = useState<string[]>([]);
  const [showHotelFilter, setShowHotelFilter] = useState(false);

  // State for selected OTAs
  const [selectedOTAs, setSelectedOTAs] = useState<string[]>([]);
  const [showOTAFilter, setShowOTAFilter] = useState(false);

  // Filtered hotels (Competitors + Target)
  const displayedHotels = useMemo(() => {
    // Start with competitors
    let list = [...competitors];

    // Prepend target hotel if it exists and isn't already in the list
    if (targetHotel && !list.find((h) => h.id === targetHotel.id)) {
      list = [targetHotel, ...list];
    }

    if (selectedHotels.length === 0) {
      return list;
    }
    return list.filter((c) => selectedHotels.includes(c.id));
  }, [selectedHotels, competitors, targetHotel]);

  // Discover all unique OTAs from target hotel and all competitors
  const allOTAs = useMemo(() => {
    const otaMap = new Map<string, { vendor: string; count: number }>();

    // Collect from target hotel
    const targetOffers = targetHotel?.price_info?.offers || [];
    targetOffers.forEach((o) => {
      if (o.vendor) {
        const key = o.vendor.toLowerCase();
        const existing = otaMap.get(key);
        otaMap.set(key, {
          vendor: o.vendor,
          count: (existing?.count || 0) + 1,
        });
      }
    });

    // Collect from ALL competitors (not just displayed)
    competitors.forEach((comp) => {
      const offers = comp.price_info?.offers || [];
      offers.forEach((o) => {
        if (o.vendor) {
          const key = o.vendor.toLowerCase();
          const existing = otaMap.get(key);
          otaMap.set(key, {
            vendor: o.vendor,
            count: (existing?.count || 0) + 1,
          });
        }
      });
    });

    // Sort by frequency (most common OTAs first)
    return Array.from(otaMap.values())
      .sort((a, b) => b.count - a.count)
      .map((o) => o.vendor);
  }, [targetHotel, competitors]);

  // Use selected OTAs or default to first 6
  const displayedOTAs = useMemo(() => {
    if (selectedOTAs.length > 0) {
      return selectedOTAs;
    }
    return allOTAs.slice(0, DEFAULT_OTA_COUNT);
  }, [selectedOTAs, allOTAs]);

  const formatPrice = (price?: number) => {
    if (!price) return "—";
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  const toggleOTA = (ota: string) => {
    setSelectedOTAs((prev) => {
      if (prev.includes(ota)) {
        return prev.filter((o) => o !== ota);
      }
      return [...prev, ota];
    });
  };

  const toggleHotel = (hotelId: string) => {
    setSelectedHotels((prev) => {
      const exists = prev.includes(hotelId);
      if (exists) {
        return prev.filter((h) => h !== hotelId);
      }
      if (prev.length >= 5) return prev;
      return [...prev, hotelId];
    });
  };

  const clearOTAFilter = () => {
    setSelectedOTAs([]);
    setShowOTAFilter(false);
  };

  const clearHotelFilter = () => {
    setSelectedHotels([]);
    setShowHotelFilter(false);
  };

  return (
    <div className="card-blur rounded-[2.5rem] p-8 flex-grow border border-white/5 shadow-2xl">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white">
              Rate Comparison Matrix
            </h2>
          </div>
          {/* Legend */}
          <div className="flex gap-2">
            <span className="text-[10px] flex items-center gap-1 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> In
              Parity
            </span>
            <span className="text-[10px] flex items-center gap-1 text-slate-400 ml-3">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>{" "}
              Undercut
            </span>
          </div>
        </div>

        {/* Filter Row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Stats badges - Displays how many items are currently visible vs total available */}
          <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-1 rounded-full">
            Showing {displayedHotels.length} Hotels
          </span>
          <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-1 rounded-full">
            Showing {displayedOTAs.length} of {allOTAs.length} OTAs
          </span>

          <div className="flex-1" />

          {/* Hotel Filter Button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowHotelFilter(!showHotelFilter);
                setShowOTAFilter(false);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                selectedHotels.length > 0
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
              }`}
            >
              <Building2 className="w-3 h-3" />
              Hotels
              <ChevronDown
                className={`w-3 h-3 transition-transform ${showHotelFilter ? "rotate-180" : ""}`}
              />
            </button>

            {/* Hotel Filter Dropdown */}
            {showHotelFilter && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-[#0a0a14] border border-white/10 rounded-xl shadow-2xl z-50 p-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Select Hotels to Display
                  </span>
                  {selectedHotels.length > 0 && (
                    <button
                      onClick={clearHotelFilter}
                      className="text-[9px] text-rose-400 hover:text-rose-300"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {competitors.map((hotel) => (
                    <label
                      key={hotel.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={
                          selectedHotels.length === 0 ||
                          selectedHotels.includes(hotel.id)
                        }
                        onChange={() => {
                          if (selectedHotels.length === 0) {
                            // Initialize with all except this one (max 5)
                            setSelectedHotels(
                              competitors
                                .filter((c) => c.id !== hotel.id)
                                .slice(0, 5)
                                .map((c) => c.id),
                            );
                          } else {
                            toggleHotel(hotel.id);
                          }
                        }}
                        className="w-3 h-3 rounded accent-blue-500"
                      />
                      <span className="text-xs text-white truncate">
                        {hotel.name}
                      </span>
                    </label>
                  ))}
                </div>
                {competitors.length === 0 && (
                  <p className="text-[10px] text-slate-500 text-center py-4">
                    No competitor hotels available.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* OTA Filter Button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowOTAFilter(!showOTAFilter);
                setShowHotelFilter(false);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                selectedOTAs.length > 0
                  ? "bg-[#F6C344]/20 text-[#F6C344] border border-[#F6C344]/30"
                  : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
              }`}
            >
              <Filter className="w-3 h-3" />
              OTAs
              <ChevronDown
                className={`w-3 h-3 transition-transform ${showOTAFilter ? "rotate-180" : ""}`}
              />
            </button>

            {/* OTA Filter Dropdown */}
            {showOTAFilter && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-[#0a0a14] border border-white/10 rounded-xl shadow-2xl z-50 p-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Select OTAs to Display
                  </span>
                  {selectedOTAs.length > 0 && (
                    <button
                      onClick={clearOTAFilter}
                      className="text-[9px] text-rose-400 hover:text-rose-300"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {allOTAs.map((ota) => (
                    <label
                      key={ota}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={
                          selectedOTAs.includes(ota) ||
                          (selectedOTAs.length === 0 &&
                            displayedOTAs.includes(ota))
                        }
                        onChange={() => {
                          if (selectedOTAs.length === 0) {
                            // Initialize with current displayed minus the toggled one
                            setSelectedOTAs(
                              displayedOTAs.filter((o) => o !== ota),
                            );
                          } else {
                            toggleOTA(ota);
                          }
                        }}
                        className="w-3 h-3 rounded accent-[#F6C344]"
                      />
                      <span className="text-xs text-white truncate">{ota}</span>
                    </label>
                  ))}
                </div>
                {allOTAs.length === 0 && (
                  <p className="text-[10px] text-slate-500 text-center py-4">
                    No OTA data available. Run a scan to populate.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-slate-500">
              <th className="py-4 pl-4 text-[10px] uppercase tracking-widest font-bold w-48 sticky left-0 bg-[#0A1629]/80 backdrop-blur-sm z-10">
                Hotel/Source
              </th>
              <th className="py-4 text-[10px] uppercase tracking-widest text-[#F6C344] font-bold bg-[#0A1629]/50 text-center border-b-2 border-[#F6C344] min-w-[100px]">
                Target Price
              </th>
              {/* Dynamic OTA Columns */}
              {displayedOTAs.map((ota) => (
                <th
                  key={ota}
                  className="py-4 text-[10px] uppercase tracking-widest font-bold text-center min-w-[100px]"
                >
                  {ota}
                </th>
              ))}
              <th className="py-4 text-[10px] uppercase tracking-widest font-bold text-center min-w-[100px]">
                Final Rate
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {displayedHotels.map((comp, idx) => {
              const compPrice = comp.price_info?.current_price;
              const offers = comp.price_info?.offers || [];
              const isTarget = targetHotel && comp.id === targetHotel.id;

              return (
                <tr
                  key={comp.id || idx}
                  className={`group hover:bg-white/5 transition-all ${isTarget ? "bg-blue-500/5 hover:bg-blue-500/10" : ""}`}
                >
                  <td className="py-5 pl-4 flex items-center gap-3 sticky left-0 bg-[#050B18]/90 backdrop-blur-sm z-10">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center border ${isTarget ? "bg-blue-500/20 border-blue-500/30" : "bg-white/5 border-white/5"}`}
                    >
                      <span
                        className={`text-[10px] font-bold ${isTarget ? "text-blue-400" : "text-slate-500"}`}
                      >
                        #{idx + 1}
                      </span>
                    </div>
                    <div>
                      <p
                        className={`font-bold text-xs ${isTarget ? "text-blue-400" : "text-white"}`}
                      >
                        {comp.name}
                      </p>
                      <p className="text-[9px] text-slate-500 uppercase tracking-tighter">
                        {isTarget ? "My Hotel" : "Competitor"}
                      </p>
                    </div>
                  </td>
                  <td className="py-5 text-center font-bold text-white bg-[#0A1629]/30 border-l border-r border-white/5">
                    {formatPrice(targetPrice)}
                  </td>
                  {/* Dynamic OTA Cells */}
                  {displayedOTAs.map((ota) => {
                    const offer = offers.find(
                      (o) => o.vendor?.toLowerCase() === ota.toLowerCase(),
                    );
                    return (
                      <td key={ota} className="py-5 text-center">
                        <ParityStatus
                          price={offer?.price}
                          target={targetPrice}
                          formatPrice={formatPrice}
                        />
                      </td>
                    );
                  })}
                  <td className="py-5 text-center">
                    <ParityStatus
                      price={compPrice}
                      target={targetPrice}
                      formatPrice={formatPrice}
                      label="Final"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {displayedHotels.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-slate-500">No competitor data available</p>
          <p className="text-xs text-slate-600 mt-1">
            {selectedHotels.length > 0
              ? "Clear the hotel filter or select different hotels"
              : "Run a scan to populate the matrix"}
          </p>
        </div>
      )}
    </div>
  );
}

function ParityStatus({
  price,
  target,
  formatPrice,
  label,
}: {
  price?: number;
  target: number;
  formatPrice: (p: number) => string;
  label?: string;
}) {
  if (!price) return <span className="text-slate-700">—</span>;

  const isUndercut = price < target;
  return (
    <div
      className={`inline-flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl border transition-all ${
        isUndercut
          ? "bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.1)]"
          : "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
      }`}
    >
      <div className="flex items-center gap-1">
        {isUndercut ? (
          <AlertTriangle className="w-3 h-3 animate-pulse" />
        ) : (
          <CheckCircle2 className="w-3 h-3" />
        )}
        <span className="font-bold tracking-tighter">{formatPrice(price)}</span>
      </div>
      {label && (
        <span className="text-[8px] uppercase font-black opacity-50 tracking-widest">
          {label}
        </span>
      )}
    </div>
  );
}
