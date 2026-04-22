"use client";

import React from "react";
import { Database, ArrowLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import ScansPanel from "@/components/admin/ScansPanel";
import { motion } from "framer-motion";

export default function AdminScansPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--deep-ocean)] text-[var(--overlay-text)] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <button
              onClick={() => router.push("/admin")}
              className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--soft-gold)] transition-colors group mb-4"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-bold uppercase tracking-widest">Back to Dashboard</span>
            </button>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[var(--soft-gold)]/10 rounded-2xl border border-[var(--soft-gold)]/20 shadow-xl shadow-[var(--soft-gold)]/5">
                <Database className="w-8 h-8 text-[var(--soft-gold)]" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">
                  Scan <span className="text-[var(--soft-gold)] underline decoration-wavy decoration-[var(--soft-gold)]/30 underline-offset-8">Intelligence</span>
                </h1>
                <p className="text-[var(--text-muted)] text-sm font-medium mt-1 uppercase tracking-tight">
                  Comprehensive audit trail and raw payload extraction vault
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <div className="relative group hidden md:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--soft-gold)] transition-colors" />
              <input 
                type="text" 
                placeholder="Search scans..." 
                className="bg-white/5 border border-[var(--overlay-border)] rounded-xl py-3 pl-12 pr-6 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/30 focus:border-[var(--soft-gold)]/30 transition-all w-64 group-hover:bg-white/10"
              />
            </div>
          </div>
        </div>

        {/* Intelligence Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="space-y-6"
        >
          <ScansPanel />
        </motion.div>

        {/* Footer info */}
        <div className="flex items-center justify-between pt-8 border-t border-[var(--overlay-border)] text-[var(--text-muted)] text-[10px] uppercase font-black tracking-widest">
          <div className="flex items-center gap-4">
            <span>&copy; 2024 HotelPlus Systems</span>
            <span className="h-1 w-1 bg-white/20 rounded-full" />
            <span>Infrastructure: Multi-Region</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 bg-[var(--optimal-green)] rounded-full animate-pulse" />
            <span>Live Sync Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
