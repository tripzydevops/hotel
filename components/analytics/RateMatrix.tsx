"use client";

import React from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

const DATA = [
  {
    date: "Oct 24, Tue",
    official: 245,
    booking: 245,
    expedia: 238,
    agoda: 245,
    hotels: 245,
  },
  {
    date: "Oct 25, Wed",
    official: 245,
    booking: 245,
    expedia: 245,
    agoda: 220,
    hotels: 245,
  },
  {
    date: "Oct 26, Thu",
    official: 260,
    booking: 248,
    expedia: 248,
    agoda: 260,
    hotels: 255,
  },
  {
    date: "Oct 27, Fri",
    official: 295,
    booking: 295,
    expedia: 295,
    agoda: 295,
    hotels: 295,
  },
  {
    date: "Oct 28, Sat",
    official: 310,
    booking: 310,
    expedia: 310,
    agoda: 310,
    hotels: 280,
  },
];

export default function RateMatrix() {
  return (
    <div className="card-blur rounded-[2.5rem] p-8 flex-grow">
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
            <tr className="border-b border-white/5 text-left">
              <th className="py-4 pl-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold w-32">
                Date
              </th>
              <th className="py-4 text-[10px] uppercase tracking-widest text-[#F6C344] font-bold bg-[#0A1629]/50 rounded-t-lg text-center border-b-2 border-[#F6C344]">
                Direct Official
              </th>
              <th className="py-4 text-[10px] uppercase tracking-widest text-slate-400 font-bold text-center">
                Booking.com
              </th>
              <th className="py-4 text-[10px] uppercase tracking-widest text-slate-400 font-bold text-center">
                Expedia
              </th>
              <th className="py-4 text-[10px] uppercase tracking-widest text-slate-400 font-bold text-center">
                Agoda
              </th>
              <th className="py-4 text-[10px] uppercase tracking-widest text-slate-400 font-bold text-center">
                Hotels.com
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {DATA.map((row, idx) => (
              <tr key={idx} className="group hover:bg-white/5 transition-all">
                <td className="py-4 pl-4 font-semibold text-white">
                  {row.date}
                </td>
                <td className="py-4 text-center font-bold text-white bg-[#0A1629]/30 border-l border-r border-white/5">
                  ${row.official}.00
                </td>
                <td className="py-4 text-center">
                  <ParityStatus price={row.booking} target={row.official} />
                </td>
                <td className="py-4 text-center">
                  <ParityStatus price={row.expedia} target={row.official} />
                </td>
                <td className="py-4 text-center">
                  <ParityStatus price={row.agoda} target={row.official} />
                </td>
                <td className="py-4 text-center">
                  <ParityStatus price={row.hotels} target={row.official} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ParityStatus({ price, target }: { price: number; target: number }) {
  const isUndercut = price < target;
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${
        isUndercut
          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
          : "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
      }`}
    >
      {isUndercut ? (
        <AlertTriangle className="w-3.5 h-3.5" />
      ) : (
        <CheckCircle2 className="w-3.5 h-3.5" />
      )}
      ${price}
    </div>
  );
}
