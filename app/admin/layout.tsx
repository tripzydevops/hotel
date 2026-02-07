"use client";

import Link from "next/link";
import { Database, LayoutDashboard, Settings, List } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAdminGuard } from "@/hooks/useAdminGuard";

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
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--soft-gold)]"></div>
      </div>
    );
  }

  if (!authorized) {
    return null; // Hook handles redirect
  }

  const navItems = [
    { name: "Directory", href: "/admin", icon: Database },
    { name: "Global Settings", href: "/admin/settings", icon: Settings },
    { name: "Master List", href: "/admin/list", icon: List },
  ];

  return (
    <div className="min-h-screen bg-[var(--deep-ocean)] flex">
      {/* Admin Sidebar */}
      <aside className="w-64 bg-[var(--deep-ocean-card)]/50 backdrop-blur-xl border-r border-white/10 flex flex-col fixed inset-y-0 z-50 shadow-2xl">
        <div className="p-8">
          <Link href="/" className="flex flex-col gap-1 group">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--soft-gold)] to-[#b49020] flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.2)] group-hover:scale-110 transition-transform duration-300">
                <span className="text-[var(--deep-ocean)] font-black text-lg">
                  H
                </span>
              </div>
              <span className="text-xl font-bold text-white tracking-tight font-[var(--font-montserrat)]">
                Admin<span className="text-[var(--soft-gold)]">Panel</span>
              </span>
            </div>
            <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] ml-10">
              Enterprise Control
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-6 space-y-2">
          <div className="text-[10px] uppercase font-black text-[var(--text-muted)] tracking-widest px-2 mb-4 mt-2 opacity-50">
            Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 group ${
                  isActive
                    ? "bg-[var(--soft-gold)] text-[var(--deep-ocean)] shadow-lg shadow-[var(--soft-gold)]/20 scale-[1.02]"
                    : "text-[var(--text-secondary)] hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon
                  className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? "text-[var(--deep-ocean)]" : "text-[var(--soft-gold)]"}`}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-white/5">
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition-all group uppercase tracking-widest"
          >
            <LayoutDashboard className="w-4 h-4 text-[var(--soft-gold)] group-hover:rotate-12 transition-transform" />
            Exit to App
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-64 p-10 bg-gradient-to-br from-transparent via-black/5 to-black/10 min-h-screen">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
