"use client";

import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import DiscoveryShard from "@/components/features/analysis/DiscoveryShard";
import { Radar, ArrowLeft, Building2, ChevronDown } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";

interface HotelOption {
  id: string;
  name: string;
  location?: string;
  is_target?: boolean;
}

function DiscoveryPageContent() {
  const { userId, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlHotelId = searchParams.get("hotel_id");
  const [hotels, setHotels] = useState<HotelOption[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(urlHotelId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    let isMounted = true;
    const loadHotels = async () => {
      try {
        setLoading(true);
        // Load user's target hotel + competitors
        const dash = await api.getDashboard();
        if (!isMounted) return;

        const options: HotelOption[] = [];
        if (dash.target_hotel) {
          options.push({
            id: dash.target_hotel.id,
            name: dash.target_hotel.name,
            location: dash.target_hotel.location,
            is_target: true,
          });
        }
        if (Array.isArray(dash.competitors)) {
          dash.competitors.forEach((c: any) => {
            if (c.id && c.id !== dash.target_hotel?.id) {
              options.push({
                id: c.id,
                name: c.name,
                location: c.location,
                is_target: false,
              });
            }
          });
        }

        setHotels(options);

        // Determine which hotel is selected
        if (urlHotelId && options.some((h) => h.id === urlHotelId)) {
          setSelectedHotelId(urlHotelId);
        } else if (dash.target_hotel?.id) {
          setSelectedHotelId(dash.target_hotel.id);
        } else if (options.length > 0) {
          setSelectedHotelId(options[0].id);
        } else {
          // Fallback to analysis endpoint
          const result = await api.getAnalysisWithFilters("");
          if (result?.hotel_id) {
            setSelectedHotelId(result.hotel_id);
          }
        }
      } catch (e) {
        console.error("Failed to load hotels for discovery:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadHotels();
    return () => {
      isMounted = false;
    };
  }, [userId, urlHotelId]);

  const handleHotelSelect = (hotelId: string) => {
    setSelectedHotelId(hotelId);
    router.replace(`/analysis/discovery?hotel_id=${hotelId}`);
  };

  const currentHotel = hotels.find((h) => h.id === selectedHotelId);

  return (
    <div className="min-h-screen bg-[var(--deep-ocean)] p-3 sm:p-6 md:p-8">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
        <Link
          href="/analysis"
          className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--overlay-text)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Market Analysis</span>
        </Link>
        <Link
          href="/dashboard"
          className="text-xs font-bold text-[var(--soft-gold)] hover:underline"
        >
          Dashboard &rarr;
        </Link>
      </div>

      {/* Header & Hotel Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="p-2.5 sm:p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 shrink-0">
            <Radar className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[var(--overlay-text)] tracking-tight">
              Discovery Engine & Geo-Grid
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">
              Autonomous competitor discovery, vector matching, and GPS matrix radar
            </p>
          </div>
        </div>

        {/* Hotel Selector Dropdown */}
        {hotels.length > 0 && (
          <div className="flex items-center gap-2 bg-[var(--glass-bg-accent)] p-1.5 sm:p-2 rounded-2xl border border-[var(--glass-border)] shadow-lg self-start sm:self-auto">
            <Building2 className="w-4 h-4 text-[var(--soft-gold)] ml-2 shrink-0" />
            <select
              value={selectedHotelId || ""}
              onChange={(e) => handleHotelSelect(e.target.value)}
              className="bg-transparent text-xs sm:text-sm font-bold text-[var(--overlay-text)] px-2 py-1 outline-none cursor-pointer [&>option]:bg-[#071326]"
            >
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} {h.is_target ? "(Target Hotel)" : "(Competitor)"}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Discovery Content */}
      {loading ? (
        <div className="glass-card p-8 flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full" />
        </div>
      ) : selectedHotelId ? (
        <DiscoveryShard key={selectedHotelId} hotelId={selectedHotelId} />
      ) : (
        <div className="glass-card p-12 text-center text-[var(--text-muted)] flex flex-col items-center justify-center gap-4">
          <Radar className="w-12 h-12 text-[var(--soft-gold)]/40" />
          <h3 className="text-base font-bold text-[var(--overlay-text)]">
            No hotel selected or configured.
          </h3>
          <p className="text-xs max-w-sm">
            Please add a hotel to your account on the dashboard first, or select a hotel above to begin discovery.
          </p>
          <Link
            href="/dashboard"
            className="btn-gold px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest mt-2"
          >
            Go to Dashboard
          </Link>
        </div>
      )}
    </div>
  );
}

export default function DiscoveryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--deep-ocean)] p-8 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full" />
        </div>
      }
    >
      <DiscoveryPageContent />
    </Suspense>
  );
}
