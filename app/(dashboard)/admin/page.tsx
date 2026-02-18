"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import {
  Users,
  Building2,
  Key,
  Database,
  Search,
  ArrowRight,
  TrendingUp,
  Activity,
  UserPlus,
  Shield,
  Loader2,
  LayoutDashboard,
  Crown,
  LineChart,
} from "lucide-react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { AdminStats } from "@/types";
import { useToast } from "@/components/ui/ToastContext";
import { motion, AnimatePresence } from "framer-motion";

// Modular Components
import StatCard from "@/components/admin/StatCard";
import ApiKeysPanel from "@/components/admin/ApiKeysPanel";
import MembershipPlansPanel from "@/components/admin/MembershipPlansPanel";
import UserManagementPanel from "@/components/admin/UserManagementPanel";
import DirectoryPanel from "@/components/admin/DirectoryPanel";
import LogsPanel from "@/components/admin/LogsPanel";
import ScansPanel from "@/components/admin/ScansPanel";
import SystemHealthPanel from "@/components/admin/SystemHealthPanel";
import LandingPageEditor from "@/components/admin/LandingPageEditor";

import NeuralFeed from "@/components/admin/NeuralFeed";
import AnalyticsPanel from "@/components/admin/AnalyticsPanel";
import ReportGeneratorPanel from "@/components/admin/ReportGeneratorPanel";
import { FileText } from "lucide-react";

export default function AdminPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAdminStats();
      setStats(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error("Failed to load stats: " + err.message);
      } else {
        toast.error("An unknown error occurred");
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const TabButton = ({
    id,
    label,
    icon: Icon,
  }: {
    id: string;
    label: string;
    icon: any;
  }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-300 relative overflow-hidden group ${
        activeTab === id
          ? "bg-[var(--soft-gold)] text-[var(--deep-ocean)] font-bold shadow-lg shadow-[var(--soft-gold)]/20 scale-[1.02]"
          : "text-[var(--text-secondary)] hover:text-white hover:bg-white/5"
      }`}
    >
      <Icon
        className={`w-4 h-4 transition-transform duration-300 ${activeTab === id ? "scale-110" : "group-hover:scale-110"}`}
      />
      <span className="text-sm tracking-tight">{label}</span>
      {activeTab === id && (
        <motion.div
          layoutId="activeTabGlow"
          className="absolute inset-0 bg-white/20 pointer-events-none"
          initial={false}
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
    </button>
  );

  if (loading && !stats) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[var(--soft-gold)] mb-4" />
        <p className="text-[var(--text-muted)] font-mono text-xs uppercase tracking-widest animate-pulse">
          Establishing Neural Link...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Navigation Tabs - Dock Style */}
      <div className="flex items-center p-1.5 bg-[var(--deep-ocean-card)]/40 backdrop-blur-md rounded-2xl border border-white/5 w-fit shadow-2xl">
        <TabButton id="overview" label="Overview" icon={LayoutDashboard} />
        <div className="w-px h-6 bg-white/5 mx-1" />
        <TabButton id="users" label="Users" icon={Users} />
        <TabButton id="directory" label="Directory" icon={Building2} />
        <TabButton id="scans" label="Scans" icon={Activity} />
        <TabButton id="analytics" label="Intelligence" icon={LineChart} />
        <TabButton id="reports" label="Reports" icon={FileText} />
        <div className="w-px h-6 bg-white/5 mx-1" />
        <TabButton id="plans" label="Plans" icon={Crown} />
        <TabButton id="keys" label="API Keys" icon={Key} />
        <TabButton id="landing" label="Landing Page" icon={LayoutDashboard} />
        <TabButton id="logs" label="System Logs" icon={Database} />
      </div>

      {/* Overview Tab Content - High-Fidelity Bento Orchestration */}
      {activeTab === "overview" && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          {/* Neural Health Matrix - Full Width */}
          <SystemHealthPanel stats={stats} />

          {/* EXPLANATION: Grid Layout Fix for Terminal/Stat card overlap.
              Using min-w-0 prevents child overflow in grid cells on smaller screens. 
              Removed md:grid-rows-2 to allow natural height flow for StatCards. */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Main Command Feed - Large Bento Cell */}
            {/* EXPLANATION: Upgraded to 12-column grid for surgical precision.
                NeuralFeed takes 9/12 (75%) space, leaving 3/12 for stats.
                min-w-0 + overflow-hidden on cellular level prevents bleed. */}
            <div className="lg:col-span-9 min-w-0 overflow-hidden">
              <NeuralFeed />
            </div>

            {/* Vertical Stat Column */}
            <div className="lg:col-span-3 flex flex-col gap-6 h-full min-w-0">
              <StatCard
                label="Intelligence nodes"
                value={stats?.total_users || 0}
                icon={Users}
                trend="up"
              />
              <StatCard
                label="Monitored Entities"
                value={stats?.total_hotels || 0}
                icon={Building2}
                trend="neutral"
              />
              <StatCard
                label="Network Cycles"
                value={stats?.total_scans || 0}
                icon={Activity}
                trend="up"
              />
            </div>
          </div>

          {/* Quick Action Tiles - Lower Bento Band (Simplified for impact) */}
          <div className="col-span-full grid grid-cols-1 md:grid-cols-3 gap-6 order-3 mt-4">
            <motion.button
              whileHover={{ y: -4, scale: 1.01 }}
              onClick={() => setActiveTab("users")}
              className="command-card p-6 flex items-center gap-5 group relative"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 transition-all">
                <UserPlus className="w-7 h-7" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-black uppercase tracking-widest text-white">
                  Personnel Manager
                </h3>
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-tighter mt-1">
                  Review Quotas & Access
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-[var(--text-muted)] ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </motion.button>

            <motion.button
              whileHover={{ y: -4, scale: 1.01 }}
              onClick={() => setActiveTab("logs")}
              className="command-card p-6 flex items-center gap-5 group relative"
            >
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 transition-all">
                <Activity className="w-7 h-7" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-black uppercase tracking-widest text-white">
                  System Diagnostics
                </h3>
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-tighter mt-1">
                  Trace Kernel Operations
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-[var(--text-muted)] ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </motion.button>

            <motion.button
              whileHover={{ y: -4, scale: 1.01 }}
              onClick={() => setActiveTab("keys")}
              className="command-card p-6 flex items-center gap-5 group relative"
            >
              <div className="w-14 h-14 rounded-2xl bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 flex items-center justify-center text-[var(--soft-gold)] group-hover:bg-[var(--soft-gold)]/20 transition-all">
                <Key className="w-7 h-7" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-black uppercase tracking-widest text-white">
                  Access Gateway
                </h3>
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-tighter mt-1">
                  Rotate Protocol Keys
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-[var(--text-muted)] ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </motion.button>
          </div>
        </div>
      )}

      {/* Tab Content Panels */}
      <div className="mt-12">
        <Suspense
          fallback={
            <div className="p-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--soft-gold)] mx-auto" />
            </div>
          }
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === "users" && <UserManagementPanel />}
              {activeTab === "directory" && <DirectoryPanel />}
              {activeTab === "scans" && <ScansPanel />}
              {activeTab === "analytics" && <AnalyticsPanel />}
              {activeTab === "reports" && <ReportGeneratorPanel />}
              {activeTab === "plans" && <MembershipPlansPanel />}
              {activeTab === "keys" && <ApiKeysPanel />}
              {activeTab === "landing" && <LandingPageEditor />}
              {activeTab === "logs" && <LogsPanel />}
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </div>
    </div>
  );
}
