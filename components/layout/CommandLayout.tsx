"use client";

import React, { ReactNode, useState } from "react";
import Sidebar from "./Sidebar";
import AgentPulseSidebar from "./AgentPulseSidebar";
import CommandHeader from "./CommandHeader";

interface CommandLayoutProps {
  children: ReactNode;
  userProfile: any;
  activeRoute?: string;
}

export default function CommandLayout({
  children,
  userProfile,
  activeRoute = "dashboard",
}: CommandLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-[var(--bg-base)] overflow-hidden">
      {/* 1. PRIMARY NAVIGATION (Left) */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        activeRoute={activeRoute}
      />

      {/* 2. TACTICAL VIEWPORT (Center/Main) */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-500 overflow-hidden">
        <CommandHeader userProfile={userProfile} />

        <main className="flex-1 overflow-y-auto p-8 scroll-smooth custom-scrollbar">
          <div className="max-w-[1600px] mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      {/* 3. AGENT INTELLIGENCE (Right) */}
      <AgentPulseSidebar />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}
