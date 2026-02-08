"use client";

import React from "react";
import { ArrowRight, X } from "lucide-react";

const VIOLATIONS = [
  {
    name: "Expedia",
    diff: "-5.2%",
    severity: "high",
    desc: "Consistent undercutting on weekends. Primarily affects Deluxe King rooms.",
    violations: "5 Violations",
    last: "2h ago",
  },
  {
    name: "Agoda",
    diff: "-8.5%",
    severity: "high",
    desc: "Flash sale detected. Deep undercut on October 25th.",
    violations: "1 Violation",
    last: "40m ago",
  },
  {
    name: "Hotels.com",
    diff: "-1.8%",
    severity: "low",
    desc: "Minor discrepancy. Likely currency conversion variance.",
    violations: "2 Violations",
    last: "5h ago",
  },
];

export default function ViolatingChannels() {
  return (
    <div className="card-blur rounded-[2.5rem] p-8 h-full bg-gradient-to-b from-[#0A1629]/80 to-[#050B18]">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-lg font-bold text-white">Violating Channels</h2>
        <span className="text-[10px] bg-rose-500/20 text-rose-400 px-3 py-1 rounded-full border border-rose-500/20 font-bold uppercase tracking-wide">
          High Priority
        </span>
      </div>

      <div className="space-y-6">
        {VIOLATIONS.map((v, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-2xl bg-[#050B18] border relative overflow-hidden group hover:border-rose-500 transition-colors cursor-pointer ${
              v.severity === "high"
                ? "border-rose-500/30"
                : "border-yellow-500/30 opacity-80 hover:border-yellow-500"
            }`}
          >
            <div
              className={`absolute left-0 top-0 bottom-0 w-1 ${v.severity === "high" ? "bg-rose-500" : "bg-yellow-500"}`}
            ></div>
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-white text-lg">{v.name}</h4>
              <span
                className={`${v.severity === "high" ? "text-rose-400" : "text-yellow-500"} font-bold text-sm`}
              >
                {v.diff}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-3">{v.desc}</p>
            <div className="flex gap-2">
              <span className="text-[10px] px-2 py-1 rounded bg-[#142541] text-slate-300">
                {v.violations}
              </span>
              <span className="text-[10px] px-2 py-1 rounded bg-[#142541] text-slate-300">
                Last: {v.last}
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 flex justify-end">
              {v.severity === "high" ? (
                <button className="text-[10px] font-bold uppercase text-[#F6C344] hover:text-white flex items-center gap-1">
                  Send Alert <ArrowRight className="w-3 h-3" />
                </button>
              ) : (
                <button className="text-[10px] font-bold uppercase text-slate-400 hover:text-white flex items-center gap-1">
                  Dismiss <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-8">
        <div className="p-4 bg-[#142541]/50 rounded-xl border border-white/5">
          <h5 className="text-xs font-bold text-[#F6C344] uppercase mb-2">
            Monitor Settings
          </h5>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-300">Threshold</span>
            <span className="text-xs font-bold text-white">2% Variance</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300">Auto-Alert</span>
            <span className="text-xs font-bold text-emerald-400">Enabled</span>
          </div>
        </div>
      </div>
    </div>
  );
}
