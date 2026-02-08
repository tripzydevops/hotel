"use client";

import React from "react";
import Link from "next/link";
import ParityHeader from "@/components/layout/ParityHeader";
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
    <div className="text-slate-100 min-h-screen flex flex-col relative overflow-hidden bg-[#050B18]">
      <div className="radial-glow pointer-events-none" />
      <div className="bg-grain pointer-events-none" />

      <ParityHeader />

      <main className="flex-grow max-w-[1440px] mx-auto w-full p-6 sm:p-8 space-y-8 relative z-10">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl font-bold text-white">
              Rate Parity Monitor
            </h1>
            <p className="text-slate-400 mt-1">
              Real-time discrepancy tracking across OTA channels
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex gap-3"
          >
            <button className="px-6 py-3 bg-[#142541] border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-300 hover:bg-[#1e3459] transition-all flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Oct 2024
            </button>
            <button
              onClick={() => handleScan({})}
              className="px-6 py-3 bg-[#F6C344] rounded-xl text-xs font-bold uppercase tracking-widest text-[#050B18] hover:bg-[#EAB308] hover:scale-105 transition-all flex items-center gap-2 shadow-lg shadow-yellow-500/20 active:scale-95"
            >
              <RefreshCw className="w-4 h-4" /> {t("dashboard.scanNow")}
            </button>
          </motion.div>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <ParityStats
                targetHotel={targetHotel}
                competitors={competitors}
              />
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

      <footer className="w-full py-10 border-t border-white/5 bg-[#050B18]/80 mt-12 relative z-10">
        <div className="max-w-[1440px] mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="metallic-gold p-[1px] rounded-lg">
              <div className="bg-[#050B18] p-1.5 rounded-[7px] flex items-center justify-center">
                <div className="relative w-6 h-6 flex items-center justify-center">
                  <div className="w-1 h-3.5 bg-[#003366] absolute left-1"></div>
                  <div className="w-1 h-3.5 bg-[#003366] absolute right-1"></div>
                  <div className="w-3 h-1 bg-[#003366]"></div>
                  <div className="absolute left-1.5 bottom-1 flex gap-[1px]">
                    <div className="w-0.5 h-1 bg-[#F6C344]"></div>
                    <div className="w-0.5 h-2 bg-[#F6C344]"></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-slate-600 font-bold">
              © 2024 Hotel Plus | Premium Intelligence & Market Analytics
            </div>
          </div>
          <div className="flex gap-8 text-[10px] uppercase tracking-widest font-bold text-slate-500">
            <Link className="hover:text-[#F6C344] transition-colors" href="#">
              System Integrity
            </Link>
            <Link className="hover:text-[#F6C344] transition-colors" href="#">
              Security Protocol
            </Link>
            <Link className="hover:text-[#F6C344] transition-colors" href="#">
              Terminal Help
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
