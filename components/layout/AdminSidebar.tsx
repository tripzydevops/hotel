"use client";

import Link from "next/link";
import {
  Users,
  Building2,
  Activity,
  Key,
  Crown,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Terminal,
  Database,
  Search,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface AdminSidebarProps {
  activeRoute?: string;
}

export default function AdminSidebar({ activeRoute }: AdminSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    { name: "System Overview", href: "/admin", icon: Database, id: "overview" },
    { name: "User Accounts", href: "/admin/users", icon: Users, id: "users" },
    {
      name: "Property Directory",
      href: "/admin/list",
      icon: Building2,
      id: "list",
    },
    { name: "License Keys", href: "/admin/keys", icon: Key, id: "keys" },
    { name: "Service Plans", href: "/admin/plans", icon: Crown, id: "plans" },
    {
      name: "Live Monitoring",
      href: "/admin/scans",
      icon: Search,
      id: "scans",
    },
    { name: "System Logs", href: "/admin/logs", icon: Terminal, id: "logs" },
    {
      name: "Admin Settings",
      href: "/admin/settings",
      icon: Activity,
      id: "settings",
    },
  ];

  return (
    <aside
      className={cn(
        "h-screen flex flex-col bg-[#050b16] transition-all duration-300 ease-in-out border-r border-red-500/20",
        isCollapsed ? "w-20" : "w-64",
      )}
    >
      {/* Admin Branding */}
      <div className="h-20 flex items-center px-6 border-b border-red-500/20 bg-red-500/5">
        <ShieldAlert className="w-8 h-8 text-red-500 shrink-0" />
        {!isCollapsed && (
          <div className="ml-4 flex flex-col">
            <span className="font-black text-sm tracking-widest text-white uppercase">
              SENTINEL<span className="text-red-500">.ADMIN</span>
            </span>
            <span className="text-[8px] text-red-500/60 font-mono tracking-[0.2em] font-bold">
              Root Authority Level
            </span>
          </div>
        )}
      </div>

      {/* Admin Nav */}
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center px-4 py-2.5 rounded-sm transition-all duration-200 group relative",
              activeRoute === item.id
                ? "bg-red-500/10 text-white border-l-2 border-red-500"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-white",
            )}
          >
            <item.icon
              className={cn(
                "w-4 h-4 shrink-0 transition-colors",
                activeRoute === item.id
                  ? "text-red-500"
                  : "text-slate-500 group-hover:text-red-400",
              )}
            />
            {!isCollapsed && (
              <span className="ml-3 text-xs font-bold uppercase tracking-widest">
                {item.name}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* System Toggle */}
      <div className="p-4 border-t border-red-500/20">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center p-2 rounded-sm bg-red-500/5 text-red-400 hover:bg-red-500/10 transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight size={16} />
          ) : (
            <div className="flex items-center gap-2">
              <ChevronLeft size={16} />
              <span className="text-[10px] font-bold uppercase tracking-[0.3em]">
                Minimize
              </span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
