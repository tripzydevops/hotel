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
    <div className="command-center-layout min-h-screen bg-[var(--deep-ocean)]">
      {/* 1. PRIMARY NAVIGATION (Left) */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        activeRoute={activeRoute}
      />

      {/* 2. TACTICAL VIEWPORT (Center) */}
      <div className="flex flex-col h-screen overflow-hidden border-x border-[var(--panel-border)]">
        <CommandHeader userProfile={userProfile} />

        <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-[1400px] mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      {/* 3. AGENT INTELLIGENCE (Right) */}
      <AgentPulseSidebar />
    </div>
  );
}
