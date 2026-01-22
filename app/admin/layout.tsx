"use client";

import Link from "next/link";
import { Database, LayoutDashboard, Settings, LogOut, Building2, List } from "lucide-react";
import { usePathname } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { name: "Directory", href: "/admin", icon: Database },
    { name: "Global Settings", href: "/admin/settings", icon: Settings },
    { name: "Master List", href: "/admin/list", icon: List },
  ];

  return (
    <div className="min-h-screen bg-[var(--deep-ocean)] flex">
      {/* Admin Sidebar */}
      <aside className="w-64 bg-black/30 border-r border-white/5 flex flex-col fixed inset-y-0 z-50">
        <div className="p-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--soft-gold)] to-[#e6b800] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <span className="text-[var(--deep-ocean)] font-bold text-lg">H</span>
            </div>
            <span className="text-lg font-bold text-white tracking-tight">Admin<span className="text-[var(--soft-gold)]">Panel</span></span>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-widest px-2 mb-2 mt-4">Management</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                  isActive 
                  ? "bg-[var(--soft-gold)] text-[var(--deep-ocean)] shadow-lg shadow-[var(--soft-gold)]/20" 
                  : "text-[var(--text-muted)] hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? "text-[var(--deep-ocean)]" : "text-[var(--soft-gold)]"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          <Link 
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition-all"
          >
            <LayoutDashboard className="w-4 h-4" />
            User Dashboard
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-64 p-8">
        {children}
      </main>
    </div>
  );
}
