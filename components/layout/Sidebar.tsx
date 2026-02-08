"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  LayoutGrid,
  FileText,
  Share2,
  Settings,
  HelpCircle,
  Download,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";

import { useModalContext } from "@/components/ui/ModalContext";
import { Shield } from "lucide-react";

export default function Sidebar({
  profile,
}: {
  profile: { role?: string; full_name?: string } | null;
}) {
  const pathname = usePathname();
  const { setIsSettingsOpen } = useModalContext();

  const navItems = [
    {
      label: "Market Price Search",
      href: "/",
      icon: LayoutGrid,
    },
    {
      label: "Market Analysis",
      href: "/analysis",
      icon: BarChart3,
    },
    {
      label: "Reports",
      href: "/reports",
      icon: FileText,
    },
    {
      label: "Parity Monitor",
      href: "/parity-monitor",
      icon: Share2,
    },
  ];

  const adminItem = {
    label: "Admin Panel",
    href: "/admin",
    icon: Shield,
  };

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
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all relative overflow-hidden ${
                isActive
                  ? "bg-blue-600/90 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute left-0 top-0 w-1 h-full bg-white rounded-r-full"
                />
              )}
              <item.icon
                className={`w-5 h-5 ${isActive ? "text-white" : "group-hover:text-white transition-colors"}`}
              />
              <span className="text-sm font-bold tracking-tight">
                {item.label}
              </span>
              {isActive && (
                <ChevronRight className="ml-auto w-4 h-4 opacity-50" />
              )}
            </Link>
          );
        })}

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
