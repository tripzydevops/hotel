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
];

export default function Sidebar({
  profile,
}: {
  profile: { role?: string; full_name?: string } | null;
}) {
  const pathname = usePathname();
  const { setIsSettingsOpen } = useModalContext();
  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(
    pathname.startsWith("/analysis"),
  );

  const navItems = [
    {
      label: "Market Price Search",
      href: "/",
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
    <aside className="w-72 bg-[#050B18] border-r border-white/5 flex flex-col h-screen sticky top-0 z-40">
      {/* Logo Section */}
      <div className="p-8 mb-4">
        <div className="flex items-center gap-4">
          <div className="relative w-10 h-10">
            <div className="absolute left-0 top-0 w-3 h-full bg-[#003366] rounded-sm"></div>
            <div className="absolute right-0 top-0 w-3 h-full bg-[#003366] rounded-sm"></div>
            <div className="absolute left-0 top-[42%] w-full h-2 bg-[#003366]"></div>
            <div className="absolute left-[20%] bottom-0 flex items-end gap-[2px]">
              <div className="w-1.5 h-3 bg-[#F6C344]"></div>
              <div className="w-1.5 h-5 bg-[#F6C344]"></div>
              <div className="w-1.5 h-7 bg-[#F6C344]"></div>
            </div>
            <div className="absolute -right-1 -top-1 w-4 h-4 flex items-center justify-center">
              <div className="absolute w-3.5 h-1 bg-[#F6C344] rounded-full"></div>
              <div className="absolute w-1 h-3.5 bg-[#F6C344] rounded-full"></div>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-white font-black text-xl tracking-tighter leading-none">
              Hotel Plus
            </span>
            <span className="text-[9px] text-[#F6C344]/80 uppercase tracking-[0.3em] font-black mt-1.5">
              Enterprise Core
            </span>
          </div>
        </div>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {/* Market Price Search */}
        <Link
          href="/"
          className={`group flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all relative overflow-hidden ${
            pathname === "/"
              ? "bg-blue-600/90 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          {pathname === "/" && (
            <motion.div
              layoutId="activeTab"
              className="absolute left-0 top-0 w-1 h-full bg-white rounded-r-full"
            />
          )}
          <LayoutGrid className="w-5 h-5" />
          <span className="text-sm font-bold tracking-tight">
            Market Price Search
          </span>
          {pathname === "/" && (
            <ChevronRight className="ml-auto w-4 h-4 opacity-50" />
          )}
        </Link>

        {/* Market Analysis - Collapsible */}
        <div>
          <button
            onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
            className={`w-full group flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all relative overflow-hidden ${
              isAnalysisActive
                ? "bg-blue-600/90 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {isAnalysisActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute left-0 top-0 w-1 h-full bg-white rounded-r-full"
              />
            )}
            <BarChart3 className="w-5 h-5" />
            <span className="text-sm font-bold tracking-tight">
              Market Analysis
            </span>
            <motion.div
              animate={{ rotate: isAnalysisExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="ml-auto"
            >
              <ChevronDown className="w-4 h-4 opacity-50" />
            </motion.div>
          </button>

          {/* Sub-menu */}
          <AnimatePresence>
            {isAnalysisExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="ml-4 mt-1 pl-4 border-l border-white/10 space-y-1">
                  {analysisSubItems.map((subItem) => {
                    const isSubActive = pathname === subItem.href;
                    return (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
                          isSubActive
                            ? "bg-white/10 text-white font-bold"
                            : "text-slate-500 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        <subItem.icon className="w-4 h-4" />
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
          className={`group flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all relative overflow-hidden ${
            pathname === "/reports"
              ? "bg-blue-600/90 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          {pathname === "/reports" && (
            <motion.div
              layoutId="activeTab"
              className="absolute left-0 top-0 w-1 h-full bg-white rounded-r-full"
            />
          )}
          <FileText className="w-5 h-5" />
          <span className="text-sm font-bold tracking-tight">Reports</span>
          {pathname === "/reports" && (
            <ChevronRight className="ml-auto w-4 h-4 opacity-50" />
          )}
        </Link>

        {/* Admin Section */}
        {profile?.role === "admin" && (
          <>
            <div className="pt-4 pb-2 px-4">
              <div className="h-[1px] bg-white/5 w-full" />
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-4 ml-1">
                Management
              </p>
            </div>
            <Link
              href={adminItem.href}
              className={`group flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all ${
                pathname.startsWith("/admin")
                  ? "bg-amber-600/20 text-amber-500 border border-amber-600/30"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <adminItem.icon
                className={`w-5 h-5 ${pathname.startsWith("/admin") ? "text-amber-500" : "group-hover:text-amber-500 transition-colors"}`}
              />
              <span className="text-sm font-bold tracking-tight">
                {adminItem.label}
              </span>
            </Link>
          </>
        )}

        <div className="pt-8 pb-4 px-4">
          <div className="h-[1px] bg-white/5 w-full" />
        </div>

        {/* Secondary Navigation */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all text-slate-500 hover:text-white hover:bg-white/5"
        >
          <Settings className="w-5 h-5" />
          <span className="text-sm font-bold tracking-tight">Settings</span>
        </button>

        <Link
          href="/help"
          className="flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all text-slate-500 hover:text-white hover:bg-white/5"
        >
          <HelpCircle className="w-5 h-5" />
          <span className="text-sm font-bold tracking-tight">Help Center</span>
        </Link>
      </nav>

      {/* Footer Section */}
      <div className="p-6 mt-auto">
        <button className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 text-white rounded-2xl transition-all group active:scale-95 shadow-xl">
          <Download className="w-4 h-4 text-[#F6C344] group-hover:scale-110 transition-transform" />
          <span className="text-xs font-black uppercase tracking-widest">
            Export Data
          </span>
        </button>
      </div>
    </aside>
  );
}
