"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/ToastContext";

const ScansPanel = () => {
  const { toast } = useToast();
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [scanDetails, setScanDetails] = useState<any>(null);
  const [scanDetailsLoading, setScanDetailsLoading] = useState(false);

  useEffect(() => {
    loadScans();
  }, []);

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

  if (loading && scans.length === 0) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--soft-gold)] mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
                <td className="p-4 text-white font-medium">{scan.user_name}</td>
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
            </div>
          ) : (
            <div className="p-8 text-center text-[var(--text-muted)]">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No details found for this scan.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScansPanel;
