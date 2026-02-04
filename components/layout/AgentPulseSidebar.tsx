"use client";

import { Cpu, Terminal, Zap, Radar, History } from "lucide-react";
import { useEffect, useState } from "react";

export default function AgentPulseSidebar() {
  const [logs, setLogs] = useState([
    {
      id: 1,
      type: "system",
      message: "Kernel [v2.0] initialized successfully.",
      time: "10:45:01",
    },
    {
      id: 2,
      type: "scan",
      message:
        "Market scan [Istanbul-Sultanahmet] completed. 45 properties analyzed.",
      time: "10:45:12",
    },
    {
      id: 3,
      type: "agent",
      message:
        "Agent 01: Undercut detected at 'Grand Coastal'. Suggesting +5% ADR shift.",
      time: "10:46:05",
    },
    {
      id: 4,
      type: "logic",
      message:
        "Strategy Engine: Shifted to 'Aggressive Acquisition' mode based on occupancy forecast.",
      time: "10:47:00",
    },
  ]);

  // Simulated live logs (static for now, will be wired to backend later)
  useEffect(() => {
    // We can add interval simulation here if needed for WOW effect
  }, []);

  return (
    <aside className="h-screen hidden xl:flex flex-col bg-[#071529]/30 w-[320px] overflow-hidden border-l border-[var(--panel-border)] shadow-2xl">
      <div className="p-4 border-b border-[var(--panel-border)] bg-[#071529]">
        <h3 className="text-xs font-bold text-white flex items-center gap-2 tracking-widest uppercase">
          <Terminal size={14} className="text-[var(--soft-gold)]" />
          Agent Pulse Log
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-[11px]">
        {logs.map((log) => (
          <div
            key={log.id}
            className="group relative pl-4 border-l border-[var(--panel-border)] py-1 hover:border-[var(--soft-gold)] transition-colors"
          >
            <span className="block text-[var(--text-muted)] text-[9px] mb-1">
              {log.time} UTC
            </span>
            <p className="text-[var(--text-secondary)] group-hover:text-white transition-colors leading-relaxed">
              <span className={getBadgeStyle(log.type)}>
                [{log.type.toUpperCase()}]
              </span>{" "}
              {log.message}
            </p>
          </div>
        ))}
      </div>

      <div className="p-4 bg-[#071529] border-t border-[var(--panel-border)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest font-bold">
            Autonomous Health
          </span>
          <span className="text-[9px] text-[var(--success)] font-bold">
            100%
          </span>
        </div>
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-[var(--success)] w-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
        </div>
      </div>
    </aside>
  );
}

function getBadgeStyle(type: string) {
  switch (type) {
    case "system":
      return "text-blue-400";
    case "scan":
      return "text-purple-400";
    case "agent":
      return "text-[var(--soft-gold)]";
    case "logic":
      return "text-emerald-400";
    default:
      return "text-white";
  }
}
