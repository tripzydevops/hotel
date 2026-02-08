"use client";

import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { createClient } from "@/utils/supabase/client";
import CalendarHeatmap from "@/components/analytics/CalendarHeatmap";
import { Calendar, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CalendarPage() {
  const { t } = useI18n();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<string>("TRY");

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
      const result = await api.getAnalysisWithFilters(
        userId,
        `currency=${currency}`,
      );
      setData(result);
      if (result.display_currency) {
        setCurrency(result.display_currency);
      }
    } catch (e) {
      console.error("Failed to load calendar data", e);
    } finally {
      setLoading(false);
    }
  }, [userId, currency]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="min-h-screen bg-[var(--deep-ocean)] p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/analysis"
          className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Overview
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 rounded-2xl bg-[var(--soft-gold)]/10 text-[var(--soft-gold)]">
          <Calendar className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">Rate Calendar</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Daily price heatmap visualization
          </p>
        </div>
      </div>

      {/* Calendar Content */}
      {loading ? (
        <div className="glass-card p-8 flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-8 h-8 border-2 border-[var(--soft-gold)] border-t-transparent rounded-full" />
        </div>
      ) : data?.daily_prices ? (
        <div className="glass-card p-8">
          <CalendarHeatmap
            dailyPrices={data.daily_prices}
            targetHotelName={data.target_hotel_name || "Your Hotel"}
            currency={currency}
          />
        </div>
      ) : (
        <div className="glass-card p-8 text-center text-[var(--text-muted)]">
          No calendar data available. Run a scan first.
        </div>
      )}
    </div>
  );
}
