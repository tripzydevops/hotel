"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Zap,
  Search,
  Radar,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  Globe,
  Compass,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface DiscoveryRival {
  id: string;
  name: string;
  location: string;
  stars: number;
  rating: number;
  similarity: number;
  distance?: number;
  image_url?: string;
  amenities?: string[];
  serp_api_id?: string;
  property_token?: string;
}

export default function DiscoveryShard({ hotelId }: { hotelId: string }) {
  const { t } = useI18n();
  const [rivals, setRivals] = useState<DiscoveryRival[]>([]);
  const [loading, setLoading] = useState(false);
  const [gridScanning, setGridScanning] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const discover = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    setError(null);
    try {
      // Use the semantic vector-based route (no SerpAPI dependency).
      // Maps similarity_score → similarity for the existing UI.
      const response = await api.discoverGhostCompetitors(hotelId);
      const normalised = (response || []).map((r: any) => ({
        ...r,
        similarity: r.similarity_score ?? r.similarity ?? 0,
      }));
      setRivals(normalised);
    } catch (err) {
      console.error("Discovery failed:", err);
      setError("Autonomous scan failed. Re-initializing...");
    } finally {
      setLoading(false);
    }
  }, [hotelId]);

  const launchGridRadar = async (overrideRadius?: number) => {
    if (!hotelId || gridScanning) return;
    const targetRadius = overrideRadius ?? radiusKm;
    setGridScanning(true);
    setError(null);
    setScanMessage(`Deploying 5-point GPS Grid (${targetRadius}km)... Scraping Google Hotels & vectorizing...`);
    try {
      const res = await api.triggerGeoGridDiscovery(hotelId, targetRadius, 5);
      if (res?.rivals && res.rivals.length > 0) {
        const normalised = res.rivals.map((r: any) => ({
          ...r,
          similarity: r.similarity_score ?? r.similarity ?? 0,
        }));
        setRivals(normalised);
        setScanMessage(
          `Successfully mapped ${res.newly_seeded_count ?? res.rivals.length} regional hotels into database!`
        );
      } else {
        setScanMessage(res?.message || "No additional properties found in this radius.");
        // Still attempt regular discover refresh
        await discover();
      }
    } catch (err: any) {
      console.error("Grid radar failed:", err);
      setError(err?.message || "Radar grid scan failed. Please check provider connection.");
    } finally {
      setGridScanning(false);
    }
  };

  useEffect(() => {
    if (hotelId) {
      discover();
    }
  }, [hotelId, discover]);

  const [trackingId, setTrackingId] = useState<string | null>(null);

  const trackCompetitor = async (rival: DiscoveryRival) => {
    setTrackingId(rival.id);
    try {
      // 1. Get current user
      const { insforge } = await import("@/lib/insforge");
      const { data: { user } } = await insforge.auth.getCurrentUser();

      if (!user?.id) throw new Error("No user session");

      // 2. Add to tracked hotels
      await api.addHotel(
        rival.name,
        rival.location,
        false, // isTarget
        "TRY", // Default currency
        rival.serp_api_id || rival.property_token, // Google ID / SerpApi ID for 4-hour scans
      );

      // 3. Update local state to show "Tracked"
      // In a real app we might want to refresh the global hotel list context
    } catch (err) {
      console.error("Failed to track:", err);
    } finally {
      setTrackingId(null);
    }
  };

  return (
    <div className="command-card p-6 min-h-[400px] flex flex-col relative overflow-hidden group">
      {/* Cinematic Background Radar */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--soft-gold)]/5 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 sm:mb-8 relative z-10">
        <div className="flex items-center gap-3 sm:gap-4">
          <div
            className={`p-2.5 sm:p-3 rounded-2xl bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] shrink-0 ${loading ? "ultra-pulse" : ""}`}
          >
            {loading ? (
              <Radar className="w-5 h-5 sm:w-6 sm:h-6" />
            ) : (
              <Zap className="w-5 h-5 sm:w-6 sm:h-6" />
            )}
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-[var(--overlay-text)] tracking-tight">
              Discovery Engine
            </h2>
            <p className="text-[9px] sm:text-[10px] font-bold text-[var(--soft-gold)] uppercase tracking-[0.2em]">
              {loading
                ? "Scanning Vector Space..."
                : "Autonomous Competitor Detection"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => launchGridRadar()}
            disabled={loading || gridScanning}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40 text-xs font-bold transition-all disabled:opacity-50"
            title="Deploy DataForSEO GPS Grid Search across surrounding territory"
          >
            {gridScanning ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Compass className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{gridScanning ? "Radar Active..." : "Geo-Grid Sweep"}</span>
            <span className="sm:hidden">{gridScanning ? "Scanning..." : "Sweep"}</span>
          </button>

          <button
            onClick={discover}
            disabled={loading || gridScanning}
            className="p-2 rounded-lg bg-white/5 text-[var(--text-muted)] hover:text-[var(--overlay-text)] hover:bg-white/10 transition-all group/refresh"
            title="Refresh local vector matches"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`}
            />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative z-10">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-[300px] gap-6"
            >
              <div className="relative">
                <div className="w-24 h-24 border-2 border-[var(--soft-gold)]/20 rounded-full animate-ping" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Search className="w-8 h-8 text-[var(--soft-gold)] animate-pulse" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-black text-[var(--overlay-text)] uppercase tracking-widest mb-1">
                  Analyzing Market Vibes
                </p>
                <p className="text-[10px] text-[var(--text-muted)] font-medium">
                  Cross-referencing 50k+ properties semantically
                </p>
              </div>
            </motion.div>
          ) : error ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-[300px] text-center"
            >
              <div className="text-[var(--alert-red)] mb-4 bg-[var(--alert-red)]/10 p-4 rounded-full">
                <Radar className="w-8 h-8" />
              </div>
              <p className="text-[var(--overlay-text)] font-bold mb-1">{error}</p>
              <button
                onClick={discover}
                className="text-[var(--soft-gold)] text-[10px] font-black uppercase tracking-widest hover:underline"
              >
                Retry Scan
              </button>
            </motion.div>
          ) : rivals.length > 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 gap-4"
            >
              {rivals.map((rival: DiscoveryRival, idx: number) => (
                <motion.div
                  key={rival.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-[var(--overlay-border)] hover:bg-white/[0.04] hover:border-[var(--overlay-border)] transition-all group/item"
                >
                  {/* Hotel Thumbnail */}
                  <div className="w-12 h-12 rounded-xl bg-[var(--soft-gold)]/10 overflow-hidden border border-[var(--overlay-border)] flex-shrink-0">
                    {rival.image_url ? (
                      <img
                        src={rival.image_url}
                        alt={rival.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[var(--soft-gold)]">
                        <Radar className="w-5 h-5" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-bold text-[var(--overlay-text)] truncate">
                        {rival.name}
                      </h3>
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20">
                        <span className="text-[8px] font-black text-[var(--soft-gold)]">
                          MATCH
                        </span>
                        <span className="text-[10px] font-black text-[var(--overlay-text)]">
                          {rival.similarity && !isNaN(rival.similarity)
                            ? Math.round(rival.similarity * 100)
                            : "0"}
                          %
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] font-medium">
                      <span className="truncate">{rival.location}</span>
                      {rival.distance && !isNaN(rival.distance) && (
                        <>
                          <span>•</span>
                          <span className="text-[var(--soft-gold)] whitespace-nowrap">
                            {rival.distance.toFixed(1)} km
                          </span>
                        </>
                      )}
                      <span>•</span>
                      <div className="flex items-center gap-0.5 text-[var(--soft-gold)]">
                        {Array.from({ length: Math.max(0, Math.min(5, Math.floor(rival.stars || 0))) }).map((_, i) => (
                          <span key={i}>★</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={() => trackCompetitor(rival)}
                      disabled={trackingId === rival.id}
                      className="flex items-center gap-1 text-[9px] font-black text-[var(--deep-ocean)] bg-[var(--soft-gold)] px-3 py-1.5 rounded-lg uppercase hover:bg-white transition-colors disabled:opacity-50"
                    >
                      {trackingId === rival.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <Radar className="w-3 h-3" />
                          Track
                        </>
                      )}
                    </button>
                    <Link 
                      href="/analysis/hotel-intelligence"
                      className="text-[var(--text-muted)] group-hover/item:text-[var(--soft-gold)] transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : gridScanning ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-[340px] gap-6 text-center"
            >
              <div className="relative">
                <div className="w-28 h-28 border-2 border-emerald-500/30 rounded-full animate-ping" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30">
                    <Compass className="w-8 h-8 text-emerald-400 animate-spin" />
                  </div>
                </div>
              </div>
              <div className="max-w-md">
                <p className="text-sm font-black text-[var(--overlay-text)] uppercase tracking-widest mb-1.5">
                  Deploying GPS Grid Matrix
                </p>
                <p className="text-xs text-emerald-400 font-medium mb-1">
                  {scanMessage || "Querying DataForSEO Google Hotels & computing Gemini embeddings..."}
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">
                  Sweeping 5 coordinate points in a {radiusKm}km perimeter...
                </p>
              </div>
            </motion.div>
          ) : (
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-[var(--overlay-border)] flex flex-col items-center justify-center text-center my-4">
              <div className="relative mb-5">
                <div className="w-16 h-16 rounded-2xl bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 flex items-center justify-center text-[var(--soft-gold)]">
                  <Radar className="w-8 h-8 animate-pulse" />
                </div>
              </div>

              <h3 className="text-base font-bold text-[var(--overlay-text)] mb-2">
                Unindexed Regional Market (Cold Start)
              </h3>
              <p className="text-xs text-[var(--text-muted)] max-w-md mb-6 leading-relaxed">
                Zero competitors currently exist in our database within 50km of this property.
                Deploy our Autonomous Geo-Grid Radar to query Google Hotels across a multi-point GPS matrix,
                auto-seed local properties, and vectorize them with Gemini.
              </p>

              {/* Radius Selector */}
              <div className="flex items-center gap-2 mb-6 p-1 rounded-xl bg-white/5 border border-[var(--overlay-border)]">
                <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] px-3">
                  Perimeter:
                </span>
                {[5, 10, 25].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRadiusKm(r)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      radiusKm === r
                        ? "bg-emerald-500 text-[var(--deep-ocean)] shadow-sm"
                        : "text-[var(--text-muted)] hover:text-[var(--overlay-text)] hover:bg-white/5"
                    }`}
                  >
                    {r} km
                  </button>
                ))}
              </div>

              {/* Scan Trigger Button */}
              <button
                onClick={() => launchGridRadar()}
                disabled={gridScanning}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[var(--deep-ocean)] font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
              >
                <Compass className="w-4 h-4" />
                <span>Launch Autonomous Geo-Grid Radar</span>
              </button>

              {scanMessage && (
                <div className="mt-4 flex items-center gap-2 text-[11px] text-emerald-400 font-medium bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{scanMessage}</span>
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Meta */}
      <div className="mt-6 pt-6 border-t border-[var(--overlay-border)] flex items-center justify-between text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--optimal-green)] animate-pulse" />
          Engine Online
        </div>
        <div>PGVECTOR HNSW ACTIVE</div>
      </div>
    </div>
  );
}
