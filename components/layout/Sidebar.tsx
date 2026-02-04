"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  BrainCircuit,
  FilePieChart,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  activeRoute: string;
}

export default function Sidebar({
  isCollapsed,
  onToggle,
  activeRoute,
}: SidebarProps) {
  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard, id: "dashboard" },
    { name: "Analysis", href: "/analysis", icon: BrainCircuit, id: "analysis" },
    { name: "Reports", href: "/reports", icon: FilePieChart, id: "reports" },
    {
      name: "Fleet Master",
      href: "/admin/list",
      icon: Users,
      id: "admin-list",
    },
    {
      name: "System Base",
      href: "/admin",
      icon: ShieldCheck,
      id: "admin-base",
    },
    {
      name: "Settings",
      href: "/admin/settings",
      icon: Settings,
      id: "settings",
    },
  ];

  return (
    <aside
      className={cn(
        "h-screen flex flex-col bg-[#071529] transition-all duration-300 ease-in-out border-r border-[var(--panel-border)]",
        isCollapsed ? "w-16" : "w-[240px]",
      )}
    >
      {/* Brand Section */}
      <div className="h-16 flex items-center px-4 border-b border-[var(--panel-border)] overflow-hidden">
        <ShieldCheck className="w-8 h-8 text-[var(--soft-gold)] flex-shrink-0" />
        {!isCollapsed && (
          <span className="ml-3 font-bold text-sm tracking-tighter whitespace-nowrap">
            HOTEL PLUS{" "}
            <span className="text-[10px] text-[var(--text-muted)] font-mono ml-1">
              v2.0
            </span>
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center px-3 py-2.5 rounded-sm transition-colors group",
              activeRoute === item.id
                ? "bg-[var(--soft-gold)] text-black"
                : "text-[var(--text-secondary)] hover:bg-white/5 hover:text-white",
            )}
          >
            <item.icon
              className={cn(
                "w-5 h-5 flex-shrink-0",
                activeRoute === item.id
                  ? "text-black"
                  : "text-[var(--text-muted)] group-hover:text-[var(--soft-gold)]",
              )}
            />
            {!isCollapsed && (
              <span className="ml-3 text-sm font-medium tracking-tight">
                {item.name}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* Toggle Button */}
      <div className="p-4 border-t border-[var(--panel-border)]">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center p-2 rounded-sm hover:bg-white/5 text-[var(--text-muted)] hover:text-white"
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </aside>
  );
}
