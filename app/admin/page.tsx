"use client";

import React, { useState, useEffect, useCallback } from "react";
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

// Modular Components
import StatCard from "@/components/admin/StatCard";
import ApiKeysPanel from "@/components/admin/ApiKeysPanel";
import MembershipPlansPanel from "@/components/admin/MembershipPlansPanel";
import UserManagementPanel from "@/components/admin/UserManagementPanel";
import DirectoryPanel from "@/components/admin/DirectoryPanel";
import LogsPanel from "@/components/admin/LogsPanel";
import ScansPanel from "@/components/admin/ScansPanel";

import NeuralFeed from "@/components/admin/NeuralFeed";
import AnalyticsPanel from "@/components/admin/AnalyticsPanel";

export default function AdminPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

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
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
        activeTab === id
          ? "bg-[var(--soft-gold)] text-black font-bold shadow-lg shadow-[var(--soft-gold)]/20"
          : "text-[var(--text-muted)] hover:text-white hover:bg-white/5"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-[var(--deep-ocean)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--soft-gold)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--deep-ocean)] text-white pb-12">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--soft-gold)] flex items-center justify-center">
              <Shield className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Admin Console</h1>
          </div>
          <button
            onClick={() => router.push("/")}
            className="text-sm text-[var(--text-muted)] hover:text-white transition-colors flex items-center gap-1"
          >
            <LayoutDashboard className="w-4 h-4" />
            User Dashboard
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-8">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 bg-black/30 p-1 rounded-xl border border-white/5 w-fit">
          <TabButton id="overview" label="Overview" icon={LayoutDashboard} />
          <TabButton id="users" label="Users" icon={Users} />
          <TabButton id="directory" label="Directory" icon={Building2} />
          <TabButton id="scans" label="Scans" icon={Activity} />
          <TabButton id="analytics" label="Intelligence" icon={LineChart} />
          <TabButton id="plans" label="Plans" icon={Crown} />
          <TabButton id="keys" label="API Keys" icon={Key} />
          <TabButton id="logs" label="System Logs" icon={Database} />
        </div>

        {/* Overview Tab Content */}
        {activeTab === "overview" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Neural Feed */}
            <NeuralFeed />

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                label="Total Users"
                value={stats?.total_users || 0}
                icon={Users}
              />
              <StatCard
                label="Total Hotels"
                value={stats?.total_hotels || 0}
                icon={Building2}
              />
              <StatCard
                label="Total Scans"
                value={stats?.total_scans || 0}
                icon={Search}
              />
              <StatCard
                label="Shared Directory"
                value={stats?.directory_count || 0}
                icon={Database}
              />
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card p-6 border border-white/10 hover:border-[var(--soft-gold)]/30 transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--soft-gold)] transition-colors" />
                </div>
                <h3 className="text-lg font-bold mb-1">Manage Users</h3>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                  Review registrations, usage quotas, and manage user sessions.
                </p>
                <button
                  onClick={() => setActiveTab("users")}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors"
                >
                  Go to Users
                </button>
              </div>

              <div className="glass-card p-6 border border-white/10 hover:border-[var(--soft-gold)]/30 transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--soft-gold)] transition-colors" />
                </div>
                <h3 className="text-lg font-bold mb-1">System Audit</h3>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                  Check logs for scraping errors, API key rotations, and system
                  health.
                </p>
                <button
                  onClick={() => setActiveTab("logs")}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors"
                >
                  View Logs
                </button>
              </div>

              <div className="glass-card p-6 border border-white/10 hover:border-[var(--soft-gold)]/30 transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-[var(--soft-gold)]/10 flex items-center justify-center text-[var(--soft-gold)]">
                    <Key className="w-5 h-5" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--soft-gold)] transition-colors" />
                </div>
                <h3 className="text-lg font-bold mb-1">API Health</h3>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                  Monitor SerpApi key usage, rotation history, and quota status.
                </p>
                <button
                  onClick={() => setActiveTab("keys")}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors"
                >
                  Manage Keys
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content Panels */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === "users" && <UserManagementPanel />}
          {activeTab === "directory" && <DirectoryPanel />}
          {activeTab === "scans" && <ScansPanel />}
          {activeTab === "analytics" && <AnalyticsPanel />}
          {activeTab === "plans" && <MembershipPlansPanel />}
          {activeTab === "keys" && <ApiKeysPanel />}
          {activeTab === "logs" && <LogsPanel />}
        </div>
      </div>
    </div>
  );
}
