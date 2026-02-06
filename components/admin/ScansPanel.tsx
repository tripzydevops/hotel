"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/ToastContext";

const ScansPanel = () => {
  const { toast } = useToast();
  /* New Queue State */
  const [queue, setQueue] = useState<any[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"history" | "queue">("history");

  /* History State */
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [scanDetails, setScanDetails] = useState<any>(null);
  const [scanDetailsLoading, setScanDetailsLoading] = useState(false);

  useEffect(() => {
    if (activeTab === "history") loadScans();
    if (activeTab === "queue") loadQueue();
  }, [activeTab]);

  useEffect(() => {
    if (selectedScanId) {
      fetchScanDetails(selectedScanId);
    } else {
      setScanDetails(null);
    }
  }, [selectedScanId]);

  const loadScans = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminScans();
      setScans(data);
    } catch (err) {
      console.error("Failed to load scans:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadQueue = async () => {
    setQueueLoading(true);
    try {
      const data = await api.getSchedulerQueue();
      setQueue(data);
    } catch (err) {
      console.error("Failed to load queue:", err);
    } finally {
      setQueueLoading(false);
    }
  };

  const handleTriggerNow = async (userId: string) => {
    toast.success("Triggering scan...");
    try {
      await api.checkScheduledScan(userId);
      toast.success("Scan triggered! Check history.");
      // Refresh queue
      loadQueue();
    } catch (err: any) {
      toast.error("Failed to trigger: " + err.message);
    }
  };

  const fetchScanDetails = async (id: string) => {
    setScanDetailsLoading(true);
    try {
      const data = await api.getAdminScanDetails(id);
      setScanDetails(data);
    } catch (err: any) {
      toast.error("Error: " + err.message);
      setSelectedScanId(null);
    } finally {
      setScanDetailsLoading(false);
    }
  };

  /* Loading State */
  if (loading && scans.length === 0 && activeTab === "history") {
    return (
      <div className="p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--soft-gold)] mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Controls */}
      <div className="flex space-x-4 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 font-bold text-sm transition-colors ${
            activeTab === "history"
              ? "text-[var(--soft-gold)] border-b-2 border-[var(--soft-gold)]"
              : "text-[var(--text-muted)] hover:text-white"
          }`}
        >
          Scan History
        </button>
        <button
          onClick={() => setActiveTab("queue")}
          className={`px-4 py-2 font-bold text-sm transition-colors ${
            activeTab === "queue"
              ? "text-[var(--soft-gold)] border-b-2 border-[var(--soft-gold)]"
              : "text-[var(--text-muted)] hover:text-white"
          }`}
        >
          Upcoming Queue
        </button>
      </div>

      {activeTab === "queue" && (
        <div className="glass-card border border-white/10 overflow-hidden">
          {queueLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--soft-gold)] mx-auto" />
            </div>
          ) : queue.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-muted)]">
              No scheduled scans found. Configure users to enable scheduling.
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-[var(--text-muted)] font-medium">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Frequency</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Next Run</th>
                  <th className="p-4 text-right">Hotels</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {queue.map((item, idx) => {
                  const isOverdue = item.status === "overdue";
                  return (
                    <tr key={idx} className="hover:bg-white/5">
                      <td className="p-4 font-medium text-white">
                        {item.user_name}
                      </td>
                      <td className="p-4 text-[var(--soft-gold)] text-xs font-bold">
                        Every {Math.round(item.scan_frequency_minutes / 60)}h
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                            isOverdue
                              ? "bg-red-500/20 text-red-400"
                              : "bg-[var(--optimal-green)]/20 text-[var(--optimal-green)]"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="p-4 text-white">
                        <div className="flex flex-col">
                          <span>
                            {new Date(item.next_scan_at).toLocaleString()}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">
                            {formatDistanceToNow(new Date(item.next_scan_at), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-right text-white">
                        <div className="flex flex-col items-end">
                          <span className="font-bold">{item.hotel_count}</span>
                          <span className="text-[10px] text-[var(--text-muted)] max-w-[150px] truncate">
                            {item.hotels.join(", ")}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleTriggerNow(item.user_id)}
                          className="px-3 py-1 bg-white/10 hover:bg-[var(--soft-gold)] hover:text-black text-white text-xs font-bold rounded transition-colors"
                        >
                          Trigger Now
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <>
          <div className="glass-card border border-white/10 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-[var(--text-muted)] font-medium">
                <tr>
                  <th className="p-4">Time</th>
                  <th className="p-4">User</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Hotels</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {scans.map((scan) => (
                  <tr
                    key={scan.id}
                    className={`hover:bg-white/5 cursor-pointer transition-colors ${selectedScanId === scan.id ? "bg-white/5" : ""}`}
                    onClick={() => setSelectedScanId(scan.id)}
                  >
                    <td className="p-4 text-[var(--text-muted)] whitespace-nowrap">
                      {formatDistanceToNow(new Date(scan.created_at), {
                        addSuffix: true,
                      })}
                    </td>
                    <td className="p-4 text-white font-medium">
                      {scan.user_name}
                    </td>
                    <td className="p-4">
                      <span className="bg-white/10 px-2 py-1 rounded text-xs text-white capitalize">
                        {scan.session_type}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          scan.status === "completed"
                            ? "bg-[var(--optimal-green)]/20 text-[var(--optimal-green)]"
                            : scan.status === "running"
                              ? "bg-[var(--soft-gold)]/20 text-[var(--soft-gold)]"
                              : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {scan.status}
                      </span>
                    </td>
                    <td className="p-4 text-right text-white">
                      {scan.hotels_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedScanId && (
            <div className="glass-card p-6 border border-[var(--soft-gold)]/30 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">
                  Scan Detail: {selectedScanId.slice(0, 8)}...
                </h3>
                <button
                  onClick={() => setSelectedScanId(null)}
                  className="text-[var(--text-muted)] hover:text-white font-bold"
                >
                  ✕ Close
                </button>
              </div>

              {scanDetailsLoading ? (
                <div className="py-12 text-center text-[var(--soft-gold)]">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                  <p className="mt-2 text-sm opacity-70">Fetching results...</p>
                </div>
              ) : scanDetails ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-black/20 rounded-lg">
                      <p className="text-[10px] uppercase text-[var(--text-muted)] mb-1">
                        Status
                      </p>
                      <p className="font-bold text-white capitalize">
                        {scanDetails.session?.status}
                      </p>
                    </div>
                    <div className="p-4 bg-black/20 rounded-lg">
                      <p className="text-[10px] uppercase text-[var(--text-muted)] mb-1">
                        Date
                      </p>
                      <p className="font-bold text-white">
                        {scanDetails.session?.check_in_date || "N/A"}
                      </p>
                    </div>
                    <div className="p-4 bg-black/20 rounded-lg">
                      <p className="text-[10px] uppercase text-[var(--text-muted)] mb-1">
                        Adults
                      </p>
                      <p className="font-bold text-white">
                        {scanDetails.session?.adults || 2}
                      </p>
                    </div>
                    <div className="p-4 bg-black/20 rounded-lg">
                      <p className="text-[10px] uppercase text-[var(--text-muted)] mb-1">
                        Currency
                      </p>
                      <p className="font-bold text-white">
                        {scanDetails.session?.currency || "TRY"}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-white/5">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/5 text-[var(--text-muted)]">
                        <tr>
                          <th className="p-3">Hotel</th>
                          <th className="p-3">Result</th>
                          <th className="p-3">Price</th>
                          <th className="p-3">Vendor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {scanDetails.logs?.map((log: any) => (
                          <tr key={log.id} className="hover:bg-white/5">
                            <td className="p-3 text-white font-medium">
                              {log.hotel_name}
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  log.status === "success"
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-red-500/20 text-red-400"
                                }`}
                              >
                                {log.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="p-3 text-white">
                              {log.price
                                ? `${log.price.toLocaleString()} ${log.currency}`
                                : "—"}
                            </td>
                            <td className="p-3 text-[var(--text-muted)]">
                              {log.vendor || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Reasoning Timeline */}
                  {scanDetails.session?.reasoning_trace &&
                    scanDetails.session.reasoning_trace.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[var(--soft-gold)] animate-pulse" />
                          Agent Reasoning Timeline
                        </h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                          {scanDetails.session.reasoning_trace.map(
                            (trace: any, i: number) => {
                              // Handle Legacy String Traces
                              if (typeof trace === "string") {
                                const isNormalization =
                                  trace.includes("[Normalization]");
                                const isAlert = trace.includes("[Alert]");
                                const isError = trace.includes("[ERROR]");

                                let bgClass = "bg-white/5";
                                let borderClass = "border-white/10";
                                return (
                                  <div
                                    key={i}
                                    className={`flex items-start gap-3 p-3 rounded-lg border ${bgClass} ${borderClass}`}
                                  >
                                    <span className="text-sm">📝</span>
                                    <span className="text-xs text-white/80 font-mono leading-relaxed">
                                      {trace}
                                    </span>
                                  </div>
                                );
                              }

                              // Handle New Structured ReasoningLog
                              const {
                                step,
                                level,
                                message,
                                timestamp,
                                metadata,
                              } = trace;

                              let bgClass = "bg-white/5";
                              let borderClass = "border-white/10";
                              let iconEmoji = "📝";
                              let textColor = "text-white/80";

                              switch (level) {
                                case "info":
                                  if (
                                    step === "Scraping" ||
                                    step === "API Call"
                                  ) {
                                    bgClass = "bg-blue-500/10";
                                    borderClass = "border-blue-500/30";
                                    iconEmoji = "🌐";
                                    textColor = "text-blue-200";
                                  } else if (step === "Date Generation") {
                                    bgClass = "bg-purple-500/10";
                                    borderClass = "border-purple-500/30";
                                    iconEmoji = "📅";
                                    textColor = "text-purple-200";
                                  }
                                  break;
                                case "success":
                                  bgClass = "bg-[var(--optimal-green)]/10";
                                  borderClass =
                                    "border-[var(--optimal-green)]/30";
                                  iconEmoji = "✅";
                                  textColor = "text-[var(--optimal-green)]";
                                  break;
                                case "warn":
                                  bgClass = "bg-orange-500/10";
                                  borderClass = "border-orange-500/30";
                                  iconEmoji = "⚠️";
                                  textColor = "text-orange-200";
                                  break;
                                case "error":
                                  bgClass = "bg-[var(--alert-red)]/10";
                                  borderClass = "border-[var(--alert-red)]/30";
                                  iconEmoji = "❌";
                                  textColor = "text-[var(--alert-red)]";
                                  break;
                              }

                              return (
                                <div
                                  key={i}
                                  className={`flex flex-col gap-1 p-3 rounded-lg border ${bgClass} ${borderClass} transition-all hover:scale-[1.01] hover:shadow-lg`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/60">
                                      {iconEmoji} {step}
                                    </span>
                                    <span className="text-[10px] font-mono text-white/40">
                                      {timestamp
                                        ? new Date(
                                            timestamp * 1000,
                                          ).toLocaleTimeString()
                                        : ""}
                                    </span>
                                  </div>
                                  <span
                                    className={`text-sm font-mono leading-relaxed ${textColor}`}
                                  >
                                    {message}
                                  </span>
                                  {metadata &&
                                    Object.keys(metadata).length > 0 && (
                                      <div className="mt-2 text-[10px] font-mono bg-black/20 p-2 rounded text-white/50 w-full overflow-x-auto">
                                        {JSON.stringify(metadata)}
                                      </div>
                                    )}
                                </div>
                              );
                            },
                          )}
                        </div>
                      </div>
                    )}

                  {/* Market Parity Offers */}
                  {scanDetails.logs?.some(
                    (log: any) => log.parity_offers?.length > 0,
                  ) && (
                    <div className="mt-6">
                      <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        Market Parity (OTA Offers)
                      </h4>
                      <div className="space-y-4">
                        {scanDetails.logs
                          .filter((log: any) => log.parity_offers?.length > 0)
                          .map((log: any) => (
                            <div
                              key={log.id}
                              className="bg-black/20 rounded-lg p-4"
                            >
                              <p className="text-xs font-medium text-white mb-2">
                                {log.hotel_name}
                              </p>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {log.parity_offers.map(
                                  (offer: any, idx: number) => {
                                    const isLowest = log.parity_offers.every(
                                      (o: any) => offer.price <= o.price,
                                    );
                                    const isHighest = log.parity_offers.every(
                                      (o: any) => offer.price >= o.price,
                                    );

                                    return (
                                      <div
                                        key={idx}
                                        className={`p-2 rounded border ${
                                          isLowest
                                            ? "border-green-500/50 bg-green-500/10"
                                            : isHighest
                                              ? "border-red-500/50 bg-red-500/10"
                                              : "border-white/10 bg-white/5"
                                        }`}
                                      >
                                        <p className="text-[10px] text-[var(--text-muted)] uppercase">
                                          {offer.vendor ||
                                            offer.source ||
                                            "Unknown"}
                                        </p>
                                        <p
                                          className={`text-sm font-bold ${
                                            isLowest
                                              ? "text-green-400"
                                              : isHighest
                                                ? "text-red-400"
                                                : "text-white"
                                          }`}
                                        >
                                          {offer.price?.toLocaleString()}{" "}
                                          {offer.currency || log.currency}
                                        </p>
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-[var(--text-muted)]">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>No details found for this scan.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ScansPanel;
