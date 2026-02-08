"use client";

import { useEffect, useState } from "react";
import {
  Zap,
  Search,
  Radar,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
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
  image_url?: string;
  amenities?: string[];
}

export default function DiscoveryShard({ hotelId }: { hotelId: string }) {
  const { t } = useI18n();
  const [rivals, setRivals] = useState<DiscoveryRival[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discover = async () => {
    if (!hotelId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.discoverCompetitors(hotelId);
      setRivals(response);
    } catch (err) {
      console.error("Discovery failed:", err);
      setError("Autonomous scan failed. Re-initializing...");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hotelId) {
      discover();
    }
  }, [hotelId]);

  return (
    <div className="command-card p-6 min-h-[400px] flex flex-col relative overflow-hidden group">
      {/* Cinematic Background Radar */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--soft-gold)]/5 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />

      {/* Header */}
      <div className="flex items-start justify-between mb-8 relative z-10">
        <div className="flex items-center gap-4">
          <div
            className={`p-3 rounded-2xl bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] ${loading ? "ultra-pulse" : ""}`}
          >
            {loading ? (
              <Radar className="w-6 h-6" />
            ) : (
              <Zap className="w-6 h-6" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Discovery Engine
            </h2>
            <p className="text-[10px] font-bold text-[var(--soft-gold)] uppercase tracking-[0.2em]">
              {loading
                ? "Scanning Vector Space..."
                : "Autonomous Competitor Detection"}
            </p>
          </div>
        </div>

        <button
          onClick={discover}
          disabled={loading}
          className="p-2 rounded-lg bg-white/5 text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-all group/refresh"
        >
          <RefreshCw
            className={`w-4 h-4 ${loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`}
          />
        </button>
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
                <p className="text-sm font-black text-white uppercase tracking-widest mb-1">
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
              <p className="text-white font-bold mb-1">{error}</p>
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
              {rivals.map((rival, idx) => (
                <motion.div
                  key={rival.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all group/item"
                >
                  {/* Hotel Thumbnail */}
                  <div className="w-12 h-12 rounded-xl bg-[var(--soft-gold)]/10 overflow-hidden border border-white/5 flex-shrink-0">
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
                      <h3 className="text-sm font-bold text-white truncate">
                        {rival.name}
                      </h3>
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20">
                        <span className="text-[8px] font-black text-[var(--soft-gold)]">
                          MATCH
                        </span>
                        <span className="text-[10px] font-black text-white">
                          {Math.round(rival.similarity * 100)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] font-medium">
                      <span>{rival.location}</span>
                      <span>•</span>
                      <div className="flex items-center gap-0.5 text-[var(--soft-gold)]">
                        {[
                          ...Array(Math.min(5, Math.floor(rival.stars || 0))),
                        ].map((_, i) => (
                          <span key={i}>★</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Match Indicator */}
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1 text-[9px] font-black text-[var(--optimal-green)] bg-[var(--optimal-green)]/10 px-2 py-0.5 rounded-full uppercase">
                      <ShieldCheck className="w-3 h-3" />
                      Verified
                    </div>
                    <button className="text-[var(--text-muted)] group-hover/item:text-[var(--soft-gold)] transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-center opacity-40">
              <Radar className="w-12 h-12 mb-4" />
              <p className="text-sm font-bold">
                No competitors detected in immediate vector orbit.
              </p>
              <p className="text-[10px] uppercase tracking-widest mt-1">
                Expanding scan radius...
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Meta */}
      <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--optimal-green)] animate-pulse" />
          Engine Online
        </div>
        <div>PGVECTOR HNSW ACTIVE</div>
      </div>
    </div>
  );
}
