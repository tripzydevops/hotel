"use client";

import {
  Cpu,
  Terminal,
  Zap,
  Radar,
  History,
  BrainCircuit,
  Activity,
  Globe,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";

export default function AgentPulseSidebar() {
  const [logs] = useState([
    {
      id: 1,
      type: "system",
      message: "Neural Kernel [v2.5] stabilized. Port 8080 open.",
      time: "12:35:01",
    },
    {
      id: 2,
      type: "scan",
      message:
        "Intelligence Capture: 12 competitor nodes synchronized in Antalya.",
      time: "12:38:12",
    },
    {
      id: 3,
      type: "agent",
      message:
        "Advisor 01: Preferred occupancy threshold breached. Adjusting strategy.",
      time: "12:40:05",
    },
    {
      id: 4,
      type: "logic",
      message:
        "Reasoning Engine: Probability of market shift increased to 85.4%.",
      time: "12:42:00",
    },
  ]);

  return (
    <aside className="h-screen hidden xl:flex flex-col bg-black/40 w-[340px] overflow-hidden border-l border-white/5 backdrop-blur-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] z-40">
      {/* Sidebar Aura */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--gold-glow)] opacity-10 blur-3xl pointer-events-none" />

      <div className="p-8 border-b border-white/5 bg-black/40">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-black text-white flex items-center gap-3 tracking-[0.4em] uppercase">
            <BrainCircuit
              size={16}
              className="text-[var(--gold-primary)] animate-pulse"
            />
            Neural_Feed
          </h3>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--gold-primary)]/10 border border-[var(--gold-primary)]/20">
            <div className="w-1 h-1 rounded-full bg-[var(--gold-primary)] animate-ping" />
            <span className="text-[8px] font-black text-[var(--gold-primary)] uppercase tracking-widest">
              Live
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-8 font-main text-xs custom-scrollbar">
        {logs.map((log) => (
          <div
            key={log.id}
            className="group relative pl-8 border-l border-white/10 py-2 hover:border-[var(--gold-primary)]/40 transition-all duration-700"
          >
            {/* Active Glow Line */}
            <div className="absolute -left-[1px] top-0 w-[2px] h-0 group-hover:h-full bg-[var(--gold-gradient)] transition-all duration-700 shadow-[0_0_15px_var(--gold-primary)]" />

            <div className="flex items-center justify-between mb-3 opacity-40 group-hover:opacity-100 transition-opacity">
              <span className="text-[8px] font-black text-[var(--text-muted)] tracking-[0.2em] uppercase">
                {log.time} UTC // SIG_{log.id}
              </span>
              <Activity size={10} className="text-[var(--gold-primary)]" />
            </div>

            <div className="space-y-3">
              <span
                className={`inline-block px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] ${getBadgeStyle(log.type)}`}
              >
                {log.type}_Protocol
              </span>
              <p className="text-[var(--text-muted)] group-hover:text-white transition-colors leading-relaxed font-bold text-[11px] tracking-tight">
                {log.message}
              </p>
            </div>

            {/* Node Interactive Pulse */}
            <div className="absolute top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Zap size={12} className="text-[var(--gold-primary)]" />
            </div>
          </div>
        ))}

        {/* Placeholder for more feed */}
        <div className="py-10 text-center opacity-20">
          <Radar className="w-8 h-8 mx-auto mb-4 animate-spin-slow text-[var(--gold-primary)]" />
          <p className="text-[8px] font-black uppercase tracking-[0.5em]">
            Scanning_Market_Deep_Field...
          </p>
        </div>
      </div>

      {/* Persistence Controls */}
      <div className="p-8 bg-black/60 border-t border-white/5 space-y-8">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-[0.4em] font-black opacity-60">
              AUTONOMOUS_LOAD
            </span>
            <span className="text-[10px] text-[var(--gold-primary)] font-black tracking-widest leading-none">
              94.2%_OPTIMAL
            </span>
          </div>
          <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5 shadow-inner p-[1px]">
            <div className="h-full bg-[var(--gold-gradient)] w-[94.2%] rounded-full shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all duration-1000"></div>
          </div>
        </div>

        <div className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all cursor-pointer group">
          <div className="p-2 rounded-xl bg-[var(--gold-primary)]/10 text-[var(--gold-primary)]">
            <ShieldCheck size={14} />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-white uppercase tracking-widest">
              Security_Protocol
            </span>
            <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest">
              Hardened_Status
            </span>
          </div>
          <Globe
            size={12}
            className="ml-auto text-white/20 group-hover:text-white transition-colors"
          />
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(212, 175, 55, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(212, 175, 55, 0.3);
        }
      `}</style>
    </aside>
  );
}

function getBadgeStyle(type: string) {
  switch (type) {
    case "system":
      return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
    case "scan":
      return "bg-purple-500/10 text-purple-400 border border-purple-500/20";
    case "agent":
      return "bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] border border-[var(--gold-primary)]/20";
    case "logic":
      return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    default:
      return "bg-white/10 text-white border border-white/20";
  }
}
