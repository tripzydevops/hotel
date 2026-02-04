"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  BrainCircuit,
  FilePieChart,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Zap,
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
    {
      name: "Executive Hub",
      href: "/",
      icon: LayoutDashboard,
      id: "dashboard",
    },
    {
      name: "Intelligence",
      href: "/analysis",
      icon: BrainCircuit,
      id: "analysis",
    },
    {
      name: "Yield Strategy",
      href: "/reports",
      icon: FilePieChart,
      id: "reports",
    },
    {
      name: "Preferences",
      href: "/settings",
      icon: Settings,
      id: "settings",
    },
  ];

  return (
    <aside
      className={cn(
        "h-screen flex flex-col bg-[var(--bg-deep)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] border-r border-[var(--card-border)]",
        isCollapsed ? "w-20" : "w-[260px]",
      )}
    >
      {/* Brand Section */}
      <div className="h-20 flex items-center px-6 border-b border-[var(--card-border)] overflow-hidden">
        <div className="w-10 h-10 rounded-xl bg-[var(--gold-gradient)] flex items-center justify-center shadow-lg shadow-[var(--gold-glow)] shrink-0">
          <Sparkles className="w-6 h-6 text-black" />
        </div>
        {!isCollapsed && (
          <div className="ml-4 flex flex-col">
            <span className="font-extrabold text-base tracking-tight text-white leading-none">
              TRIPZY<span className="text-[var(--gold-primary)]">.AI</span>
            </span>
            <span className="text-[9px] text-[var(--text-muted)] font-black tracking-[0.3em] uppercase mt-1">
              Sentinel v2
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-8 px-3 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center px-4 py-3 rounded-xl transition-all duration-300 group relative",
              activeRoute === item.id
                ? "bg-[var(--gold-gradient)] text-black shadow-lg shadow-[var(--gold-glow)]"
                : "text-[var(--text-secondary)] hover:bg-white/5 hover:text-white",
            )}
          >
            <item.icon
              className={cn(
                "w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110",
                activeRoute === item.id
                  ? "text-black"
                  : "text-[var(--text-muted)] group-hover:text-[var(--gold-primary)]",
              )}
            />
            {!isCollapsed && (
              <span className="ml-4 text-sm font-bold tracking-tight">
                {item.name}
              </span>
            )}

            {activeRoute === item.id && (
              <div className="absolute right-2 w-1 h-5 bg-black/20 rounded-full" />
            )}
          </Link>
        ))}
      </nav>

      {/* Pulse / System Info */}
      {!isCollapsed && (
        <div className="px-6 py-4">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse shadow-[0_0_8px_var(--success)]" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-white uppercase tracking-widest">
                Neural Link
              </span>
              <span className="text-[8px] text-[var(--text-muted)] font-mono uppercase">
                Status: Nominal
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <div className="p-4 border-t border-[var(--card-border)]">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center p-3 rounded-xl hover:bg-white/5 text-[var(--text-muted)] hover:text-white transition-all duration-300 group"
        >
          {isCollapsed ? (
            <ChevronRight
              size={20}
              className="group-hover:translate-x-0.5 transition-transform"
            />
          ) : (
            <div className="flex items-center gap-2">
              <ChevronLeft
                size={20}
                className="group-hover:-translate-x-0.5 transition-transform"
              />
              <span className="text-xs font-bold uppercase tracking-widest">
                Minimize
              </span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
