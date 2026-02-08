"use client";

import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { createClient } from "@/utils/supabase/client";
import SentimentBreakdown from "@/components/ui/SentimentBreakdown";
import {
  Heart,
  ArrowLeft,
  Star,
  MessageSquare,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

export default function SentimentPage() {
  const { t, locale } = useI18n();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
      const result = await api.getAnalysisWithFilters(userId, "");
      setData(result);
    } catch (e) {
      console.error("Failed to load sentiment data", e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

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
        <div className="p-3 rounded-2xl bg-pink-500/10 text-pink-400">
          <Heart className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">
            Sentiment Deep Dive
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Guest review analysis and sentiment breakdown
          </p>
        </div>
      </div>

      {/* Sentiment Stats */}
      {loading ? (
        <div className="glass-card p-8 flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-8 h-8 border-2 border-pink-400 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <Star className="w-5 h-5 text-[var(--soft-gold)]" />
                <span className="text-xs font-bold text-[var(--text-muted)] uppercase">
                  Overall Rating
                </span>
              </div>
              <p className="text-3xl font-black text-white">
                {data?.sentiment?.overall_rating?.toFixed(1) || "N/A"}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                out of 5.0
              </p>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <MessageSquare className="w-5 h-5 text-blue-400" />
                <span className="text-xs font-bold text-[var(--text-muted)] uppercase">
                  Total Reviews
                </span>
              </div>
              <p className="text-3xl font-black text-white">
                {data?.sentiment?.review_count || 0}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                analyzed reviews
              </p>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-bold text-[var(--text-muted)] uppercase">
                  Sentiment Score
                </span>
              </div>
              <p className="text-3xl font-black text-white">
                {data?.sentiment?.sentiment_score
                  ? `${(data.sentiment.sentiment_score * 100).toFixed(0)}%`
                  : "N/A"}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                positive sentiment
              </p>
            </div>
          </div>

          {/* Sentiment Breakdown Component */}
          {data?.sentiment && (
            <div className="glass-card p-8">
              <h2 className="text-lg font-black text-white mb-6">
                Sentiment Breakdown by Category
              </h2>
              <SentimentBreakdown items={data.sentiment?.categories || []} />
            </div>
          )}

          {/* No Data State */}
          {!data?.sentiment && (
            <div className="glass-card p-8 text-center text-[var(--text-muted)]">
              No sentiment data available. This feature requires review data
              from your hotel.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
