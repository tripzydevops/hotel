"use client";

import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { insforge } from "@/lib/insforge";
import DiscoveryShard from "@/components/features/analysis/DiscoveryShard";
import { Radar, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function DiscoveryPage() {
  const { userId, loading: authLoading } = useAuth();
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const fetchHotel = async () => {
        // Get hotel ID from analysis endpoint
        try {
          const result = await api.getAnalysisWithFilters("");
          setHotelId(result?.hotel_id || null);
        } catch (e) {
          console.error("Failed to get hotel ID", e);
        }
        setLoading(false);
    };
    fetchHotel();
  }, [userId]);

  return (
    <div className="min-h-screen bg-[var(--deep-ocean)] p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/analysis"
          className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--overlay-text)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Overview
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400">
          <Radar className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-[var(--overlay-text)]">Discovery Engine</h1>
          <p className="text-sm text-[var(--text-muted)]">
            AI-powered competitor discovery using vector similarity
          </p>
        </div>
      </div>

      {/* Discovery Content */}
      {loading ? (
        <div className="glass-card p-8 flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full" />
        </div>
      ) : hotelId ? (
        <DiscoveryShard hotelId={hotelId} />
      ) : (
        <div className="glass-card p-8 text-center text-[var(--text-muted)]">
          No hotel configured. Add a target hotel first.
        </div>
      )}
    </div>
  );
}
