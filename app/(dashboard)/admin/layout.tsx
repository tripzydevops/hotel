"use client";

import Link from "next/link";
import {
  Database,
  LayoutDashboard,
  Settings,
  List,
  ChevronRight,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { loading, authorized } = useAdminGuard();

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--deep-ocean)] flex items-center justify-center">
        <div className="bg-grain" />
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--soft-gold)]"></div>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  const navItems = [
    { name: "Directives", href: "/admin", icon: Database },
    { name: "Governance", href: "/admin/settings", icon: Settings },
    { name: "Global Index", href: "/admin/list", icon: List },
  ];

  return (
    <div className="min-h-screen bg-[var(--deep-ocean)] text-white selection:bg-[var(--soft-gold)]/30">
      {/* Immersive Background Layers */}
      <div className="radial-glow" />
      <div className="bg-grain" />

      {/* Iconic Floating Dock (Sidebar) */}
      <aside className="w-[88px] hover:w-64 bg-black/40 backdrop-blur-3xl border-r border-white/5 flex flex-col fixed inset-y-0 z-50 transition-all duration-500 ease-[cubic-bezier(0.16, 1, 0.3, 1)] group shadow-[20px_0_50px_rgba(0,0,0,0.5)]">
        <div className="p-6 flex justify-center group-hover:justify-start items-center transition-all">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--soft-gold)] to-[#b49020] flex items-center justify-center shadow-[0_0_25px_rgba(212,175,55,0.3)] shrink-0">
              <span className="text-[var(--deep-ocean)] font-black text-xl">
                H
              </span>
            </div>
            <div className="hidden group-hover:flex flex-col opacity-0 group-hover:opacity-100 transition-all duration-500 delay-100">
              <span className="text-sm font-black tracking-widest uppercase">
                Admin<span className="text-[var(--soft-gold)]">OS</span>
              </span>
              <span className="text-[7px] font-black text-[var(--soft-gold)]/50 uppercase tracking-[0.3em]">
                Command Center
              </span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-4 mt-8 space-y-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-4 p-3 rounded-2xl transition-all duration-300 relative group/item ${
                  isActive
                    ? "bg-[var(--soft-gold)] shadow-[0_0_30px_rgba(212,175,55,0.2)]"
                    : "hover:bg-white/5"
                }`}
              >
                <div
                  className={`w-10 h-10 flex items-center justify-center shrink-0 transition-all ${isActive ? "text-[var(--deep-ocean)]" : "text-[var(--text-secondary)] group-hover/item:text-[var(--soft-gold)]"}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span
                  className={`text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${isActive ? "text-[var(--deep-ocean)]" : "text-[var(--text-secondary)] group-hover/item:text-white"} opacity-0 group-hover:opacity-100 whitespace-nowrap`}
                >
                  {item.name}
                </span>

                {isActive && (
                  <motion.div
                    layoutId="sideGlow"
                    className="absolute inset-0 bg-white/20 rounded-2xl pointer-events-none"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-4">
          <Link
            href="/"
            className="flex items-center gap-4 p-3 rounded-2xl text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition-all group/exit"
          >
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
              <LayoutDashboard className="w-5 h-5 text-[var(--soft-gold)] group-hover/exit:rotate-12 transition-transform" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
              De-Authorize
            </span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-[88px] group-hover:ml-64 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] p-8 lg:p-14 relative z-10">
        <div className="max-w-[1600px] mx-auto min-h-[calc(100vh-112px)]">
          {children}
        </div>
      </main>
    </div>
  );
}
