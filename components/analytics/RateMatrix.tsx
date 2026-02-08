"use client";

import React from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { HotelWithPrice } from "@/types";

interface RateMatrixProps {
  targetHotel?: HotelWithPrice | null;
  competitors?: HotelWithPrice[];
}

export default function RateMatrix({
  targetHotel,
  competitors = [],
}: RateMatrixProps) {
  const targetPrice = targetHotel?.price_info?.current_price || 0;
  const currency = targetHotel?.price_info?.currency || "TRY";

  // Build rows from competitors' parity_offers
  // For each competitor, we look at their offers (OTAs)
  // We'll create a row for each competitor for now, or match dates if we have multi-date data.
  // The current data structure has current_price and historical price_history.
  // Let's use the current parity_offers from the target hotel's logs if available,
  // or aggregate from competitors.

  const formatPrice = (price?: number) => {
    if (!price) return "—";
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="card-blur rounded-[2.5rem] p-8 flex-grow border border-white/5 shadow-2xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">Rate Comparison Matrix</h2>
        <div className="flex gap-2">
          <span className="text-[10px] flex items-center gap-1 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> In
            Parity
          </span>
          <span className="text-[10px] flex items-center gap-1 text-slate-400 ml-3">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span> Undercut
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-slate-500">
              <th className="py-4 pl-4 text-[10px] uppercase tracking-widest font-bold w-48">
                Hotel/Source
              </th>
              <th className="py-4 text-[10px] uppercase tracking-widest text-[#F6C344] font-bold bg-[#0A1629]/50 rounded-t-lg text-center border-b-2 border-[#F6C344]">
                Target Price
              </th>
              {/* Common OTAs */}
              <th className="py-4 text-[10px] uppercase tracking-widest font-bold text-center">
                Booking.com
              </th>
              <th className="py-4 text-[10px] uppercase tracking-widest font-bold text-center">
                Expedia
              </th>
              <th className="py-4 text-[10px] uppercase tracking-widest font-bold text-center">
                Agoda
              </th>
              <th className="py-4 text-[10px] uppercase tracking-widest font-bold text-center">
                Our Rate
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {competitors.map((comp, idx) => {
              const compPrice = comp.price_info?.current_price;

              // Map parity_offers if available
              const offers = comp.price_info?.offers || [];
              const booking = offers.find((o) =>
                o.vendor?.toLowerCase().includes("booking"),
              )?.price;
              const expedia = offers.find((o) =>
                o.vendor?.toLowerCase().includes("expedia"),
              )?.price;
              const agoda = offers.find((o) =>
                o.vendor?.toLowerCase().includes("agoda"),
              )?.price;

              return (
                <tr key={idx} className="group hover:bg-white/5 transition-all">
                  <td className="py-5 pl-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
                      <span className="text-[10px] font-bold text-slate-500">
                        #{idx + 1}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-white text-xs">
                        {comp.name}
                      </p>
                      <p className="text-[9px] text-slate-500 uppercase tracking-tighter">
                        Competitor
                      </p>
                    </div>
                  </td>
                  <td className="py-5 text-center font-bold text-white bg-[#0A1629]/30 border-l border-r border-white/5">
                    {formatPrice(targetPrice)}
                  </td>
                  <td className="py-5 text-center">
                    <ParityStatus
                      price={booking || compPrice}
                      target={targetPrice}
                      formatPrice={formatPrice}
                    />
                  </td>
                  <td className="py-5 text-center">
                    <ParityStatus
                      price={expedia}
                      target={targetPrice}
                      formatPrice={formatPrice}
                    />
                  </td>
                  <td className="py-5 text-center">
                    <ParityStatus
                      price={agoda}
                      target={targetPrice}
                      formatPrice={formatPrice}
                    />
                  </td>
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
