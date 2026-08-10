"use client";

import { useAuth } from "@/hooks/useAuth";
import { useDashboard } from "@/hooks/useDashboard";
import { Share2, ArrowLeft, RefreshCw, Download } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import ParityStats from "@/components/analytics/ParityStats";
import RateMatrix from "@/components/analytics/RateMatrix";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";

export default function ParityPage() {
  const { t } = useI18n();
  const { userId } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  // Fetch real-time dashboard data including competitors and target hotel
  const { data, profile, loading, isRefreshing, fetchData } = useDashboard(userId, t);

  // Cache-bust: always re-fetch when the Parity Monitor page mounts so we
  // never show stale data carried over from the main dashboard.
  useEffect(() => {
    if (!userId) return;
    // Small delay lets the page paint its loading skeleton first
    const timer = setTimeout(() => { fetchData(); }, 300);
    return () => clearTimeout(timer);
  }, [userId]);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await api.exportReport();
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--deep-ocean)] p-8">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/analysis"
          className="flex items-center gap-2 text-sm text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Overview
        </Link>
        
        <div className="flex items-center gap-3">
          {/* Manual refresh button */}
          <button
            onClick={() => fetchData()}
            disabled={loading || isRefreshing}
            title="Refresh parity data"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-900 dark:text-white border border-slate-200 dark:border-transparent text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${(loading || isRefreshing) ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-900 dark:text-white border border-slate-200 dark:border-transparent text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 rounded-2xl bg-violet-500/10 text-violet-400">
          <Share2 className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Parity Monitor</h1>
          <p className="text-sm text-slate-600 dark:text-gray-400">
            OTA rate parity comparison and violation alerts
          </p>
        </div>
      </div>

      {/* Parity Content */}
      {/* 
        Show loading spinner if:
        1. userId is null (still checking auth)
        2. Dashboard data is loading
      */}
      {!userId || loading ? (
        <div className="glass-card p-8 flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full" />
            <p className="text-sm text-slate-500 dark:text-gray-400">
              {!userId ? "Authenticating..." : "Loading parity data..."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Parity Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <ParityStats
              targetHotel={data?.target_hotel}
              competitors={data?.competitors || []}
            />
          </motion.div>

          {/* Rate Matrix */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <RateMatrix
              targetHotel={data?.target_hotel}
              competitors={data?.competitors || []}
              userPlan={profile?.plan_type || "trial"}
            />
          </motion.div>

        </div>
      )}
    </div>
  );
}
