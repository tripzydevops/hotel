/**
 * EXPLANATION: Landing Route Group Layout
 * 
 * This layout wraps ALL public marketing pages (/, /about, /pricing, /contact)
 * with the LandingNavbar and LandingFooter.
 * 
 * Uses a Next.js route group "(landing)" so these pages share the
 * marketing layout without affecting the URL structure.
 * The dashboard pages use a separate "(dashboard)" route group
 * with their own DashboardLayout (sidebar + header).
 */
"use client";

import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import { useTheme } from "@/lib/theme";

export default function LandingGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = useTheme();

  return (
    <div className={theme === "light" ? "light-theme" : ""}>
      <LandingNavbar />
      <main className="min-h-screen bg-[var(--deep-ocean)] transition-all duration-500">
        {children}
      </main>
      <LandingFooter />
    </div>
  );
}
