"use client";

import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { createClient } from "@/utils/supabase/client";
import { Calendar, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import RateIntelligenceGrid from "@/components/features/analysis/RateIntelligenceGrid";
import AnalysisSidebar from "@/components/features/analysis/AnalysisSidebar";

export default function CalendarPage() {
  const { t } = useI18n();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<string>("TRY");

  // Filters
  const [roomType, setRoomType] = useState<string>("");
  const [excludedHotelIds, setExcludedHotelIds] = useState<string[]>([]);
  const [allHotels, setAllHotels] = useState<
    { id: string; name: string; is_target: boolean }[]
  >([]);

  // View State (Pagination)
  const [viewDate, setViewDate] = useState<Date>(new Date());

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
      } else {
        window.location.href = "/login";
      }
    };
    getSession();
  }, []);

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("currency", currency);

      // Calculate Date Range (Fetch a wide window for smooth navigation, e.g. -2 to +60 days)
      const start = new Date(viewDate);
      start.setDate(start.getDate() - 2); // Buffer
      const end = new Date(viewDate);
      end.setDate(end.getDate() + 60); // 2 months forward

      params.set("start_date", start.toISOString().split("T")[0]);
      params.set("end_date", end.toISOString().split("T")[0]);

      if (roomType) params.set("room_type", roomType);

      const result = await api.getAnalysisWithFilters(
        userId,
        params.toString(),
      );
      setData(result);
      if (result.display_currency) setCurrency(result.display_currency);
      if (result.all_hotels && allHotels.length === 0)
        setAllHotels(result.all_hotels);

      // Auto-select "Standard Room" if no room type selected yet & available
      if (
        !roomType &&
        result.available_room_types &&
        result.available_room_types.length > 0
      ) {
        // Look for "Standard" or "Double" or "King" - or just default to first
        const standard = result.available_room_types.find((rt: string) =>
          rt.toLowerCase().includes("standard"),
        );
        if (standard) setRoomType(standard);
        else setRoomType(result.available_room_types[0]);
      }
    } catch (e) {
      console.error("Failed to load calendar data", e);
    } finally {
      setLoading(false);
    }
  }, [userId, currency, roomType, allHotels.length, viewDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSetTarget = async (hotelId: string) => {
    if (!userId) return;
    try {
      await api.updateHotel(hotelId, { is_target_hotel: true });
      loadData();
      setAllHotels([]);
    } catch (err) {
      console.error("Failed to set target hotel:", err);
    }
  };

  // Pagination Logic
  const handleNav = (days: number) => {
    const newDate = new Date(viewDate);
    newDate.setDate(newDate.getDate() + days);
    setViewDate(newDate);
  };

  const getVisiblePrices = () => {
    if (!data?.daily_prices) return [];

    // Sort all data first
    const sorted = [...data.daily_prices].sort(
      (a: any, b: any) =>
        new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    // Simple approach: Filter for dates >= viewDate, take 14
    const startTs = viewDate.setHours(0, 0, 0, 0);
    // Find the first index that is >= viewDate
    let startIndex = sorted.findIndex(
      (p: any) => new Date(p.date).getTime() >= startTs,
    );

    // Fallback if viewDate is out of range
    if (startIndex === -1 && sorted.length > 0) {
      // If viewDate is before all data, start at 0
      if (viewDate.getTime() < new Date(sorted[0].date).getTime())
        startIndex = 0;
      // If viewDate is after all data, start at end - 14
      else startIndex = Math.max(0, sorted.length - 14);
    }
    if (startIndex === -1) startIndex = 0; // Empty data

    return sorted.slice(startIndex, startIndex + 14);
  };

  const visiblePrices = getVisiblePrices();
  const visibleRangeLabel =
    visiblePrices.length > 0
      ? `${new Date(visiblePrices[0].date).toLocaleDateString()} - ${new Date(visiblePrices[visiblePrices.length - 1].date).toLocaleDateString()}`
      : "No Data";

  return (
    <div className="min-h-screen bg-[var(--deep-ocean)] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/analysis"
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white">Rate Calendar</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Market Intelligence & Rate Strategy
            </p>
          </div>
        </div>

        {/* Date Controls */}
        <div className="flex items-center gap-4 bg-[var(--card-bg-dark)] p-1 rounded-xl border border-white/5">
          <button
            onClick={() => handleNav(-7)}
            className="p-2 hover:bg-white/10 rounded-lg text-white/70"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-white min-w-[150px] text-center bg-white/5 py-1 rounded">
            {visibleRangeLabel}
          </span>
          <button
            onClick={() => handleNav(7)}
            className="p-2 hover:bg-white/10 rounded-lg text-white/70"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <AnalysisSidebar
          allHotels={data?.all_hotels || allHotels}
          excludedHotelIds={excludedHotelIds}
          onExcludedChange={setExcludedHotelIds}
          roomType={roomType}
          onRoomTypeChange={setRoomType}
          availableRoomTypes={data?.available_room_types || []}
          onSetTarget={handleSetTarget}
        />

        {/* Main Grid */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="glass-card p-12 flex items-center justify-center">
              <div className="animate-spin w-8 h-8 border-2 border-[var(--soft-gold)] border-t-transparent rounded-full" />
            </div>
          ) : (
            <RateIntelligenceGrid
              dailyPrices={visiblePrices}
              competitors={
                data?.competitors?.filter(
                  (c: any) => !excludedHotelIds.includes(c.id),
                ) || []
              }
              currency={currency}
              hotelName={data?.hotel_name}
            />
          )}
        </div>
      </div>
    </div>
  );
}
