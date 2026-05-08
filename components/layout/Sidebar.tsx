"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  LayoutGrid,
  FileText,
  Settings,
  HelpCircle,
  Download,
  ChevronRight,
  ChevronDown,
  Calendar,
  Radar,
  Heart,
  Share2,
  Shield,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import HotelPlusLogo from "@/components/ui/HotelPlusLogo";

import { useModalContext } from "@/components/ui/ModalContext";

// Sub-menu items for Market Analysis
const analysisSubItems = [
  {
    label: "Overview",
    href: "/analysis",
    icon: BarChart3,
  },
  {
    label: "Rate Calendar",
    href: "/analysis/calendar",
    icon: Calendar,
  },
  {
    label: "Discovery Engine",
    href: "/analysis/discovery",
    icon: Radar,
  },
  {
    label: "Sentiment",
    href: "/analysis/sentiment",
    icon: Heart,
  },
  {
    label: "Parity Monitor",
    href: "/analysis/parity",
    icon: Share2,
  },
  {
    label: "Market Intelligence",
    href: "/dashboard/market-intelligence",
    icon: BarChart3,
  },
];

export default function Sidebar({
  profile,
}: {
  profile: { 
    role?: string; 
    display_name?: string;
    subscription_status?: string;
    trial_ends_at?: string;
    plan_type?: string;
  } | null;
}) {
  const pathname = usePathname();
  const { setIsSettingsOpen } = useModalContext();
  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(
    pathname.startsWith("/analysis"),
  );

  const navItems = [
    {
      label: "Google Hotels",
      href: "/dashboard",
      icon: LayoutGrid,
    },
    {
      label: "Reports",
      href: "/reports",
      icon: FileText,
    },
  ];

  const adminItem = {
    label: "Admin Panel",
    href: "/admin",
    icon: Shield,
  };

  const isAnalysisActive = pathname.startsWith("/analysis");

  return (
    <aside className="w-80 glass-panel border-r border-[var(--glass-border)] flex flex-col h-screen sticky top-0 z-40 transition-all duration-500 overflow-hidden shadow-[var(--glass-shadow)]">
      {/* Decorative Gradient Background for Sidebar */}
      <div className="absolute top-0 left-0 w-full h-64 bg-[var(--soft-gold-glow)] blur-[80px] -z-10" />

      {/* Logo Section */}
      <div className="p-10 mb-2">
        <HotelPlusLogo variant="sidebar" />
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 px-6 space-y-1.5 overflow-y-auto custom-scrollbar pb-10">
        {/* Google Hotels */}
        <Link
          href="/dashboard"
          className={`group flex items-center gap-4 px-5 py-4 rounded-[1.5rem] transition-all relative overflow-hidden ${pathname === "/dashboard"
            ? "bg-[var(--soft-gold)]/10 text-[var(--text-primary)] shadow-[var(--soft-gold-glow)] border border-[var(--soft-gold)]/20"
            : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-accent)]"
            }`}
        >
          {pathname === "/dashboard" && (
            <motion.div
              layoutId="activeTabGlow"
              className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-[var(--soft-gold)] rounded-r-full shadow-[0_0_15px_var(--soft-gold)]"
            />
          )}
          <div className={`${pathname === "/dashboard" ? "text-[var(--soft-gold)]" : "text-[var(--text-muted)] group-hover:text-[var(--soft-gold)]"} transition-colors`}>
            <LayoutGrid className="w-5 h-5" />
          </div>
          <span className="text-sm font-black tracking-[0.05em] uppercase">
            Google Hotels
          </span>
          {pathname === "/dashboard" && (
            <ChevronRight className="ml-auto w-4 h-4 text-[var(--soft-gold)] opacity-50" />
          )}
        </Link>

        {/* Market Analysis - Collapsible */}
        <div className="pt-2">
          <button
            onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
            className={`w-full group flex items-center gap-4 px-5 py-4 rounded-[1.5rem] transition-all relative overflow-hidden ${isAnalysisActive
              ? "bg-[var(--soft-gold)]/10 text-[var(--text-primary)] shadow-[var(--soft-gold-glow)] border border-[var(--soft-gold)]/20"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-accent)]"
              }`}
          >
            {isAnalysisActive && (
              <motion.div
                layoutId="activeTabGlow"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-[var(--soft-gold)] rounded-r-full shadow-[0_0_15px_var(--soft-gold)]"
              />
            )}
            <div className={`${isAnalysisActive ? "text-[var(--soft-gold)]" : "text-[var(--text-muted)] group-hover:text-[var(--soft-gold)]"} transition-colors`}>
              <BarChart3 className="w-5 h-5" />
            </div>
            <span className="text-sm font-black tracking-[0.05em] uppercase">
              Analysis
            </span>
            <motion.div
              animate={{ rotate: isAnalysisExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="ml-auto"
            >
              <ChevronDown className={`w-4 h-4 opacity-50 ${isAnalysisActive ? "text-[var(--soft-gold)]" : ""}`} />
            </motion.div>
          </button>

          {/* Sub-menu */}
          <AnimatePresence>
            {isAnalysisExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "circOut" }}
                className="overflow-hidden"
              >
                <div className="ml-8 mt-2 pl-4 border-l border-[var(--glass-border)]/30 space-y-1 my-2">
                  {analysisSubItems.map((subItem) => {
                    const isSubActive = pathname === subItem.href;
                    return (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        className={`group flex items-center gap-4 px-4 py-3 rounded-xl transition-all text-xs font-bold uppercase tracking-widest ${isSubActive
                          ? "bg-[var(--glass-bg-accent)] text-[var(--text-primary)] border border-[var(--glass-border)] shadow-lg"
                          : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-accent)]"
                          }`}
                      >
                        <subItem.icon className={`w-3.5 h-3.5 ${isSubActive ? "text-[var(--soft-gold)]" : "text-[var(--text-muted)] group-hover:text-[var(--soft-gold)]"}`} />
                        <span>{subItem.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Reports */}
        <Link
          href="/reports"
          className={`group flex items-center gap-4 px-5 py-4 rounded-[1.5rem] transition-all relative overflow-hidden ${pathname === "/reports"
            ? "bg-[var(--soft-gold)]/10 text-[var(--text-primary)] shadow-[var(--soft-gold-glow)] border border-[var(--soft-gold)]/20"
            : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-accent)]"
            }`}
        >
          {pathname === "/reports" && (
            <motion.div
              layoutId="activeTabGlow"
              className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-[var(--soft-gold)] rounded-r-full shadow-[0_0_15px_var(--soft-gold)]"
            />
          )}
          <div className={`${pathname === "/reports" ? "text-[var(--soft-gold)]" : "text-[var(--text-muted)] group-hover:text-[var(--soft-gold)]"} transition-colors`}>
            <FileText className="w-5 h-5" />
          </div>
          <span className="text-sm font-black tracking-[0.05em] uppercase">Reports</span>
          {pathname === "/reports" && (
            <ChevronRight className="ml-auto w-4 h-4 text-[var(--soft-gold)] opacity-50" />
          )}
        </Link>

        {/* Admin Section */}
        {profile?.role === "admin" && (
          <div className="pt-6">
            <div className="px-5 mb-4 items-center flex gap-3">
              <div className="h-[1px] bg-[var(--glass-border)] flex-1" />
              <p className="text-[10px] text-[var(--soft-gold)] font-black uppercase tracking-[0.3em] whitespace-nowrap opacity-70">
                Master Control
              </p>
              <div className="h-[1px] bg-[var(--glass-border)] flex-1" />
            </div>
            <Link
              href={adminItem.href}
              className={`group flex items-center gap-4 px-5 py-4 rounded-[1.5rem] transition-all border ${pathname.startsWith("/admin")
                ? "bg-[var(--alert-red)]/10 text-[var(--alert-red)] border-[var(--alert-red)]/20 shadow-[0_8px_25px_var(--alert-red-soft)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-accent)] border-transparent"
                }`}
            >
              <adminItem.icon
                className={`w-5 h-5 ${pathname.startsWith("/admin") ? "text-[var(--alert-red)]" : "group-hover:text-[var(--alert-red)] transition-colors"}`}
              />
              <span className="text-sm font-black tracking-[0.05em] uppercase">
                {adminItem.label}
              </span>
            </Link>
          </div>
        )}

        <div className="pt-10 pb-6">
           <div className="h-[1px] bg-gradient-to-r from-transparent via-[var(--glass-border)] to-transparent w-full" />
        </div>

        {/* Trial Status Widget */}
        {profile?.role !== 'admin' && profile?.subscription_status === 'trial' && (
          <div className="px-5 mb-6">
            <div className="glass-card p-4 rounded-3xl border border-[var(--soft-gold)]/20 bg-[var(--soft-gold)]/5 relative overflow-hidden group/trial">
              <div className="absolute top-0 right-0 w-16 h-16 bg-[var(--soft-gold)]/10 blur-2xl -z-10 group-hover/trial:scale-150 transition-transform duration-700" />
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-[10px] font-black text-[var(--soft-gold)] uppercase tracking-widest mb-1">Trial Status</p>
                  <p className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                    {(() => {
                      const end = new Date(profile.trial_ends_at || Date.now());
                      const diff = end.getTime() - Date.now();
                      const days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
                      return `${days} Days Remaining`;
                    })()}
                  </p>
                </div>
                <Sparkles className="w-4 h-4 text-[var(--soft-gold)] animate-pulse" />
              </div>
              <div className="w-full bg-[var(--glass-bg-accent)] h-1 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "65%" }} // Hardcoded for aesthetics or could be calculated if we had total trial duration
                  className="h-full bg-gradient-to-r from-[var(--soft-gold-dim)] to-[var(--soft-gold)]"
                />
              </div>
              <p className="text-[9px] text-[var(--text-muted)] font-medium mt-2 leading-tight uppercase tracking-wider">
                Upgrade to preserve access to premium market insights
              </p>
            </div>
          </div>
        )}

        {/* Settings & Help */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="w-full group flex items-center gap-4 px-5 py-4 rounded-[1.5rem] transition-all text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-accent)]"
        >
          <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform" />
          <span className="text-sm font-black tracking-[0.05em] uppercase">Settings</span>
        </button>

        <Link
          href="/help"
          className="group flex items-center gap-4 px-5 py-4 rounded-[1.5rem] transition-all text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-accent)]"
        >
          <HelpCircle className="w-5 h-5" />
          <span className="text-sm font-black tracking-[0.05em] uppercase">Help Center</span>
        </Link>
      </nav>
    </aside>
  );
}
