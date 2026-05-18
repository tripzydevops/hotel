"use client";

import React, { useState } from "react";
import ScanHistoryTab from "./scans/ScanHistoryTab";
import ScanQueueTab from "./scans/ScanQueueTab";
import ScanBatchesTab from "./scans/ScanBatchesTab";

/**
 * ScansPanel — Thin orchestrator for the admin scans dashboard.
 *
 * All data fetching, state, and UI rendering is delegated to self-contained
 * tab components under `./scans/`. This orchestrator only manages which tab
 * is active and renders the tab-selection dock.
 */
const ScansPanel = () => {
  const [activeTab, setActiveTab] = useState<"history" | "queue" | "batches">("history");

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Tab Controls - Sub-dock */}
      <div className="flex bg-[var(--deep-ocean-card)]/30 p-1.5 rounded-xl border border-[var(--overlay-border)] w-fit shadow-lg">
        <button
          onClick={() => setActiveTab("history")}
          className={`px-6 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === "history"
            ? "bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] border border-[var(--soft-gold)]/20 shadow-inner"
            : "text-[var(--text-muted)] hover:text-[var(--overlay-text)]"
            }`}
        >
          Scan History
        </button>
        <button
          onClick={() => setActiveTab("queue")}
          className={`px-6 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === "queue"
            ? "bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] border border-[var(--soft-gold)]/20 shadow-inner"
            : "text-[var(--text-muted)] hover:text-[var(--overlay-text)]"
            }`}
        >
          Upcoming Queue
        </button>
        <button
          onClick={() => setActiveTab("batches")}
          className={`px-6 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === "batches"
            ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-inner"
            : "text-[var(--text-muted)] hover:text-[var(--overlay-text)]"
            }`}
        >
          Live Batches
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "history" && <ScanHistoryTab />}
      {activeTab === "queue" && <ScanQueueTab />}
      {activeTab === "batches" && <ScanBatchesTab />}
    </div>
  );
};

export default ScansPanel;
