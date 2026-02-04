"use client";

import { useAdminGuard } from "@/hooks/useAdminGuard";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { Terminal } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, authorized } = useAdminGuard();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#03070d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Terminal className="w-8 h-8 text-red-500 animate-pulse" />
          <span className="text-[10px] font-mono text-red-500/60 uppercase tracking-[0.5em]">
            Authenticating_Session...
          </span>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return null; // Hook handles redirect
  }

  return (
    <div className="flex h-screen bg-[#03070d] overflow-hidden">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* System Alert Bar */}
        <div className="h-8 bg-red-900/20 border-b border-red-500/20 flex items-center px-6 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">
              Live System Master Access
            </span>
          </div>
          <div className="h-3 w-[1px] bg-red-500/20" />
          <span className="text-[9px] font-mono text-red-500/40 uppercase">
            Node: Global_Primary
          </span>
        </div>

        <main className="flex-1 overflow-y-auto p-8 custom-admin-scrollbar">
          {children}
        </main>
      </div>

      <style jsx global>{`
        .custom-admin-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-admin-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 0, 0, 0.02);
        }
        .custom-admin-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(239, 68, 68, 0.2);
          border-radius: 10px;
        }
        .custom-admin-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(239, 68, 68, 0.4);
        }
      `}</style>
    </div>
  );
}
