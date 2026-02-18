"use client";

import { useAuth } from "@/hooks/useAuth";
import { useDashboard } from "@/hooks/useDashboard";
import { Share2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import ParityStats from "@/components/analytics/ParityStats";
import RateMatrix from "@/components/analytics/RateMatrix";
import ViolatingChannels from "@/components/analytics/ViolatingChannels";
import { motion } from "framer-motion";

export default function ParityPage() {
  const { t } = useI18n();
  const { userId } = useAuth();
  // Fetch real-time dashboard data including competitors and target hotel
  const { data, profile, loading } = useDashboard(userId, t);

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
        <div className="p-3 rounded-2xl bg-violet-500/10 text-violet-400">
          <Share2 className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">Parity Monitor</h1>
          <p className="text-sm text-[var(--text-muted)]">
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
            <p className="text-sm text-slate-400">
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

          {/* Violating Channels */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <ViolatingChannels
              targetHotel={data?.target_hotel}
              competitors={data?.competitors || []}
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}
