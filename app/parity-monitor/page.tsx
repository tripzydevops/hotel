"use client";

import React from "react";
import Link from "next/link";
import ParityStats from "@/components/analytics/ParityStats";
import RateMatrix from "@/components/analytics/RateMatrix";
import ViolatingChannels from "@/components/analytics/ViolatingChannels";
import { Calendar, RefreshCw, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useDashboard } from "@/hooks/useDashboard";
import { useI18n } from "@/lib/i18n";

export default function ParityMonitorPage() {
  const { t } = useI18n();
  const { userId } = useAuth();
  const { data, loading, handleScan } = useDashboard(userId, t);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050B18] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[var(--soft-gold)] animate-spin" />
      </div>
    );
  }

  const targetHotel = data?.target_hotel;
  const competitors = data?.competitors || [];

  return (
    <main className="max-w-[1440px] mx-auto w-full relative z-10">
      {/* Bento Grid */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <ParityStats targetHotel={targetHotel} competitors={competitors} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex-grow"
          >
            <RateMatrix targetHotel={targetHotel} competitors={competitors} />
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="col-span-12 lg:col-span-4"
        >
          <ViolatingChannels
            targetHotel={targetHotel}
            competitors={competitors}
          />
        </motion.div>
      </div>
    </main>
  );
}
