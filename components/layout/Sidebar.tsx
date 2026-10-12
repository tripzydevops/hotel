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
  ChevronRight,
  ChevronDown,
  Calendar,
  Radar,
  Heart,
  Share2,
  Shield,
  Sparkles,
  X,
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

interface SidebarProps {
  profile: { 
    role?: string; 
    display_name?: string;
    subscription_status?: string;
    trial_ends_at?: string;
    plan_type?: string;
  } | null;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({
  profile,
  isMobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const { setIsSettingsOpen } = useModalContext();
  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(
    pathname.startsWith("/analysis"),
  );

  const adminItem = {
    label: "Admin Panel",
    href: "/admin",
    icon: Shield,
  };

  const isAnalysisActive = pathname.startsWith("/analysis");

  const renderNavContent = (isMobileDrawer = false) => (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Decorative Gradient Background for Sidebar */}
      <div className="absolute top-0 left-0 w-full h-64 bg-[var(--soft-gold-glow)] blur-[80px] -z-10 pointer-events-none" />

      {/* Logo & Mobile Close Section */}
      <div className="p-6 lg:p-8 flex items-center justify-between shrink-0">
        <HotelPlusLogo variant="sidebar" />
        {isMobileDrawer && onMobileClose && (
          <button
            onClick={onMobileClose}
            className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 px-4 sm:px-6 space-y-1.5 overflow-y-auto custom-scrollbar pb-10">
        {/* Google Hotels */}
        <Link
          href="/dashboard"
          onClick={() => isMobileDrawer && onMobileClose?.()}
          className={`group flex items-center gap-4 px-4 sm:px-5 py-3.5 sm:py-4 rounded-[1.5rem] transition-all relative overflow-hidden ${
            pathname === "/dashboard"
              ? "bg-[var(--soft-gold)]/10 text-[var(--text-primary)] shadow-[var(--soft-gold-glow)] border border-[var(--soft-gold)]/20"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-accent)]"
          }`}
        >
          {pathname === "/dashboard" && (
            <motion.div
              layoutId={isMobileDrawer ? "activeTabGlowMobile" : "activeTabGlow"}
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
            className={`w-full group flex items-center gap-4 px-4 sm:px-5 py-3.5 sm:py-4 rounded-[1.5rem] transition-all relative overflow-hidden ${
              isAnalysisActive
                ? "bg-[var(--soft-gold)]/10 text-[var(--text-primary)] shadow-[var(--soft-gold-glow)] border border-[var(--soft-gold)]/20"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-accent)]"
            }`}
          >
            {isAnalysisActive && (
              <motion.div
                layoutId={isMobileDrawer ? "activeTabGlowMobile" : "activeTabGlow"}
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
                <div className="ml-6 sm:ml-8 mt-2 pl-3 sm:pl-4 border-l border-[var(--glass-border)]/30 space-y-1 my-2">
                  {analysisSubItems.map((subItem) => {
                    const isSubActive = pathname === subItem.href;
                    return (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        onClick={() => isMobileDrawer && onMobileClose?.()}
                        className={`group flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all text-xs font-bold uppercase tracking-widest ${
                          isSubActive
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
          onClick={() => isMobileDrawer && onMobileClose?.()}
          className={`group flex items-center gap-4 px-4 sm:px-5 py-3.5 sm:py-4 rounded-[1.5rem] transition-all relative overflow-hidden ${
            pathname === "/reports"
              ? "bg-[var(--soft-gold)]/10 text-[var(--text-primary)] shadow-[var(--soft-gold-glow)] border border-[var(--soft-gold)]/20"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-accent)]"
          }`}
        >
          {pathname === "/reports" && (
            <motion.div
              layoutId={isMobileDrawer ? "activeTabGlowMobile" : "activeTabGlow"}
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
          <div className="pt-4 sm:pt-6">
            <div className="px-5 mb-4 items-center flex gap-3">
              <div className="h-[1px] bg-[var(--glass-border)] flex-1" />
              <p className="text-[10px] text-[var(--soft-gold)] font-black uppercase tracking-[0.3em] whitespace-nowrap opacity-70">
                Master Control
              </p>
              <div className="h-[1px] bg-[var(--glass-border)] flex-1" />
            </div>
            <Link
              href={adminItem.href}
              onClick={() => isMobileDrawer && onMobileClose?.()}
              className={`group flex items-center gap-4 px-4 sm:px-5 py-3.5 sm:py-4 rounded-[1.5rem] transition-all border ${
                pathname.startsWith("/admin")
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

        <div className="pt-6 sm:pt-8 pb-4">
          <div className="h-[1px] bg-gradient-to-r from-transparent via-[var(--glass-border)] to-transparent w-full" />
        </div>

        {/* Trial Status Widget */}
        {profile?.role !== 'admin' && profile?.subscription_status === 'trial' && (
          <div className="px-2 sm:px-4 mb-4 sm:mb-6">
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
                  animate={{ width: "65%" }}
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
          onClick={() => {
            setIsSettingsOpen(true);
            if (isMobileDrawer) onMobileClose?.();
          }}
          className="w-full group flex items-center gap-4 px-4 sm:px-5 py-3.5 sm:py-4 rounded-[1.5rem] transition-all text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-accent)]"
        >
          <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform" />
          <span className="text-sm font-black tracking-[0.05em] uppercase">Settings</span>
        </button>

        <Link
          href="/help"
          onClick={() => isMobileDrawer && onMobileClose?.()}
          className={`group flex items-center gap-4 px-4 sm:px-5 py-3.5 sm:py-4 rounded-[1.5rem] transition-all relative overflow-hidden ${
            pathname === "/help"
              ? "bg-[var(--soft-gold)]/10 text-[var(--text-primary)] shadow-[var(--soft-gold-glow)] border border-[var(--soft-gold)]/20"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-accent)]"
          }`}
        >
          {pathname === "/help" && (
            <motion.div
              layoutId={isMobileDrawer ? "activeTabGlowMobile" : "activeTabGlow"}
              className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-[var(--soft-gold)] rounded-r-full shadow-[0_0_15px_var(--soft-gold)]"
            />
          )}
          <div className={`${pathname === "/help" ? "text-[var(--soft-gold)]" : "text-[var(--text-muted)] group-hover:text-[var(--soft-gold)]"} transition-colors`}>
            <HelpCircle className="w-5 h-5" />
          </div>
          <span className="text-sm font-black tracking-[0.05em] uppercase">User Guide</span>
          <span className="ml-auto text-[9px] font-bold bg-[var(--soft-gold)]/20 text-[var(--soft-gold)] px-2 py-0.5 rounded-full border border-[var(--soft-gold)]/30">
            Tour
          </span>
        </Link>
      </nav>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Persistent Sidebar (Hidden on < lg) */}
      <aside className="w-72 xl:w-80 glass-panel border-r border-[var(--glass-border)] hidden lg:flex flex-col h-screen sticky top-0 z-40 transition-all duration-500 overflow-hidden shadow-[var(--glass-shadow)] shrink-0">
        {renderNavContent(false)}
      </aside>

      {/* 2. Mobile Drawer Navigation (< lg) */}
      <AnimatePresence>
        {isMobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onMobileClose}
              className="fixed inset-0 bg-black/75 backdrop-blur-md"
              aria-hidden="true"
            />

            {/* Slide-out Sidebar Drawer */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="relative w-80 max-w-[85vw] h-full bg-[#071326] border-r border-[var(--glass-border)] shadow-2xl z-10 flex flex-col overflow-hidden"
            >
              {renderNavContent(true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
