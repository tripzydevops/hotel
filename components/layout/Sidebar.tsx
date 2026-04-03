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
  profile: { role?: string; display_name?: string } | null;
}) {
  const pathname = usePathname();
  const { setIsSettingsOpen } = useModalContext();
  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(
    pathname.startsWith("/analysis"),
  );

  const navItems = [
    {
      label: "Market Price Search",
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
    <aside className="w-80 glass-panel border-r border-white/5 flex flex-col h-screen sticky top-0 z-40 transition-all duration-500 overflow-hidden shadow-[20px_0_50px_rgba(0,0,0,0.2)]">
      {/* Decorative Gradient Background for Sidebar */}
      <div className="absolute top-0 left-0 w-full h-64 bg-indigo-600/5 blur-[80px] -z-10" />

      {/* Logo Section */}
      <div className="p-10 mb-2">
        <HotelPlusLogo variant="sidebar" />
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 px-6 space-y-1.5 overflow-y-auto custom-scrollbar pb-10">
        {/* Market Price Search */}
        <Link
          href="/dashboard"
          className={`group flex items-center gap-4 px-5 py-4 rounded-[1.5rem] transition-all relative overflow-hidden ${pathname === "/dashboard"
            ? "bg-indigo-600/10 text-white shadow-[0_8px_25px_rgba(79,70,229,0.15)] border border-indigo-500/20"
            : "text-[var(--text-muted)] hover:text-white hover:bg-white/[0.04]"
            }`}
        >
          {pathname === "/dashboard" && (
            <motion.div
              layoutId="activeTabGlow"
              className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-indigo-500 rounded-r-full shadow-[0_0_15px_rgba(99,102,241,0.8)]"
            />
          )}
          <div className={`${pathname === "/dashboard" ? "text-indigo-400" : "text-[var(--text-muted)] group-hover:text-indigo-400"} transition-colors`}>
            <LayoutGrid className="w-5 h-5" />
          </div>
          <span className="text-sm font-black tracking-[0.05em] uppercase">
            Market Search
          </span>
          {pathname === "/dashboard" && (
            <ChevronRight className="ml-auto w-4 h-4 text-indigo-400 opacity-50" />
          )}
        </Link>

        {/* Market Analysis - Collapsible */}
        <div className="pt-2">
          <button
            onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
            className={`w-full group flex items-center gap-4 px-5 py-4 rounded-[1.5rem] transition-all relative overflow-hidden ${isAnalysisActive
              ? "bg-indigo-600/10 text-white shadow-[0_8px_25px_rgba(79,70,229,0.15)] border border-indigo-500/20"
              : "text-[var(--text-muted)] hover:text-white hover:bg-white/[0.04]"
              }`}
          >
            {isAnalysisActive && (
              <motion.div
                layoutId="activeTabGlow"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-indigo-500 rounded-r-full shadow-[0_0_15px_rgba(99,102,241,0.8)]"
              />
            )}
            <div className={`${isAnalysisActive ? "text-indigo-400" : "text-[var(--text-muted)] group-hover:text-indigo-400"} transition-colors`}>
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
              <ChevronDown className={`w-4 h-4 opacity-50 ${isAnalysisActive ? "text-indigo-400" : ""}`} />
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
                <div className="ml-8 mt-2 pl-4 border-l border-white/5 space-y-1 my-2">
                  {analysisSubItems.map((subItem) => {
                    const isSubActive = pathname === subItem.href;
                    return (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        className={`group flex items-center gap-4 px-4 py-3 rounded-xl transition-all text-xs font-bold uppercase tracking-widest ${isSubActive
                          ? "bg-white/[0.06] text-white border border-white/5 shadow-lg"
                          : "text-[var(--text-muted)] hover:text-white hover:bg-white/[0.03]"
                          }`}
                      >
                        <subItem.icon className={`w-3.5 h-3.5 ${isSubActive ? "text-indigo-400" : "text-[var(--text-muted)] group-hover:text-indigo-400"}`} />
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
            ? "bg-indigo-600/10 text-white shadow-[0_8px_25px_rgba(79,70,229,0.15)] border border-indigo-500/20"
            : "text-[var(--text-muted)] hover:text-white hover:bg-white/[0.04]"
            }`}
        >
          {pathname === "/reports" && (
            <motion.div
              layoutId="activeTabGlow"
              className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-indigo-500 rounded-r-full shadow-[0_0_15px_rgba(99,102,241,0.8)]"
            />
          )}
          <div className={`${pathname === "/reports" ? "text-indigo-400" : "text-[var(--text-muted)] group-hover:text-indigo-400"} transition-colors`}>
            <FileText className="w-5 h-5" />
          </div>
          <span className="text-sm font-black tracking-[0.05em] uppercase">Reports</span>
          {pathname === "/reports" && (
            <ChevronRight className="ml-auto w-4 h-4 text-indigo-400 opacity-50" />
          )}
        </Link>

        {/* Admin Section */}
        {profile?.role === "admin" && (
          <div className="pt-6">
            <div className="px-5 mb-4 items-center flex gap-3">
              <div className="h-[1px] bg-white/5 flex-1" />
              <p className="text-[10px] text-indigo-400/60 font-black uppercase tracking-[0.3em] whitespace-nowrap">
                Master Control
              </p>
              <div className="h-[1px] bg-white/5 flex-1" />
            </div>
            <Link
              href={adminItem.href}
              className={`group flex items-center gap-4 px-5 py-4 rounded-[1.5rem] transition-all border ${pathname.startsWith("/admin")
                ? "bg-rose-600/10 text-rose-400 border-rose-500/20 shadow-[0_8px_25px_rgba(225,29,72,0.1)]"
                : "text-[var(--text-muted)] hover:text-white hover:bg-white/[0.04] border-transparent"
                }`}
            >
              <adminItem.icon
                className={`w-5 h-5 ${pathname.startsWith("/admin") ? "text-rose-400" : "group-hover:text-rose-400 transition-colors"}`}
              />
              <span className="text-sm font-black tracking-[0.05em] uppercase">
                {adminItem.label}
              </span>
            </Link>
          </div>
        )}

        <div className="pt-10 pb-6">
           <div className="h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent w-full" />
        </div>

        {/* Settings & Help */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="w-full group flex items-center gap-4 px-5 py-4 rounded-[1.5rem] transition-all text-[var(--text-muted)] hover:text-white hover:bg-white/[0.04]"
        >
          <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform" />
          <span className="text-sm font-black tracking-[0.05em] uppercase">Settings</span>
        </button>

        <Link
          href="/help"
          className="group flex items-center gap-4 px-5 py-4 rounded-[1.5rem] transition-all text-[var(--text-muted)] hover:text-white hover:bg-white/[0.04]"
        >
          <HelpCircle className="w-5 h-5" />
          <span className="text-sm font-black tracking-[0.05em] uppercase">Help Center</span>
        </Link>
      </nav>
    </aside>
  );
}
