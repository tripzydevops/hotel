"use client";

import React, { useState } from "react";
import { 
  RefreshCw, 
  Users, 
  Database, 
  ShieldAlert, 
  Activity,
  CheckCircle2,
  AlertCircle,
  Loader2
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/ToastContext";
import { motion } from "framer-motion";

const MaintenancePanel = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSync = async (type: "directory" | "profiles" | "all") => {
    const messages = {
      directory: "Scan all user hotels and update the master directory?",
      profiles: "Update all user profile metadata and search preferences?",
      all: "Perform a full system synchronization? This may take several minutes."
    };

    if (!confirm(messages[type])) return;

    setLoading(type);
    try {
      let res;
      if (type === "directory") {
        res = await api.syncDirectory();
        toast.success(`Directory synced: ${res.synced_count} hotels updated.`);
      } else if (type === "profiles") {
        res = await api.syncProfiles();
        toast.success("User profiles synchronization triggered successfully.");
      } else if (type === "all") {
        res = await api.syncAll();
        toast.success("Full system synchronization triggered successfully.");
      }
    } catch (err: any) {
      toast.error(`Synchronization failed: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  const ActionCard = ({ 
    title, 
    description, 
    icon: Icon, 
    onClick, 
    isLoading, 
    variant = "gold" 
  }: any) => {
    const colors = {
      gold: "border-[var(--soft-gold)]/20 text-[var(--soft-gold)] bg-[var(--soft-gold)]/5 hover:bg-[var(--soft-gold)]/10 hover:border-[var(--soft-gold)]/40",
      blue: "border-blue-500/20 text-blue-400 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/40",
      purple: "border-purple-500/20 text-purple-400 bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/40"
    };

    const color = colors[variant as keyof typeof colors] || colors.gold;

    return (
      <motion.div 
        whileHover={{ y: -4 }}
        className={`glass-card p-6 border ${color} transition-all duration-300 flex flex-col h-full`}
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-current opacity-60">
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Icon className="w-6 h-6" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest">{title}</h3>
            <p className="text-[10px] opacity-60 uppercase tracking-tighter mt-1">System Operation</p>
          </div>
        </div>
        
        <p className="text-xs text-[var(--text-muted)] flex-1 mb-6 leading-relaxed">
          {description}
        </p>

        <button
          disabled={!!loading}
          onClick={onClick}
          className="w-full py-3 rounded-xl bg-white/5 border border-current font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:bg-current hover:text-[var(--deep-ocean)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Executing..." : "Execute Sync"}
        </button>
      </motion.div>
    );
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex items-center gap-4 p-6 bg-white/[0.02] border border-[var(--overlay-border)] rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-5 rotate-12">
          <ShieldAlert className="w-20 h-20 text-[var(--soft-gold)]" />
        </div>
        <div className="w-12 h-12 rounded-xl bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 flex items-center justify-center">
          <Activity className="w-6 h-6 text-[var(--soft-gold)]" />
        </div>
        <div>
          <h2 className="text-base font-bold text-[var(--overlay-text)] tracking-tight">System Maintenance & Synchronization</h2>
          <p className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-widest mt-1">
            Manual override for background data orchestration tasks
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ActionCard
          title="Directory Sync"
          description="Analyzes all user-specific hotel data and synchronizes it with the master asset inventory. Ensures all monitored properties are correctly indexed."
          icon={Database}
          variant="gold"
          onClick={() => handleSync("directory")}
          isLoading={loading === "directory"}
        />
        
        <ActionCard
          title="Profile Metadata Sync"
          description="Synchronizes user profile metadata, search preferences, and account status across the neural engine. Fixes inconsistencies in user-level caching."
          icon={Users}
          variant="blue"
          onClick={() => handleSync("profiles")}
          isLoading={loading === "profiles"}
        />

        <ActionCard
          title="Full System Sync"
          description="Orchestrates a comprehensive synchronization across directory, profiles, and scan caches. Use this for deep state recovery or manual database re-indexing."
          icon={RefreshCw}
          variant="purple"
          onClick={() => handleSync("all")}
          isLoading={loading === "all"}
        />
      </div>

      {/* Maintenance Logs Placeholder / Information */}
      <div className="glass-card p-8 border border-[var(--overlay-border)] bg-gradient-to-br from-white/[0.01] to-transparent">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-[var(--overlay-text)] uppercase tracking-widest">Operation Advisory</h4>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-2xl">
              These operations interact directly with core background logic. While safe for production, "Full System Sync" may temporarily increase database I/O and latency for end-users. It is recommended to perform these tasks during off-peak hours.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePanel;
